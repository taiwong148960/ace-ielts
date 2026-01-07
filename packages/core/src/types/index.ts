/**
 * Type definitions for the AceIELTS application
 * These types define the data structures used throughout the app
 */

// Auth types
export type {
  OAuthProvider,
  AuthState,
  AuthContextValue,
  AppUserProfile
} from "./auth"
export { userToProfile } from "./auth"

// Vocabulary types
export type {
  VocabularyBookType,
  WordMasteryLevel,
  VocabularyBook,
  VocabularyWord,
  UserWordProgress,
  UserBookProgress,
  VocabularyBookWithProgress,
  VocabularyWordWithProgress,
  CreateVocabularyBookInput,
  UpdateVocabularyBookInput,
  SpacedRepetitionGrade,
  ReviewResult,
  // FSRS types
  FSRSState,
  FSRSRating,
  FSRSParameters,
  ReviewLog,
  BookDetailStats,
  WordWithProgress,
  TodayLearningSession,
  SchedulingResult,
  BookSettings,
  UpdateBookSettingsInput,
  StudyOrder,
  LearningMode,
  ImportStatus,
  ImportProgress,
  GeminiTextModel,
  GeminiTTSModel,
  GeminiTextModelConfig,
  GeminiTTSModelConfig
} from "./vocabulary"
export {
  BOOK_COVER_COLORS,
  DEFAULT_BOOK_COVER_COLOR,
  GRADE_TO_RATING,
  DEFAULT_FSRS_PARAMS,
  LEARNING_STEPS,
  LEARNING_GRADUATION_STEPS,
  DEFAULT_BOOK_SETTINGS,
  DEFAULT_GEMINI_TEXT_MODEL_CONFIG,
  DEFAULT_GEMINI_TTS_MODEL_CONFIG
} from "./vocabulary"

/**
 * User profile information
 */
export interface UserProfile {
  id: string
  name: string
  email: string
  avatarUrl?: string
  goalBand: number
  currentLevel: number
  joinedDate: string
}

/**
 * Daily streak and study time information
 */
export interface StudyStats {
  dayStreak: number
  todayMinutes: number
  totalMinutes: number
}

/**
 * Individual skill score
 */
export interface SkillScore {
  skill: "listening" | "reading" | "writing" | "speaking"
  score: number
  maxScore: number
  hasWarning?: boolean
}

/**
 * Skills breakdown for the dashboard
 */
export interface SkillsBreakdown {
  skills: SkillScore[]
}

/**
 * Practice task item
 */
export interface PracticeTask {
  id: string
  type: "writing" | "vocabulary" | "reading" | "listening" | "speaking" | "grammar"
  title: string
  duration: number // in minutes
  completed: boolean
  priority: "high" | "medium" | "low"
}

/**
 * Takeaway statistics
 */
export interface TakeawayStats {
  wordsViewed: number
  articlesRead: number
  videosWatched: number
  timeRange: "day" | "week" | "month" | "all"
}

/**
 * Browsing history item for takeaway card
 */
export interface BrowsingHistoryItem {
  id: string
  type: "word" | "article" | "video"
  title: string
  source?: string
  timestamp: string
  url?: string
}

/**
 * Last mock test status
 */
export interface MockTestStatus {
  daysSinceLastTest: number
  lastTestScore?: number
  lastTestDate?: string
}

/**
 * Blog article for the blog card
 */
export interface BlogArticle {
  id: string
  title: string
  url: string
  thumbnailUrl?: string
  category?: string
  readTimeMinutes: number
  publishedAt: string
}

/**
 * Complete dashboard data
 */
export interface DashboardData {
  user: UserProfile
  studyStats: StudyStats
  skillsBreakdown: SkillsBreakdown
  practiceTasks: PracticeTask[]
  takeawayStats: TakeawayStats
  browsingHistory: BrowsingHistoryItem[]
  mockTestStatus: MockTestStatus
  blogArticles: BlogArticle[]
}

// User Settings types
export type {
  LLMProvider,
  GeminiModelConfig,
  UserSettings,
  UpdateUserSettingsInput
} from "./user-settings"

