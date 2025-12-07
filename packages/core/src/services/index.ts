/**
 * Services barrel export
 */
export { dashboardApi, configureApi } from "./api"
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
  vocabularyApi,
  getSystemBooks,
  getUserBooks,
  getUserBooksWithProgress,
  getSystemBooksWithProgress,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getBookWords,
  addWords,
  deleteWord,
  getBookProgress,
  getBookSettings,
  updateBookSettings
} from "./vocabulary"
export type { IVocabularyApi } from "./vocabulary"

// FSRS Spaced Repetition
export { FSRSScheduler, fsrsScheduler, createInitialWordProgress, stateToMasteryLevel } from "./fsrs"

// Vocabulary Detail
export {
  getBookWithDetails,
  getTodayLearningSession,
  getRecentWords,
  getDifficultWords,
  processWordReview,
  initializeBookProgress,
  getWordSchedulePreview,
  formatNextReview
} from "./vocabulary-detail"

// Vocabulary Import
export {
  startImport,
  getImportProgress,
  retryFailedWords,
  getFailedWordsErrors
} from "./vocabulary-import"

// Gemini API
export {
  enrichWord,
  enrichWordWithRetry,
  generateAudio,
  generateWordAudio,
  generateExampleAudios,
  type GeminiConfig
} from "./gemini"

// User Settings
export {
  getUserSettings,
  getOrCreateUserSettings,
  updateUserSettings,
  getLLMApiKey,
  hasLLMApiKey
} from "./user-settings"

