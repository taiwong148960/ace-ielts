/**
 * Services barrel export
 */
export { dashboardApi } from "./api"
export type { IDashboardApi } from "./api"

// Supabase
export {
  initializeSupabase,
  getSupabase,
  isSupabaseInitialized,
  type SupabaseConfig
} from "./supabase"

// Auth
export {
  signInWithOAuth,
  signOut,
  getSession,
  getCurrentUser,
  refreshSession,
  onAuthStateChange
} from "./auth"

// Vocabulary
export {
  getUserBooksWithProgress,
  getSystemBooksWithProgress,
  createBook,
  updateBook,
  deleteBook,
  getBookWords,
  addWords,
  deleteWord,
  getBookSettings,
  updateBookSettings
} from "./vocabulary"

// FSRS Spaced Repetition (utility functions only - algorithm is in Edge Functions)
export { stateToMasteryLevel } from "./fsrs"

// Vocabulary Detail
export {
  getBookWithDetails,
  getTodayLearningSession,
  getRecentWords,
  getDifficultWords,
  processWordReview,
  initializeBookProgress,
  formatNextReview
} from "./vocabulary-detail"

// Vocabulary Import
export {
  getImportProgress
} from "./vocabulary-import"


// User Settings
export {
  getUserSettings,
  getOrCreateUserSettings,
  updateUserSettings,
  getLLMApiKey,
  hasLLMApiKey
} from "./user-settings"

