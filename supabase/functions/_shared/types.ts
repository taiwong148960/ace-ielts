/**
 * Shared types for Edge Functions
 */

// Book cover colors
export const BOOK_COVER_COLORS = [
  "#0D9488", "#0EA5E9", "#8B5CF6", "#EC4899", 
  "#F59E0B", "#10B981", "#EF4444", "#6366F1"
]

// Default book settings
export const DEFAULT_BOOK_SETTINGS = {
  daily_new_limit: 20,
  daily_review_limit: 60,
  learning_mode: "recognition" as const,
  study_order: "order" as const
}

// FSRS default parameters
export const DEFAULT_FSRS_PARAMS = {
  requestRetention: 0.9,
  maximumInterval: 365,
  w: [
    0.4, 0.6, 2.4, 5.8,
    4.93, 0.94, 0.86, 0.01,
    1.49, 0.14, 0.94, 2.18,
    0.05, 0.34, 1.26, 0.29, 2.61
  ]
}

// Learning steps in minutes
export const LEARNING_STEPS: Record<number, number> = {
  1: 1,    // Again: 1 minute
  2: 5,    // Hard: 5 minutes  
  3: 10,   // Good: 10 minutes
  4: 0     // Easy: graduate immediately
}

export const LEARNING_GRADUATION_STEPS = 2

// Types
export interface CreateBookInput {
  name: string
  description?: string
  cover_color?: string
  cover_text?: string
  book_type?: string
  words: string[]
}

export interface UpdateBookInput {
  name?: string
  description?: string
  cover_color?: string
  cover_text?: string
}

export interface UpdateBookSettingsInput {
  daily_new_limit?: number
  daily_review_limit?: number
  learning_mode?: "recognition" | "spelling"
  study_order?: "order" | "random" | "difficulty"
}

export interface ProcessReviewInput {
  wordId: string
  bookId: string
  grade: 1 | 2 | 3 | 4  // Again, Hard, Good, Easy
}

export type FSRSState = "new" | "learning" | "review" | "relearning"
export type FSRSRating = 1 | 2 | 3 | 4

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
