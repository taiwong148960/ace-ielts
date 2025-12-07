/**
 * Shared types for Edge Functions
 * 
 * ⚠️ SYNC REQUIRED: These types must stay in sync with:
 *    - packages/core/src/types/vocabulary.ts (frontend types)
 * 
 * When updating types here, also update the corresponding frontend types.
 * When updating frontend types, also update these Edge Function types.
 */

// ============================================================================
// Constants - MUST match packages/core/src/types/vocabulary.ts
// ============================================================================

/**
 * Book cover color presets (hex values for database storage)
 * Frontend uses Tailwind gradient classes, Edge Functions use hex colors
 */
export const BOOK_COVER_COLORS = [
  "#0D9488", // emerald/teal
  "#0EA5E9", // sky blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#F59E0B", // amber
  "#10B981", // green
  "#EF4444", // red
  "#6366F1"  // indigo
]

/**
 * Default book settings
 * @sync packages/core/src/types/vocabulary.ts - DEFAULT_BOOK_SETTINGS
 */
export const DEFAULT_BOOK_SETTINGS = {
  daily_new_limit: 20,
  daily_review_limit: 60,
  learning_mode: "read_only" as const,  // Changed from "recognition" to match frontend
  study_order: "sequential" as const     // Changed from "order" to match frontend
}

/**
 * FSRS algorithm default parameters (FSRS-4.5)
 * @sync packages/core/src/types/vocabulary.ts - DEFAULT_FSRS_PARAMS
 */
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

/**
 * Learning phase steps (in minutes)
 * @sync packages/core/src/types/vocabulary.ts - LEARNING_STEPS
 */
export const LEARNING_STEPS: Record<number, number> = {
  1: 1,    // Again: 1 minute
  2: 5,    // Hard: 5 minutes  
  3: 10,   // Good: 10 minutes
  4: 60    // Easy: 1 hour (changed from 0 to match frontend)
}

/**
 * Number of steps required to graduate from learning phase
 * @sync packages/core/src/types/vocabulary.ts - LEARNING_GRADUATION_STEPS
 */
export const LEARNING_GRADUATION_STEPS = 2

// ============================================================================
// Input Types for Edge Functions
// ============================================================================

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

/**
 * @sync packages/core/src/types/vocabulary.ts - UpdateBookSettingsInput
 */
export interface UpdateBookSettingsInput {
  daily_new_limit?: number
  daily_review_limit?: number
  learning_mode?: "read_only" | "spelling"  // Changed from "recognition"
  study_order?: "sequential" | "random"      // Changed from "order" | "random" | "difficulty"
}

export interface ProcessReviewInput {
  wordId: string
  bookId: string
  grade: 1 | 2 | 3 | 4  // Again, Hard, Good, Easy
}

// ============================================================================
// FSRS Types
// ============================================================================

/**
 * FSRS Card State
 * @sync packages/core/src/types/vocabulary.ts - FSRSState
 * - new: Never reviewed
 * - learning: In short-term learning phase (minutes-based)
 * - review: Graduated to long-term review (days-based)
 * - relearning: Failed review, back to learning phase
 */
export type FSRSState = "new" | "learning" | "review" | "relearning"

/**
 * FSRS Rating (1-4 scale)
 * @sync packages/core/src/types/vocabulary.ts - FSRSRating
 * 1 = Again (forgot), 2 = Hard, 3 = Good, 4 = Easy
 */
export type FSRSRating = 1 | 2 | 3 | 4

/**
 * Scheduling result from FSRS calculation
 * @sync packages/core/src/types/vocabulary.ts - SchedulingResult
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
