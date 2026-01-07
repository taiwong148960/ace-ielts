import { errorResponse, handleCors, successResponse } from "../_shared/cors.ts";
import { initSupabase } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { Router } from "../_shared/router.ts";
import { createInitialWordProgress, processReview } from "../_shared/fsrs.ts";
import { type FSRSRating, type FSRSState } from "../_shared/types.ts";

const logger = createLogger("vocabulary-study");

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const router = new Router();

router.get("/session", handleGetSession);
router.post("/review", handleProcessReview);
router.get("/recent", handleGetRecent);
router.get("/difficult", handleGetDifficult);
router.post("/init", handleInitProgress);
router.get("/stats/forgetting-curve", handleGetForgettingCurveStats);

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    return await router.handle(req);
  } catch (error) {
    logger.error("Router error", {}, error as Error);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
});

// ============================================================================
// Handlers
// ============================================================================

async function handleGetSession(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(
    req.headers.get("Authorization"),
  );
  const url = new URL(req.url);
  const bookId = url.searchParams.get("bookId");
  const newLimit = parseInt(url.searchParams.get("newLimit") || "20");
  const reviewLimit = parseInt(url.searchParams.get("reviewLimit") || "100");

  logger.info("Starting study session", {
    userId: user.id,
    bookId,
    newLimit,
    reviewLimit,
  });

  if (!bookId) return errorResponse("Book ID is required", 400);

  // Verify access
  const { data: book } = await supabaseAdmin
    .from("vocabulary_books")
    .select("id, user_id, is_system_book")
    .eq("id", bookId)
    .single();

  if (!book) return errorResponse("Book not found", 404);
  if (!book.is_system_book && book.user_id !== user.id) {
    return errorResponse("Forbidden", 403);
  }

  const now = new Date();

  // Get words due for review
  const { data: dueProgress, error: dueError } = await supabaseAdmin
    .from("vocabulary_user_word_progress")
    .select(`
      id, word_id, state, stability, due_at, last_review_at, lapses,
      vocabulary_words!inner (
        id, word, phonetic, definitions, examples, 
        meta, forms, confused_words, import_status, audio_path
      )
    `)
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .eq("vocabulary_words.import_status", "done")
    .lte("due_at", now.toISOString())
    .order("due_at")
    .limit(reviewLimit);

  if (dueError) {
    logger.error(
      "Failed to fetch due words",
      { userId: user.id, bookId },
      new Error(dueError.message),
    );
    return errorResponse("Failed to fetch study session", 500);
  }

  const reviewWords = (dueProgress || []).map((p: any) => ({
    id: p.word_id,
    word: p.vocabulary_words.word,
    phonetic: p.vocabulary_words.phonetic,
    definition: p.vocabulary_words.definitions?.[0]?.meaning || "",
    definitions: p.vocabulary_words.definitions,
    examples: p.vocabulary_words.examples,
    synonyms: p.vocabulary_words.meta?.synonyms || [],
    antonyms: p.vocabulary_words.meta?.antonyms || [],
    confused_words: p.vocabulary_words.confused_words || [],
    word_family: p.vocabulary_words.meta?.word_family || [],
    collocations: p.vocabulary_words.meta?.collocations || [],
    topic: p.vocabulary_words.meta?.topic || null,
    tenses: p.vocabulary_words.forms?.tenses || [],
    word_audio_path: p.vocabulary_words.audio_path || null,
    state: p.state as FSRSState,
    stability: p.stability,
    due_at: p.due_at,
    last_review_at: p.last_review_at,
    lapses: p.lapses,
  }));

  // Get new words
  const { data: bookWordsData, error: bookWordsError } = await supabaseAdmin
    .from("vocabulary_book_words")
    .select(`
      word_id,
      vocabulary_words!inner (
        id, word, phonetic, definitions, examples, 
        meta, forms, confused_words, import_status, audio_path
      )
    `)
    .eq("book_id", bookId)
    .eq("vocabulary_words.import_status", "done");

  if (bookWordsError) {
    logger.error(
      "Failed to fetch new words",
      { userId: user.id, bookId },
      new Error(bookWordsError.message),
    );
    return errorResponse("Failed to fetch study session", 500);
  }

  const { data: existingProgress, error: existingProgressError } =
    await supabaseAdmin
      .from("vocabulary_user_word_progress")
      .select("word_id")
      .eq("user_id", user.id)
      .eq("book_id", bookId);

  if (existingProgressError) {
    logger.error("Failed to fetch existing progress", {
      userId: user.id,
      bookId,
    }, new Error(existingProgressError.message));
    return errorResponse("Failed to fetch study session", 500);
  }

  const existingWordIds = new Set(
    (existingProgress || []).map((p: any) => p.word_id),
  );
  const newWordsData = (bookWordsData || [])
    .filter((bw: any) => !existingWordIds.has(bw.word_id))
    .map((bw: any) => bw.vocabulary_words)
    .slice(0, newLimit);

  const newWords = newWordsData.map((w: any) => ({
    id: w.id,
    word: w.word,
    phonetic: w.phonetic,
    definition: w.definitions?.[0]?.meaning || "",
    definitions: w.definitions,
    examples: w.examples,
    synonyms: w.meta?.synonyms || [],
    antonyms: w.meta?.antonyms || [],
    confused_words: w.confused_words || [],
    word_family: w.meta?.word_family || [],
    collocations: w.meta?.collocations || [],
    topic: w.meta?.topic || null,
    tenses: w.forms?.tenses || [],
    word_audio_path: w.audio_path || null,
    state: "new" as FSRSState,
    stability: 0,
    due_at: null,
    last_review_at: null,
    lapses: 0,
  }));

  return successResponse({
    reviewWords,
    newWords,
    totalCount: reviewWords.length + newWords.length,
    estimatedMinutes: Math.ceil((reviewWords.length + newWords.length) * 0.5),
  });
}

const GRADE_TO_RATING: Record<number, FSRSRating> = { 1: 1, 2: 2, 3: 3, 4: 4 };

async function handleProcessReview(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(
    req.headers.get("Authorization"),
  );
  const input = await req.json();
  const { wordId, bookId, grade } = input;

  logger.info("Processing review", { userId: user.id, wordId, bookId, grade });

  if (!wordId || !bookId || !grade) return errorResponse("Missing fields", 400);
  if (![1, 2, 3, 4].includes(grade)) return errorResponse("Invalid grade", 400);

  const rating = GRADE_TO_RATING[grade];
  const now = new Date();

  let { data: progress } = await supabaseAdmin
    .from("vocabulary_user_word_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("word_id", wordId)
    .eq("book_id", bookId)
    .single();

  const isNew = !progress;

  if (!progress) {
    const initial = createInitialWordProgress(user.id, wordId, bookId);
    const { data: newProgress, error } = await supabaseAdmin
      .from("vocabulary_user_word_progress")
      .insert(initial)
      .select().single();
    if (error) {
      logger.error(
        "Failed to create progress",
        { userId: user.id, wordId },
        new Error(error.message),
      );
      return errorResponse("Failed to create progress", 500);
    }
    progress = newProgress;
  }

  const schedulingResult = processReview(
    {
      state: progress.state,
      difficulty: progress.difficulty,
      stability: progress.stability,
      learning_step: progress.learning_step,
      is_learning_phase: progress.is_learning_phase,
      elapsed_days: progress.elapsed_days,
      reps: progress.reps,
      lapses: progress.lapses,
    },
    rating,
    now,
  );

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
    correct_reviews: rating >= 3
      ? progress.correct_reviews + 1
      : progress.correct_reviews,
    reps: rating >= 2 ? progress.reps + 1 : progress.reps,
    lapses: rating === 1 ? progress.lapses + 1 : progress.lapses,
    updated_at: now.toISOString(),
  };

  const { data: updatedProgress, error: updateError } = await supabaseAdmin
    .from("vocabulary_user_word_progress")
    .update(updateData)
    .eq("id", progress.id)
    .select().single();

  if (updateError) {
    logger.error("Failed to update progress", {
      userId: user.id,
      progressId: progress.id,
    }, new Error(updateError.message));
    return errorResponse("Failed to update progress", 500);
  }

  const { error: logError } = await supabaseAdmin.from("vocabulary_review_logs").insert({
    user_id: user.id,
    word_id: wordId,
    book_id: bookId,
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
    reviewed_at: now.toISOString(),
  });

  if (logError) {
    logger.error("Failed to insert review log", {
      userId: user.id,
      wordId,
      bookId,
    }, new Error(logError.message));
    // Don't return error - progress update succeeded, log is secondary
  }

  await updateBookProgressStats(supabaseAdmin, user.id, bookId, isNew, now);

  logger.info("Review processed successfully", {
    userId: user.id,
    wordId,
    newState: updatedProgress.state,
  });

  return successResponse(updatedProgress);
}

async function handleGetRecent(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(
    req.headers.get("Authorization"),
  );
  const url = new URL(req.url);
  const bookId = url.searchParams.get("bookId");
  const limit = parseInt(url.searchParams.get("limit") || "5");

  logger.info("Fetching recent words", { userId: user.id, bookId, limit });

  if (!bookId) return errorResponse("Book ID is required", 400);

  const { data, error } = await supabaseAdmin
    .from("vocabulary_user_word_progress")
    .select(`
      word_id, state, stability, due_at, last_review_at, lapses,
      vocabulary_words!inner (id, word, phonetic, definitions, import_status)
    `)
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .eq("vocabulary_words.import_status", "done")
    .not("last_review_at", "is", null)
    .order("last_review_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error(
      "Failed to fetch recent words",
      { userId: user.id, bookId },
      new Error(error.message),
    );
    return errorResponse("Failed to fetch recent words", 500);
  }

  const words = (data || []).map((p: any) => ({
    id: p.word_id,
    word: p.vocabulary_words.word,
    phonetic: p.vocabulary_words.phonetic,
    definition: p.vocabulary_words.definitions?.[0]?.meaning || "",
    state: p.state as FSRSState,
    stability: p.stability,
    due_at: p.due_at,
    last_review_at: p.last_review_at,
    lapses: p.lapses,
  }));

  return successResponse(words);
}

async function handleGetDifficult(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(
    req.headers.get("Authorization"),
  );
  const url = new URL(req.url);
  const bookId = url.searchParams.get("bookId");
  const limit = parseInt(url.searchParams.get("limit") || "5");

  if (!bookId) return errorResponse("Book ID is required", 400);

  const { data, error } = await supabaseAdmin
    .from("vocabulary_user_word_progress")
    .select(`
      word_id, state, stability, due_at, last_review_at, lapses,
      vocabulary_words!inner (id, word, phonetic, definitions, import_status)
    `)
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .eq("vocabulary_words.import_status", "done")
    .gt("lapses", 0)
    .order("lapses", { ascending: false })
    .order("stability", { ascending: true })
    .limit(limit);

  if (error) {
    logger.error(
      "Failed to fetch difficult words",
      { userId: user.id, bookId },
      new Error(error.message),
    );
    return errorResponse("Failed to fetch difficult words", 500);
  }

  const words = (data || []).map((p: any) => ({
    id: p.word_id,
    word: p.vocabulary_words.word,
    phonetic: p.vocabulary_words.phonetic,
    definition: p.vocabulary_words.definitions?.[0]?.meaning || "",
    state: p.state as FSRSState,
    stability: p.stability,
    due_at: p.due_at,
    last_review_at: p.last_review_at,
    lapses: p.lapses,
  }));

  return successResponse(words);
}

async function handleInitProgress(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(
    req.headers.get("Authorization"),
  );
  const input = await req.json();
  const { bookId } = input;

  if (!bookId) return errorResponse("Book ID is required", 400);

  const { data: existing } = await supabaseAdmin
    .from("vocabulary_user_book_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .single();

  if (existing) return successResponse(existing);

  const { data: book } = await supabaseAdmin
    .from("vocabulary_books")
    .select("word_count")
    .eq("id", bookId)
    .single();

  if (!book) return errorResponse("Book not found", 404);

  const { data: progress, error } = await supabaseAdmin
    .from("vocabulary_user_book_progress")
    .insert({
      user_id: user.id,
      book_id: bookId,
      mastered_count: 0,
      learning_count: 0,
      new_count: book.word_count || 0,
      streak_days: 0,
      accuracy_percent: 0,
      total_reviews: 0,
      reviews_today: 0,
      new_words_today: 0,
      last_review_date: null,
      daily_new_limit: 20,
      daily_review_limit: 100,
    })
    .select().single();

  if (error) return errorResponse("Failed to init progress", 500);
  return successResponse(progress);
}

/**
 * Get forgetting curve statistics for visualization
 * Returns: mastery distribution, average stability, stability distribution, upcoming reviews
 */
async function handleGetForgettingCurveStats(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(
    req.headers.get("Authorization"),
  );
  const url = new URL(req.url);
  const bookId = url.searchParams.get("bookId");

  logger.info("Fetching forgetting curve stats", { userId: user.id, bookId });

  if (!bookId) return errorResponse("Book ID is required", 400);

  // Verify access
  const { data: book } = await supabaseAdmin
    .from("vocabulary_books")
    .select("id, user_id, is_system_book, word_count")
    .eq("id", bookId)
    .single();

  if (!book) return errorResponse("Book not found", 404);
  if (!book.is_system_book && book.user_id !== user.id) {
    return errorResponse("Forbidden", 403);
  }

  // Get all word progress for this book
  const { data: progressData, error: progressError } = await supabaseAdmin
    .from("vocabulary_user_word_progress")
    .select("state, stability, due_at, last_review_at")
    .eq("user_id", user.id)
    .eq("book_id", bookId);

  if (progressError) {
    logger.error(
      "Failed to fetch word progress",
      { userId: user.id, bookId },
      new Error(progressError.message),
    );
    return errorResponse("Failed to fetch statistics", 500);
  }

  const progress = progressData || [];
  const now = new Date();

  // Calculate mastery distribution
  const masteryDistribution = {
    new: book.word_count - progress.length, // Words not yet started
    learning: 0,
    mastered: 0,
  };

  // Calculate stability sums for averaging
  let learningStabilitySum = 0;
  let learningCount = 0;
  let masteredStabilitySum = 0;
  let masteredCount = 0;

  // Stability distribution buckets
  const stabilityBuckets = {
    "0-7": 0,
    "8-14": 0,
    "15-30": 0,
    "31+": 0,
  };

  // Upcoming reviews (next 7 days)
  const upcomingReviewsMap = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    upcomingReviewsMap.set(date.toISOString().split("T")[0], 0);
  }

  // Process each word progress
  interface ProgressRow {
    state: string;
    stability: number;
    due_at: string | null;
    last_review_at: string | null;
  }

  for (const p of progress as ProgressRow[]) {
    const stability = p.stability || 0;
    const state = p.state;

    // Mastery classification based on state and stability
    if (state === "review" && stability > 21) {
      masteryDistribution.mastered++;
      masteredStabilitySum += stability;
      masteredCount++;
    } else if (state !== "new") {
      masteryDistribution.learning++;
      learningStabilitySum += stability;
      learningCount++;
    }

    // Stability distribution
    if (stability <= 7) {
      stabilityBuckets["0-7"]++;
    } else if (stability <= 14) {
      stabilityBuckets["8-14"]++;
    } else if (stability <= 30) {
      stabilityBuckets["15-30"]++;
    } else {
      stabilityBuckets["31+"]++;
    }

    // Upcoming reviews
    if (p.due_at) {
      const dueDate = new Date(p.due_at);
      const dueDateStr = dueDate.toISOString().split("T")[0];
      if (upcomingReviewsMap.has(dueDateStr)) {
        upcomingReviewsMap.set(
          dueDateStr,
          (upcomingReviewsMap.get(dueDateStr) || 0) + 1,
        );
      } else if (dueDate <= now) {
        // Overdue words count as today
        const todayStr = now.toISOString().split("T")[0];
        upcomingReviewsMap.set(
          todayStr,
          (upcomingReviewsMap.get(todayStr) || 0) + 1,
        );
      }
    }
  }

  // Calculate average stability
  const averageStability = {
    new: 2, // Default for new words
    learning: learningCount > 0
      ? Math.round(learningStabilitySum / learningCount)
      : 7,
    mastered: masteredCount > 0
      ? Math.round(masteredStabilitySum / masteredCount)
      : 30,
  };

  // Convert stability distribution to array format
  const stabilityDistribution = Object.entries(stabilityBuckets).map((
    [range, count],
  ) => ({
    range,
    count,
  }));

  // Convert upcoming reviews to array format
  const upcomingReviews = Array.from(upcomingReviewsMap.entries()).map((
    [date, count],
  ) => ({
    date,
    count,
  }));

  // Calculate current retention rate
  const totalReviewed =
    progress.filter((p: ProgressRow) => p.last_review_at !== null).length;
  const notOverdue = progress.filter((p: ProgressRow) => {
    if (!p.due_at) return false;
    return new Date(p.due_at) >= now;
  }).length;
  const currentRetentionRate = totalReviewed > 0
    ? Math.round((notOverdue / totalReviewed) * 100)
    : 100;

  return successResponse({
    masteryDistribution,
    averageStability,
    stabilityDistribution,
    upcomingReviews,
    currentRetentionRate,
  });
}

// Helper Functions
async function updateBookProgressStats(
  supabase: any,
  userId: string,
  bookId: string,
  isNewWord: boolean,
  now: Date,
) {
  const today = now.toISOString().split("T")[0];
  const { data: bookProgress, error: fetchError } = await supabase
    .from("vocabulary_user_book_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .single();

  if (fetchError) {
    logger.warn("Failed to fetch book progress for stats update", {
      userId,
      bookId,
    }, new Error(fetchError.message));
    return;
  }

  if (!bookProgress) return; // Should exist

  const isNewDay = bookProgress.last_review_date !== today;
  const newStreak = isNewDay
    ? (isConsecutiveDay(bookProgress.last_review_date, today)
      ? bookProgress.streak_days + 1
      : 1)
    : bookProgress.streak_days;

  const { error: updateError } = await supabase
    .from("vocabulary_user_book_progress")
    .update({
      total_reviews: bookProgress.total_reviews + 1,
      reviews_today: isNewDay ? 1 : bookProgress.reviews_today + 1,
      new_words_today: isNewDay
        ? (isNewWord ? 1 : 0)
        : (isNewWord
          ? bookProgress.new_words_today + 1
          : bookProgress.new_words_today),
      last_review_date: today,
      last_studied_at: now.toISOString(),
      streak_days: newStreak,
      updated_at: now.toISOString(),
    })
    .eq("id", bookProgress.id);

  if (updateError) {
    logger.warn(
      "Failed to update book progress stats",
      { userId, bookId },
      new Error(updateError.message),
    );
  }
}

function isConsecutiveDay(dateStr1: string | null, dateStr2: string): boolean {
  if (!dateStr1) return false;
  const date1 = new Date(dateStr1);
  const date2 = new Date(dateStr2);
  const diffTime = date2.getTime() - date1.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays === 1;
}
