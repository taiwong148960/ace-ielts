/**
 * Supabase Edge Function: Get Book Details
 * Returns book with progress and statistics
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"
import type { FSRSState } from "../_shared/types.ts"

// Helper function to convert FSRS state to mastery level
function stateToMasteryLevel(state: FSRSState, stability: number): "new" | "learning" | "mastered" {
  if (state === "new") return "new"
  if (state === "review" && stability > 21) return "mastered" // Stable for 3+ weeks
  return "learning"
}

const logger = createLogger("vocabulary-get-book-details")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetBookDetailsRequest {
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetBookDetailsRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // Get book
    const { data: book, error: bookError } = await supabaseAdmin
      .from("vocabulary_books")
      .select("*, is_system_book, user_id")
      .eq("id", input.bookId)
      .single()

    if (bookError || !book) {
      return errorResponse("Book not found", 404)
    }

    // Verify access (user owns it or it's a system book)
    if (!book.is_system_book && book.user_id !== user.id) {
      return errorResponse("You don't have permission to view this book", 403)
    }

    // Get user progress
    const { data: progress } = await supabaseAdmin
      .from("user_book_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("book_id", input.bookId)
      .single()

    // Calculate stats
    const now = new Date()

    // Get word progress counts (only for completed words)
    const { data: progressData } = await supabaseAdmin
      .from("user_word_progress")
      .select(`
        state,
        stability,
        due_at,
        is_learning_phase,
        vocabulary_words!inner (
          import_status
        )
      `)
      .eq("user_id", user.id)
      .eq("book_id", input.bookId)
      .eq("vocabulary_words.import_status", "completed")

    // Count only completed words
    const { count: totalCompletedWords } = await supabaseAdmin
      .from("vocabulary_words")
      .select("*", { count: "exact", head: true })
      .eq("book_id", input.bookId)
      .eq("import_status", "completed")
    
    const completedTotal = totalCompletedWords ?? 0

    let mastered = 0
    let learning = 0
    let todayReview = 0
    let totalStability = 0

    if (progressData && progressData.length > 0) {
      for (const p of progressData) {
        const mastery = stateToMasteryLevel(p.state as FSRSState, p.stability)
        if (mastery === "mastered") mastered++
        else if (mastery === "learning") learning++
        
        totalStability += p.stability || 0

        if (p.due_at && new Date(p.due_at) <= now) {
          todayReview++
        }
      }
    }

    const newWords = completedTotal - (progressData?.length || 0)
    const averageStability = progressData && progressData.length > 0 
      ? totalStability / progressData.length 
      : 0

    // Get book progress for accuracy and streak
    const { data: bookProgress } = await supabaseAdmin
      .from("user_book_progress")
      .select("accuracy_percent, streak_days, daily_new_limit")
      .eq("user_id", user.id)
      .eq("book_id", input.bookId)
      .single()

    const dailyNewLimit = bookProgress?.daily_new_limit || 20
    const todayNew = Math.min(dailyNewLimit, Math.max(0, newWords))
    const estimatedMinutes = Math.ceil((todayReview + todayNew) * 0.5)

    const stats = {
      totalWords: completedTotal,
      mastered,
      learning,
      newWords,
      todayReview,
      todayNew,
      estimatedMinutes,
      streak: bookProgress?.streak_days || 0,
      accuracy: bookProgress?.accuracy_percent || 0,
      averageStability
    }

    return successResponse({
      book,
      progress: progress || null,
      stats
    })
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
