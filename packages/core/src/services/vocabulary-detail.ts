/**
 * Vocabulary Detail Service
 * Handles book detail page data, learning sessions, and spaced repetition
 */

import { getSupabase, isSupabaseInitialized } from "./supabase"
import type {
  VocabularyBook,
  UserWordProgress,
  UserBookProgress,
  BookDetailStats,
  WordWithProgress,
  TodayLearningSession,
} from "../types/vocabulary"
import { GRADE_TO_RATING, type SpacedRepetitionGrade } from "../types/vocabulary"
import { createLogger } from "../utils/logger"

// Create logger for this service
const logger = createLogger("VocabularyDetailService")

/**
 * Get a book with full details for the book detail page
 * Calls Edge Function: vocabulary-get-book-details
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
  
  logger.debug("Fetching book details via Edge Function", { bookId, userId })

  const { data, error } = await supabase.functions.invoke('vocabulary-get-book-details', {
    body: { bookId }
  })

  if (error || !data?.success) {
    logger.error("Failed to fetch book details via Edge Function", { bookId, userId }, error)
    return null
  }

  return data.data as {
    book: VocabularyBook
    progress: UserBookProgress | null
    stats: BookDetailStats
  }
}

/**
 * Get today's learning session (words to review + new words)
 * Calls Edge Function: vocabulary-get-learning-session
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
  
  logger.debug("Fetching learning session via Edge Function", { bookId, userId, newLimit, reviewLimit })

  const { data, error } = await supabase.functions.invoke('vocabulary-get-learning-session', {
    body: { bookId, newLimit, reviewLimit }
  })

  if (error || !data?.success) {
    logger.warn("Failed to get learning session via Edge Function", { bookId, userId }, error)
    return { reviewWords: [], newWords: [], totalCount: 0, estimatedMinutes: 0 }
  }

  return data.data as TodayLearningSession
}

/**
 * Get recently learned words
 * Calls Edge Function: vocabulary-get-recent-words
 */
export async function getRecentWords(
  bookId: string,
  userId: string,
  limit: number = 5
): Promise<WordWithProgress[]> {
  if (!isSupabaseInitialized()) return []

  const supabase = getSupabase()
  
  logger.debug("Fetching recent words via Edge Function", { bookId, userId, limit })

  const { data, error } = await supabase.functions.invoke('vocabulary-get-recent-words', {
    body: { bookId, limit }
  })

  if (error || !data?.success) {
    logger.warn("Failed to get recent words via Edge Function", { bookId, userId }, error)
    return []
  }

  return data.data as WordWithProgress[]
}

/**
 * Get difficult words (high lapse count or low stability)
 * Calls Edge Function: vocabulary-get-difficult-words
 */
export async function getDifficultWords(
  bookId: string,
  userId: string,
  limit: number = 5
): Promise<WordWithProgress[]> {
  if (!isSupabaseInitialized()) return []

  const supabase = getSupabase()
  
  logger.debug("Fetching difficult words via Edge Function", { bookId, userId, limit })

  const { data, error } = await supabase.functions.invoke('vocabulary-get-difficult-words', {
    body: { bookId, limit }
  })

  if (error || !data?.success) {
    logger.warn("Failed to get difficult words via Edge Function", { bookId, userId }, error)
    return []
  }

  return data.data as WordWithProgress[]
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
 * 
 * Note: This function has been removed as the FSRS algorithm is now handled
 * entirely by Supabase Edge Functions. If schedule preview is needed in the UI,
 * it should be implemented as an Edge Function endpoint.
 */

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

