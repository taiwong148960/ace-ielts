/**
 * Vocabulary Detail Service
 * Handles book detail page data, learning sessions, and spaced repetition
 */

import { getSupabase, isSupabaseInitialized } from "./supabase"
import { fsrsScheduler, stateToMasteryLevel } from "./fsrs"
import type {
  VocabularyBook,
  UserWordProgress,
  UserBookProgress,
  BookDetailStats,
  WordWithProgress,
  TodayLearningSession,
  FSRSRating,
  FSRSState
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
 * Calls Edge Function: vocabulary-process-review
 */
export async function processWordReview(
  userId: string,
  wordId: string,
  bookId: string,
  grade: SpacedRepetitionGrade
): Promise<UserWordProgress | null> {
  if (!isSupabaseInitialized()) return null

  const supabase = getSupabase()
  
  logger.info("Processing word review via Edge Function", { userId, wordId, bookId, grade })

  const { data, error } = await supabase.functions.invoke('vocabulary-process-review', {
    body: {
      wordId,
      bookId,
      grade: GRADE_TO_RATING[grade]
    }
  })

  if (error) {
    logger.error("Failed to process review via Edge Function", { userId, wordId, bookId }, error)
    return null
  }

  if (!data?.success) {
    logger.error("Review processing failed", { userId, wordId, bookId, error: data?.error })
    return null
  }

  logger.info("Word review processed", { userId, wordId, bookId })
  return data.data
}

/**
 * Initialize user book progress when starting to learn a book
 * Calls Edge Function: vocabulary-init-progress
 */
export async function initializeBookProgress(
  userId: string,
  bookId: string
): Promise<UserBookProgress | null> {
  if (!isSupabaseInitialized()) return null

  const supabase = getSupabase()
  
  logger.info("Initializing book progress via Edge Function", { userId, bookId })

  const { data, error } = await supabase.functions.invoke('vocabulary-init-progress', {
    body: { bookId }
  })

  if (error) {
    logger.error("Failed to initialize book progress via Edge Function", { userId, bookId }, error)
    return null
  }

  if (!data?.success) {
    logger.error("Book progress initialization failed", { userId, bookId, error: data?.error })
    return null
  }
  
  logger.info("Book progress initialized", { userId, bookId })
  return data.data
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

