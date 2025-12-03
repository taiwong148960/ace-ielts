/**
 * Vocabulary Types
 * Type definitions for vocabulary books and words
 */

/**
 * Vocabulary book category/type
 */
export type VocabularyBookType = "ielts" | "academic" | "business" | "custom"

/**
 * Word mastery level for spaced repetition
 */
export type WordMasteryLevel = "new" | "learning" | "reviewing" | "mastered"

/**
 * Vocabulary book - represents a collection of words
 */
export interface VocabularyBook {
  id: string
  name: string
  description: string | null
  cover_color: string
  cover_text?: string | null
  book_type: VocabularyBookType
  is_system_book: boolean
  user_id: string | null // null for system books
  word_count: number
  created_at: string
  updated_at: string
}

/**
 * Vocabulary word - individual word entry
 */
export interface VocabularyWord {
  id: string
  book_id: string
  word: string
  phonetic: string | null
  definition: string | null
  example_sentence: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/**
 * User's progress on a specific word
 */
export interface UserWordProgress {
  id: string
  user_id: string
  word_id: string
  book_id: string
  mastery_level: WordMasteryLevel
  review_count: number
  correct_count: number
  last_reviewed_at: string | null
  next_review_at: string | null
  ease_factor: number // For SM-2 algorithm
  interval_days: number // Days until next review
  created_at: string
  updated_at: string
}

/**
 * User's subscription/progress on a vocabulary book
 */
export interface UserBookProgress {
  id: string
  user_id: string
  book_id: string
  mastered_count: number
  learning_count: number
  new_count: number
  last_studied_at: string | null
  streak_days: number
  accuracy_percent: number
  created_at: string
  updated_at: string
}

/**
 * Combined book data with user progress
 */
export interface VocabularyBookWithProgress extends VocabularyBook {
  progress?: UserBookProgress
}

/**
 * Combined word data with user progress
 */
export interface VocabularyWordWithProgress extends VocabularyWord {
  progress?: UserWordProgress
}

/**
 * Create vocabulary book input
 */
export interface CreateVocabularyBookInput {
  name: string
  description?: string
  cover_color?: string
  cover_text?: string
  book_type?: VocabularyBookType
  words: string[] // Array of words/phrases to add
}

/**
 * Update vocabulary book input
 */
export interface UpdateVocabularyBookInput {
  name?: string
  description?: string
  cover_color?: string
  cover_text?: string
}

/**
 * Spaced repetition grade for reviewing words
 */
export type SpacedRepetitionGrade = "forgot" | "hard" | "good" | "easy"

/**
 * Review session result
 */
export interface ReviewResult {
  word_id: string
  grade: SpacedRepetitionGrade
  reviewed_at: string
}

/**
 * Book cover color presets
 */
export const BOOK_COVER_COLORS = [
  "bg-gradient-to-br from-emerald-500 to-teal-600",
  "bg-gradient-to-br from-violet-500 to-purple-600",
  "bg-gradient-to-br from-blue-500 to-indigo-600",
  "bg-gradient-to-br from-amber-500 to-orange-600",
  "bg-gradient-to-br from-rose-500 to-pink-600",
  "bg-gradient-to-br from-slate-600 to-slate-800",
  "bg-gradient-to-br from-cyan-500 to-blue-600",
  "bg-gradient-to-br from-green-500 to-emerald-600"
] as const

/**
 * Default cover color for new books
 */
export const DEFAULT_BOOK_COVER_COLOR = BOOK_COVER_COLORS[3]
