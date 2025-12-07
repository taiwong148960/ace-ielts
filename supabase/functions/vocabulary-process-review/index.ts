/**
 * Supabase Edge Function: Process Word Review
 * Processes a word review using FSRS algorithm and logs the review
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"
import { processReview, createInitialWordProgress } from "../_shared/fsrs.ts"
import { type ProcessReviewInput, type FSRSRating } from "../_shared/types.ts"

// Create logger for this function
const logger = createLogger("vocabulary-process-review")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

// Grade to FSRS rating mapping
const GRADE_TO_RATING: Record<number, FSRSRating> = {
  1: 1, // Again
  2: 2, // Hard
  3: 3, // Good
  4: 4  // Easy
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: ProcessReviewInput = await req.json()

    if (!input.wordId || !input.bookId || !input.grade) {
      return errorResponse("wordId, bookId, and grade are required", 400)
    }

    if (![1, 2, 3, 4].includes(input.grade)) {
      return errorResponse("Grade must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy)", 400)
    }

    const rating = GRADE_TO_RATING[input.grade]
    const now = new Date()

    // Get current progress or create new
    let { data: progress } = await supabaseAdmin
      .from("user_word_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("word_id", input.wordId)
      .single()

    const isNew = !progress

    if (!progress) {
      // Create initial progress
      const initial = createInitialWordProgress(user.id, input.wordId, input.bookId)
      const { data: newProgress, error } = await supabaseAdmin
        .from("user_word_progress")
        .insert(initial)
        .select()
        .single()

      if (error) {
        logger.error("Failed to create word progress", { userId: user.id, wordId: input.wordId }, new Error(error.message))
        return errorResponse("Failed to create word progress", 500)
      }
      progress = newProgress
      logger.info("Created initial word progress", { userId: user.id, wordId: input.wordId, bookId: input.bookId })
    }

    // Calculate new scheduling with FSRS
    const schedulingResult = processReview(
      {
        state: progress.state,
        difficulty: progress.difficulty,
        stability: progress.stability,
        learning_step: progress.learning_step,
        is_learning_phase: progress.is_learning_phase,
        elapsed_days: progress.elapsed_days,
        reps: progress.reps,
        lapses: progress.lapses
      },
      rating,
      now
    )

    // Prepare update
    const updateData = {
      state: schedulingResult.state,
      difficulty: schedulingResult.difficulty,
      stability: schedulingResult.stability,
      retrievability: schedulingResult.retrievability,
      elapsed_days: schedulingResult.elapsed_days,
      scheduled_days: schedulingResult.scheduled_days,
      due_at: schedulingResult.due_at.toISOString(),
      learning_step: schedulingResult.learning_step,
      is_learning_phase: schedulingResult.is_learning_phase,
      last_review_at: now.toISOString(),
      total_reviews: progress.total_reviews + 1,
      correct_reviews: rating >= 3 ? progress.correct_reviews + 1 : progress.correct_reviews,
      reps: rating >= 2 ? progress.reps + 1 : progress.reps,
      lapses: rating === 1 ? progress.lapses + 1 : progress.lapses,
      updated_at: now.toISOString()
    }

    // Update progress
    const { data: updatedProgress, error: updateError } = await supabaseAdmin
      .from("user_word_progress")
      .update(updateData)
      .eq("id", progress.id)
      .select()
      .single()

    if (updateError) {
      logger.error("Failed to update word progress", { userId: user.id, wordId: input.wordId, rating }, new Error(updateError.message))
      return errorResponse("Failed to update word progress", 500)
    }

    logger.info("Word review processed", { 
      userId: user.id, 
      wordId: input.wordId, 
      bookId: input.bookId,
      rating,
      newState: updatedProgress.state,
      scheduledDays: updatedProgress.scheduled_days
    })

    // Log the review
    await supabaseAdmin.from("review_logs").insert({
      user_id: user.id,
      word_id: input.wordId,
      book_id: input.bookId,
      progress_id: updatedProgress.id,
      rating,
      state_before: progress.state,
      state_after: updatedProgress.state,
      difficulty_before: progress.difficulty,
      stability_before: progress.stability,
      difficulty_after: updatedProgress.difficulty,
      stability_after: updatedProgress.stability,
      scheduled_days: updatedProgress.scheduled_days,
      elapsed_days: progress.elapsed_days,
      reviewed_at: now.toISOString()
    })

    // Update book progress stats
    await updateBookProgressStats(supabaseAdmin, user.id, input.bookId, isNew, now)

    return successResponse(updatedProgress)
  } catch (error) {
    logger.error("Edge function error", {}, error instanceof Error ? error : new Error(String(error)))
    
    if (error instanceof Error) {
      if (error.message === "Unauthorized" || error.message === "Missing authorization header") {
        return errorResponse(error.message, 401)
      }
    }
    
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    )
  }
})

/**
 * Update book progress statistics after a review
 */
async function updateBookProgressStats(
  supabase: ReturnType<typeof initSupabase> extends Promise<infer T> ? T["supabaseAdmin"] : never,
  userId: string,
  bookId: string,
  isNewWord: boolean,
  now: Date
): Promise<void> {
  const today = now.toISOString().split('T')[0]

  // Get current book progress
  const { data: bookProgress } = await supabase
    .from("user_book_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .single()

  if (!bookProgress) {
    // Create book progress if doesn't exist
    await supabase.from("user_book_progress").insert({
      user_id: userId,
      book_id: bookId,
      mastered_count: 0,
      learning_count: 0,
      new_count: 0,
      streak_days: 1,
      accuracy_percent: 0,
      total_reviews: 1,
      reviews_today: 1,
      new_words_today: isNewWord ? 1 : 0,
      last_review_date: today,
      daily_new_limit: 20,
      daily_review_limit: 100
    })
    return
  }

  // Check if this is a new day
  const isNewDay = bookProgress.last_review_date !== today
  const newStreak = isNewDay
    ? (isConsecutiveDay(bookProgress.last_review_date, today) ? bookProgress.streak_days + 1 : 1)
    : bookProgress.streak_days

  // Update counts
  await supabase
    .from("user_book_progress")
    .update({
      total_reviews: bookProgress.total_reviews + 1,
      reviews_today: isNewDay ? 1 : bookProgress.reviews_today + 1,
      new_words_today: isNewDay ? (isNewWord ? 1 : 0) : (isNewWord ? bookProgress.new_words_today + 1 : bookProgress.new_words_today),
      last_review_date: today,
      last_studied_at: now.toISOString(),
      streak_days: newStreak,
      updated_at: now.toISOString()
    })
    .eq("id", bookProgress.id)
}

/**
 * Check if two dates are consecutive
 */
function isConsecutiveDay(dateStr1: string | null, dateStr2: string): boolean {
  if (!dateStr1) return false
  const date1 = new Date(dateStr1)
  const date2 = new Date(dateStr2)
  const diffTime = date2.getTime() - date1.getTime()
  const diffDays = diffTime / (1000 * 60 * 60 * 24)
  return diffDays === 1
}
