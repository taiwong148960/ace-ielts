/**
 * Vocabulary Detail Service
 * Handles book detail page data, learning sessions, and spaced repetition
 */

import { isSupabaseInitialized } from "./supabase"
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
import { fetchEdge } from "../utils/edge-client"

// Create logger for this service
const logger = createLogger("VocabularyDetailService")

/**
 * Get a book with full details for the book detail page
 * Calls Edge Function: vocabulary-books
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

  logger.debug("Fetching book details via Edge Function", { bookId, userId })

  try {
    const book = await fetchEdge<VocabularyBook>("vocabulary-books", `/${bookId}`)
    
    // We fetch progress as part of the book request in the new API
    // but the frontend type expects it separated.
    // The edge function returns { ...book, progress }
    const progress = (book as VocabularyBook & { progress?: UserBookProgress }).progress || null
    
    // Calculate stats on client or fetch if needed
    // For now we mock empty stats or we could add a stats endpoint
    const stats: BookDetailStats = {
      totalWords: book.word_count || 0,
      mastered: progress?.mastered_count || 0,
      learning: progress?.learning_count || 0,
      newWords: progress?.new_count || 0,
      todayReview: progress?.reviews_today || 0,
      todayNew: progress?.new_words_today || 0,
      estimatedMinutes: 0,
      streak: progress?.streak_days || 0,
      accuracy: progress?.accuracy_percent || 0,
      averageStability: 0
    }

    return { book, progress, stats }
  } catch (error) {
    logger.error("Failed to fetch book details", { bookId, userId }, error as Error)
    return null
  }
}

/**
 * Get today's learning session (words to review + new words)
 * Calls Edge Function: vocabulary-study
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

  logger.debug("Fetching learning session via Edge Function", { bookId, userId, newLimit, reviewLimit })

  try {
    return await fetchEdge<TodayLearningSession>("vocabulary-study", "/session", {
      query: { bookId, newLimit, reviewLimit }
    })
  } catch (error) {
    logger.warn("Failed to get learning session", { bookId, userId }, error as Error)
    return { reviewWords: [], newWords: [], totalCount: 0, estimatedMinutes: 0 }
  }
}

/**
 * Get recently learned words
 * Calls Edge Function: vocabulary-study
 */
export async function getRecentWords(
  bookId: string,
  userId: string,
  limit: number = 5
): Promise<WordWithProgress[]> {
  if (!isSupabaseInitialized()) return []

  logger.debug("Fetching recent words via Edge Function", { bookId, userId, limit })

  try {
    return await fetchEdge<WordWithProgress[]>("vocabulary-study", "/recent", {
      query: { bookId, limit }
    })
  } catch (error) {
    logger.warn("Failed to get recent words", { bookId, userId }, error as Error)
    return []
  }
}

/**
 * Get difficult words (high lapse count or low stability)
 * Calls Edge Function: vocabulary-study
 */
export async function getDifficultWords(
  bookId: string,
  userId: string,
  limit: number = 5
): Promise<WordWithProgress[]> {
  if (!isSupabaseInitialized()) return []

  logger.debug("Fetching difficult words via Edge Function", { bookId, userId, limit })

  try {
    return await fetchEdge<WordWithProgress[]>("vocabulary-study", "/difficult", {
      query: { bookId, limit }
    })
  } catch (error) {
    logger.warn("Failed to get difficult words", { bookId, userId }, error as Error)
    return []
  }
}

/**
 * Process a word review and update progress
 * Calls Edge Function: vocabulary-study
 */
export async function processWordReview(
  userId: string,
  wordId: string,
  bookId: string,
  grade: SpacedRepetitionGrade
): Promise<UserWordProgress | null> {
  if (!isSupabaseInitialized()) return null

  logger.info("Processing word review via Edge Function", { userId, wordId, bookId, grade })

  try {
    const data = await fetchEdge<UserWordProgress>("vocabulary-study", "/review", {
      method: "POST",
      body: {
        wordId,
        bookId,
        grade: GRADE_TO_RATING[grade]
      }
    })
    logger.info("Word review processed", { userId, wordId, bookId })
    return data
  } catch (error) {
    logger.error("Failed to process review", { userId, wordId, bookId }, error as Error)
    return null
  }
}

/**
 * Initialize user book progress when starting to learn a book
 * Calls Edge Function: vocabulary-study
 */
export async function initializeBookProgress(
  userId: string,
  bookId: string
): Promise<UserBookProgress | null> {
  if (!isSupabaseInitialized()) return null

  logger.info("Initializing book progress via Edge Function", { userId, bookId })

  try {
    const data = await fetchEdge<UserBookProgress>("vocabulary-study", "/init", {
      method: "POST",
      body: { bookId }
    })
    logger.info("Book progress initialized", { userId, bookId })
    return data
  } catch (error) {
    logger.error("Failed to initialize book progress", { userId, bookId }, error as Error)
    return null
  }
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
