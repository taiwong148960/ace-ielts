/**
 * Vocabulary Types
 * Type definitions for vocabulary books and words
 * Includes FSRS (Free Spaced Repetition Scheduler) compatible types
 */

/**
 * Vocabulary book category/type
 */
export type VocabularyBookType = "ielts" | "academic" | "business" | "custom"

/**
 * Word mastery level for spaced repetition (legacy)
 */
export type WordMasteryLevel = "new" | "learning" | "reviewing" | "mastered"

/**
 * FSRS Card State
 * - new: Never reviewed
 * - learning: In short-term learning phase (minutes-based)
 * - review: Graduated to long-term review (days-based)
 * - relearning: Failed review, back to learning phase
 */
export type FSRSState = "new" | "learning" | "review" | "relearning"

/**
 * FSRS Rating (1-4 scale)
 * 1 = Again (forgot), 2 = Hard, 3 = Good, 4 = Easy
 */
export type FSRSRating = 1 | 2 | 3 | 4

/**
 * Map UI grade to FSRS rating
 */
export const GRADE_TO_RATING: Record<SpacedRepetitionGrade, FSRSRating> = {
  forgot: 1,
  hard: 2,
  good: 3,
  easy: 4
}

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
  import_status: ImportStatus | null
  import_progress: number | null
  import_total: number | null
  import_started_at: string | null
  import_completed_at: string | null
  import_error: string | null
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
  word_details: WordDetailData | null // Rich word data from Gemini API
  import_status: ImportStatus | null
  import_error: string | null
  created_at: string
  updated_at: string
}

/**
 * User's progress on a specific word (FSRS-compatible)
 */
export interface UserWordProgress {
  id: string
  user_id: string
  word_id: string
  book_id: string
  
  // FSRS Core Parameters
  state: FSRSState
  difficulty: number      // D: [0, 10], initial difficulty
  stability: number       // S: memory stability in days
  retrievability: number  // R: probability of recall (0-1)
  
  // FSRS Card State
  elapsed_days: number    // Days since last review
  scheduled_days: number  // Days until next review
  reps: number            // Total successful review count
  lapses: number          // Times forgotten (Again count)
  
  // Short-term Learning Phase
  learning_step: number   // Current step in learning sequence (0, 1, 2...)
  is_learning_phase: boolean // In short-term phase (minutes)
  
  // Scheduling
  last_review_at: string | null   // Last review timestamp
  due_at: string                  // When this card is due for review
  
  // Statistics
  total_reviews: number
  correct_reviews: number
  
  created_at: string
  updated_at: string
}

/**
 * Review log entry for analytics
 */
export interface ReviewLog {
  id: string
  user_id: string
  word_id: string
  book_id: string
  progress_id: string
  
  rating: FSRSRating
  state_before: FSRSState
  state_after: FSRSState
  
  difficulty_before: number
  stability_before: number
  difficulty_after: number
  stability_after: number
  
  scheduled_days: number
  elapsed_days: number
  review_time_ms?: number
  
  reviewed_at: string
  created_at: string
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
  
  // Daily limits and counters
  total_reviews: number
  reviews_today: number
  new_words_today: number
  last_review_date: string | null
  daily_new_limit: number
  daily_review_limit: number
  
  created_at: string
  updated_at: string
}

/**
 * FSRS Parameters (configurable)
 */
export interface FSRSParameters {
  requestRetention: number      // Target retention rate (default: 0.9)
  maximumInterval: number       // Max days between reviews (default: 365)
  w: number[]                   // Weight parameters for FSRS-4.5
}

/**
 * Default FSRS parameters (FSRS-4.5)
 */
export const DEFAULT_FSRS_PARAMS: FSRSParameters = {
  requestRetention: 0.9,
  maximumInterval: 365,
  // FSRS-4.5 default weights
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]
}

/**
 * Learning phase steps (in minutes)
 * Users must pass through these before entering day-based scheduling
 */
export const LEARNING_STEPS: Record<FSRSRating, number> = {
  1: 1,    // Again: 1 minute
  2: 5,    // Hard: 5 minutes  
  3: 10,   // Good: 10 minutes
  4: 60    // Easy: 1 hour (skip to next step or graduate)
}

/**
 * Number of steps required to graduate from learning phase
 */
export const LEARNING_GRADUATION_STEPS = 2

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

/**
 * Book detail statistics
 */
export interface BookDetailStats {
  totalWords: number
  mastered: number
  learning: number
  newWords: number
  todayReview: number
  todayNew: number
  estimatedMinutes: number
  streak: number
  accuracy: number
  averageStability: number
}

/**
 * Word with progress info for display
 */
export interface WordWithProgress {
  id: string
  word: string
  phonetic: string | null
  definition: string | null
  state: FSRSState
  stability: number
  due_at: string | null
  last_review_at: string | null
  lapses: number
}

/**
 * Today's learning session data
 */
export interface TodayLearningSession {
  reviewWords: WordWithProgress[]
  newWords: WordWithProgress[]
  totalCount: number
  estimatedMinutes: number
}

/**
 * Scheduling result from FSRS calculation
 */
export interface SchedulingResult {
  state: FSRSState
  difficulty: number
  stability: number
  retrievability: number
  elapsed_days: number
  scheduled_days: number
  due_at: Date
  learning_step: number
  is_learning_phase: boolean
}

/**
 * Study order type
 */
export type StudyOrder = "sequential" | "random"

/**
 * Learning mode type
 */
export type LearningMode = "read_only" | "spelling"

/**
 * Book settings - user-specific settings for vocabulary books
 */
export interface BookSettings {
  id: string
  user_id: string
  book_id: string
  daily_new_limit: number
  daily_review_limit: number
  learning_mode: LearningMode
  study_order: StudyOrder
  created_at: string
  updated_at: string
}

/**
 * Default book settings
 */
export const DEFAULT_BOOK_SETTINGS: Omit<BookSettings, "id" | "user_id" | "book_id" | "created_at" | "updated_at"> = {
  daily_new_limit: 20,
  daily_review_limit: 60, // 3x of daily_new_limit
  learning_mode: "read_only",
  study_order: "sequential"
}

/**
 * Update book settings input
 */
export interface UpdateBookSettingsInput {
  daily_new_limit?: number
  daily_review_limit?: number
  learning_mode?: LearningMode
  study_order?: StudyOrder
}

/**
 * Import status for vocabulary book import workflow
 */
export type ImportStatus = "pending" | "importing" | "completed" | "failed"

/**
 * Import progress tracking
 */
export interface ImportProgress {
  status: ImportStatus
  current: number
  total: number
  startedAt?: string
  completedAt?: string
  error?: string
}

/**
 * Rich word detail data from Gemini API
 */
export interface WordDetailData {
  definitions: Array<{
    partOfSpeech: string
    meaning: string
  }>
  exampleSentences: Array<{
    sentence: string
    source: "ielts" | "daily" | "movie" | "tv"
    translation?: string
  }>
  synonyms?: string[]
  antonyms?: string[]
  relatedWords?: {
    baseForm?: string
    comparative?: string
    superlative?: string
    pastTense?: string
    pastParticiple?: string
    presentParticiple?: string
    plural?: string
  }
  easilyConfused?: string[]
  usageFrequency?: "common" | "uncommon" | "rare"
  tenses?: string[] // For verbs
}
