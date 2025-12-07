/**
 * Vocabulary Detail Service
 * Handles book detail page data, learning sessions, and spaced repetition
 */

import { getSupabase, isSupabaseInitialized } from "./supabase"
import { fsrsScheduler, createInitialWordProgress, stateToMasteryLevel } from "./fsrs"
import type {
  VocabularyBook,
  UserWordProgress,
  UserBookProgress,
  BookDetailStats,
  WordWithProgress,
  TodayLearningSession,
  FSRSRating,
  FSRSState,
  ReviewLog
} from "../types/vocabulary"
import { GRADE_TO_RATING, type SpacedRepetitionGrade } from "../types/vocabulary"
import { createLogger } from "../utils/logger"

// Create logger for this service
const logger = createLogger("VocabularyDetailService")

/**
 * Supabase query result type for word progress with joined vocabulary_words
 * Note: vocabulary_words is typed as single object (many-to-one relationship)
 */
interface WordProgressWithWord {
  word_id: string
  state: string
  stability: number
  due_at: string | null
  last_review_at: string | null
  lapses: number
  vocabulary_words: {
    id: string
    word: string
    phonetic: string | null
    definition: string
  }
}

/**
 * Helper to cast Supabase query results to WordProgressWithWord[]
 * This is needed because Supabase's type inference doesn't correctly handle !inner joins
 */
function asWordProgressList(data: unknown[] | null): WordProgressWithWord[] {
  return (data || []) as WordProgressWithWord[]
}

/**
 * Get a book with full details for the book detail page
 */
export async function getBookWithDetails(
  bookId: string,
  userId: string
): Promise<{
  book: VocabularyBook
  progress: UserBookProgress | null
  stats: BookDetailStats
} | null> {
  if (!isSupabaseInitialized()) {
    logger.warn("Supabase not initialized", { operation: "getBookWithDetails" })
    return null
  }

  const supabase = getSupabase()

  // Get book
  const { data: book, error: bookError } = await supabase
    .from("vocabulary_books")
    .select("*")
    .eq("id", bookId)
    .single()

  if (bookError || !book) {
    logger.error("Failed to fetch book details", { bookId, userId }, bookError || new Error("Book not found"))
    return null
  }

  // Get user progress
  const { data: progress } = await supabase
    .from("user_book_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .single()

  // Calculate stats from word progress
  const stats = await calculateBookStats(bookId, userId, book.word_count)

  return { book, progress, stats }
}

/**
 * Calculate detailed book statistics
 */
async function calculateBookStats(
  bookId: string,
  userId: string,
  totalWords: number
): Promise<BookDetailStats> {
  if (!isSupabaseInitialized()) {
    return getDefaultStats(totalWords)
  }

  const supabase = getSupabase()
  const now = new Date()

  // Get word progress counts
  const { data: progressData } = await supabase
    .from("user_word_progress")
    .select("state, stability, due_at, is_learning_phase")
    .eq("user_id", userId)
    .eq("book_id", bookId)

  if (!progressData || progressData.length === 0) {
    return getDefaultStats(totalWords)
  }

  // Count by state
  let mastered = 0
  let learning = 0
  let todayReview = 0
  let totalStability = 0

  for (const p of progressData) {
    const mastery = stateToMasteryLevel(p.state as FSRSState, p.stability)
    if (mastery === "mastered") mastered++
    else if (mastery === "learning") learning++
    
    totalStability += p.stability || 0

    // Count due for review
    if (p.due_at && new Date(p.due_at) <= now) {
      todayReview++
    }
  }

  const newWords = totalWords - progressData.length
  const averageStability = progressData.length > 0 ? totalStability / progressData.length : 0

  // Get book progress for accuracy and streak
  const { data: bookProgress } = await supabase
    .from("user_book_progress")
    .select("accuracy_percent, streak_days, daily_new_limit")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .single()

  const dailyNewLimit = bookProgress?.daily_new_limit || 20
  const todayNew = Math.min(dailyNewLimit, newWords)
  const estimatedMinutes = Math.ceil((todayReview + todayNew) * 0.5) // ~30 seconds per word

  return {
    totalWords,
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
}

function getDefaultStats(totalWords: number): BookDetailStats {
  return {
    totalWords,
    mastered: 0,
    learning: 0,
    newWords: totalWords,
    todayReview: 0,
    todayNew: Math.min(20, totalWords),
    estimatedMinutes: Math.min(10, totalWords),
    streak: 0,
    accuracy: 0,
    averageStability: 0
  }
}

/**
 * Get today's learning session (words to review + new words)
 */
export async function getTodayLearningSession(
  bookId: string,
  userId: string,
  newLimit: number = 20,
  reviewLimit: number = 100
): Promise<TodayLearningSession> {
  if (!isSupabaseInitialized()) {
    return { reviewWords: [], newWords: [], totalCount: 0, estimatedMinutes: 0 }
  }

  const supabase = getSupabase()
  const now = new Date()

  // Get words due for review
  const { data: dueProgress } = await supabase
    .from("user_word_progress")
    .select(`
      id,
      word_id,
      state,
      stability,
      due_at,
      last_review_at,
      lapses,
      vocabulary_words!inner (
        id,
        word,
        phonetic,
        definition
      )
    `)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .lte("due_at", now.toISOString())
    .order("due_at")
    .limit(reviewLimit)

  const reviewWords: WordWithProgress[] = asWordProgressList(dueProgress).map((p) => ({
    id: p.word_id,
    word: p.vocabulary_words.word,
    phonetic: p.vocabulary_words.phonetic,
    definition: p.vocabulary_words.definition,
    state: p.state as FSRSState,
    stability: p.stability,
    due_at: p.due_at,
    last_review_at: p.last_review_at,
    lapses: p.lapses
  }))

  // Get new words (words without progress)
  const { data: allWords } = await supabase
    .from("vocabulary_words")
    .select("id, word, phonetic, definition")
    .eq("book_id", bookId)

  const { data: existingProgress } = await supabase
    .from("user_word_progress")
    .select("word_id")
    .eq("user_id", userId)
    .eq("book_id", bookId)

  const existingWordIds = new Set((existingProgress || []).map(p => p.word_id))
  const newWordsData = (allWords || [])
    .filter(w => !existingWordIds.has(w.id))
    .slice(0, newLimit)

  const newWords: WordWithProgress[] = newWordsData.map(w => ({
    id: w.id,
    word: w.word,
    phonetic: w.phonetic,
    definition: w.definition,
    state: "new" as FSRSState,
    stability: 0,
    due_at: null,
    last_review_at: null,
    lapses: 0
  }))

  const totalCount = reviewWords.length + newWords.length
  const estimatedMinutes = Math.ceil(totalCount * 0.5)

  return { reviewWords, newWords, totalCount, estimatedMinutes }
}

/**
 * Get recently learned words
 */
export async function getRecentWords(
  bookId: string,
  userId: string,
  limit: number = 5
): Promise<WordWithProgress[]> {
  if (!isSupabaseInitialized()) return []

  const supabase = getSupabase()

  const { data } = await supabase
    .from("user_word_progress")
    .select(`
      word_id,
      state,
      stability,
      due_at,
      last_review_at,
      lapses,
      vocabulary_words!inner (
        id,
        word,
        phonetic,
        definition
      )
    `)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .not("last_review_at", "is", null)
    .order("last_review_at", { ascending: false })
    .limit(limit)

  return asWordProgressList(data).map((p) => ({
    id: p.word_id,
    word: p.vocabulary_words.word,
    phonetic: p.vocabulary_words.phonetic,
    definition: p.vocabulary_words.definition,
    state: p.state as FSRSState,
    stability: p.stability,
    due_at: p.due_at,
    last_review_at: p.last_review_at,
    lapses: p.lapses
  }))
}

/**
 * Get difficult words (high lapse count or low stability)
 */
export async function getDifficultWords(
  bookId: string,
  userId: string,
  limit: number = 5
): Promise<WordWithProgress[]> {
  if (!isSupabaseInitialized()) return []

  const supabase = getSupabase()

  const { data } = await supabase
    .from("user_word_progress")
    .select(`
      word_id,
      state,
      stability,
      due_at,
      last_review_at,
      lapses,
      vocabulary_words!inner (
        id,
        word,
        phonetic,
        definition
      )
    `)
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .gt("lapses", 0)
    .order("lapses", { ascending: false })
    .order("stability", { ascending: true })
    .limit(limit)

  return asWordProgressList(data).map((p) => ({
    id: p.word_id,
    word: p.vocabulary_words.word,
    phonetic: p.vocabulary_words.phonetic,
    definition: p.vocabulary_words.definition,
    state: p.state as FSRSState,
    stability: p.stability,
    due_at: p.due_at,
    last_review_at: p.last_review_at,
    lapses: p.lapses
  }))
}

/**
 * Process a word review and update progress
 */
export async function processWordReview(
  userId: string,
  wordId: string,
  bookId: string,
  grade: SpacedRepetitionGrade
): Promise<UserWordProgress | null> {
  if (!isSupabaseInitialized()) return null

  const supabase = getSupabase()
  const rating = GRADE_TO_RATING[grade]
  const now = new Date()

  // Get current progress or create new
  let { data: progress } = await supabase
    .from("user_word_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("word_id", wordId)
    .single()

  const isNew = !progress

  if (!progress) {
    // Create initial progress
    const initial = createInitialWordProgress(userId, wordId, bookId)
    const { data: newProgress, error } = await supabase
      .from("user_word_progress")
      .insert(initial)
      .select()
      .single()

    if (error) {
      logger.error("Failed to create word progress", { userId, wordId, bookId }, error)
      return null
    }
    progress = newProgress
  }

  // Calculate new scheduling with FSRS
  const schedulingResult = fsrsScheduler.review(
    {
      state: progress.state as FSRSState,
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
  const updateData: Partial<UserWordProgress> = {
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
  const { data: updatedProgress, error: updateError } = await supabase
    .from("user_word_progress")
    .update(updateData)
    .eq("id", progress.id)
    .select()
    .single()

  if (updateError) {
    logger.error("Failed to update word progress", { userId, wordId, bookId }, updateError)
    return null
  }

  // Log the review
  await logReview(userId, wordId, bookId, progress, updatedProgress, rating, now)

  // Update book progress stats
  await updateBookProgressStats(userId, bookId, isNew)

  return updatedProgress
}

/**
 * Log a review for analytics
 */
async function logReview(
  userId: string,
  wordId: string,
  bookId: string,
  before: UserWordProgress,
  after: UserWordProgress,
  rating: FSRSRating,
  now: Date
): Promise<void> {
  if (!isSupabaseInitialized()) return

  const supabase = getSupabase()

  const logEntry: Omit<ReviewLog, 'id' | 'created_at'> = {
    user_id: userId,
    word_id: wordId,
    book_id: bookId,
    progress_id: after.id,
    rating,
    state_before: before.state,
    state_after: after.state,
    difficulty_before: before.difficulty,
    stability_before: before.stability,
    difficulty_after: after.difficulty,
    stability_after: after.stability,
    scheduled_days: after.scheduled_days,
    elapsed_days: before.elapsed_days,
    reviewed_at: now.toISOString()
  }

  await supabase.from("review_logs").insert(logEntry)
}

/**
 * Update book progress statistics after a review
 */
async function updateBookProgressStats(
  userId: string,
  bookId: string,
  isNewWord: boolean
): Promise<void> {
  if (!isSupabaseInitialized()) return

  const supabase = getSupabase()
  const today = new Date().toISOString().split('T')[0]

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
  const updateData: Partial<UserBookProgress> = {
    total_reviews: bookProgress.total_reviews + 1,
    reviews_today: isNewDay ? 1 : bookProgress.reviews_today + 1,
    new_words_today: isNewDay ? (isNewWord ? 1 : 0) : (isNewWord ? bookProgress.new_words_today + 1 : bookProgress.new_words_today),
    last_review_date: today,
    last_studied_at: new Date().toISOString(),
    streak_days: newStreak,
    updated_at: new Date().toISOString()
  }

  await supabase
    .from("user_book_progress")
    .update(updateData)
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

/**
 * Initialize user book progress when starting to learn a book
 */
export async function initializeBookProgress(
  userId: string,
  bookId: string
): Promise<UserBookProgress | null> {
  if (!isSupabaseInitialized()) return null

  const supabase = getSupabase()

  // Check if already exists
  const { data: existing } = await supabase
    .from("user_book_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .single()

  if (existing) return existing

  // Get word count
  const { data: book } = await supabase
    .from("vocabulary_books")
    .select("word_count")
    .eq("id", bookId)
    .single()

  const wordCount = book?.word_count || 0

  // Create progress
  const { data: progress, error } = await supabase
    .from("user_book_progress")
    .insert({
      user_id: userId,
      book_id: bookId,
      mastered_count: 0,
      learning_count: 0,
      new_count: wordCount,
      streak_days: 0,
      accuracy_percent: 0,
      total_reviews: 0,
      reviews_today: 0,
      new_words_today: 0,
      last_review_date: null,
      daily_new_limit: 20,
      daily_review_limit: 100
    })
    .select()
    .single()

  if (error) {
    logger.error("Failed to initialize book progress", { userId, bookId }, error)
    return null
  }
  
  logger.info("Book progress initialized", { userId, bookId, wordCount })
  return progress
}

/**
 * Get schedule preview for a word
 */
export function getWordSchedulePreview(
  progress: Pick<UserWordProgress, 'state' | 'difficulty' | 'stability' | 'learning_step' | 'is_learning_phase' | 'elapsed_days' | 'reps' | 'lapses'>
): Record<FSRSRating, string> {
  return fsrsScheduler.getSchedulePreview(progress)
}

/**
 * Format next review time for display
 */
export function formatNextReview(dueAt: string | null): string {
  if (!dueAt) return "Not scheduled"

  const due = new Date(dueAt)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()

  if (diffMs <= 0) return "Now"

  const diffMinutes = Math.round(diffMs / 60000)
  if (diffMinutes < 60) return `${diffMinutes}m`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays === 1) return "Tomorrow"
  if (diffDays < 7) return `${diffDays} days`
  if (diffDays < 30) return `${Math.round(diffDays / 7)} weeks`
  if (diffDays < 365) return `${Math.round(diffDays / 30)} months`
  
  return `${Math.round(diffDays / 365)} years`
}

