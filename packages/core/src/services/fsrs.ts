/**
 * FSRS (Free Spaced Repetition Scheduler) Utility Functions
 * 
 * Note: The full FSRS algorithm implementation is in Supabase Edge Functions.
 * This file only contains frontend utility functions for display purposes.
 * 
 * Reference: https://github.com/open-spaced-repetition/fsrs4anki
 */

import type { FSRSState } from "../types/vocabulary"

/**
 * Convert FSRSState to display mastery level
 * 
 * This is a simple utility function for UI display.
 * The actual FSRS algorithm is implemented in Edge Functions.
 */
export function stateToMasteryLevel(state: FSRSState, stability: number): "new" | "learning" | "mastered" {
  if (state === "new") return "new"
  if (state === "review" && stability > 21) return "mastered" // Stable for 3+ weeks
  return "learning"
}

