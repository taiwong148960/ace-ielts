/**
 * Vocabulary Types
 * Type definitions for vocabulary books and words
 * Includes FSRS (Free Spaced Repetition Scheduler) compatible types
 *
 * ⚠️ SYNC REQUIRED: Some types/constants must stay in sync with:
 *    - supabase/functions/_shared/types.ts (Edge Function types)
 *
 * Types marked with @sync should be kept aligned with the corresponding
 * Edge Function types when modified.
 */

/**
 * Vocabulary book category/type
 */
export type VocabularyBookType = "ielts" | "academic" | "business" | "custom";

/**
 * Word mastery level for spaced repetition (legacy)
 */
export type WordMasteryLevel = "new" | "learning" | "reviewing" | "mastered";

/**
 * FSRS Card State
 * @sync supabase/functions/_shared/types.ts - FSRSState
 * - new: Never reviewed
 * - learning: In short-term learning phase (minutes-based)
 * - review: Graduated to long-term review (days-based)
 * - relearning: Failed review, back to learning phase
 */
export type FSRSState = "new" | "learning" | "review" | "relearning";

/**
 * FSRS Rating (1-4 scale)
 * @sync supabase/functions/_shared/types.ts - FSRSRating
 * 1 = Again (forgot), 2 = Hard, 3 = Good, 4 = Easy
 */
export type FSRSRating = 1 | 2 | 3 | 4;

/**
 * Map UI grade to FSRS rating
 */
export const GRADE_TO_RATING: Record<SpacedRepetitionGrade, FSRSRating> = {
  forgot: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

/**
 * Vocabulary book - represents a collection of words
 */
export interface VocabularyBook {
  id: string;
  name: string;
  description: string | null;
  cover_color: string;
  cover_text?: string | null;
  book_type: VocabularyBookType;
  is_system_book: boolean;
  user_id: string | null; // null for system books
  word_count: number;
  import_status: ImportStatus | null;
  import_progress: number | null;
  import_total: number | null;
  import_started_at: string | null;
  import_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Example sentence audio data
 */
export interface ExampleAudioData {
  sentence: string;
  audio_path: string;
}

export interface WordDefinition {
  partOfSpeech: string;
  meaning: string;
  translation?: string;
  context?: string;
}

export interface WordExample {
  sentence: string;
  source: string;
  translation?: string;
  audio_path?: string;
}

export interface ConfusedWord {
  word: string;
  difference: string;
}

export interface VocabularyWordMeta {
  frequency: string;
  topic: string;
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  word_family: string[];
}

export interface VocabularyWordForms {
  base: string | null;
  past: string | null;
  past_participle: string | null;
  present_participle: string | null;
  plural: string | null;
  comparative: string | null;
  superlative: string | null;
  tenses: string[];
}

/**
 * Vocabulary word - individual word entry
 */
export interface VocabularyWord {
  id: string;
  book_id: string;
  word: string;
  phonetic: string | null;
  definition: string | null;
  example_sentence: string | null;
  notes: string | null;

  // New flattened fields
  usage_frequency: string | null;
  synonyms: string[] | null;
  antonyms: string[] | null;
  collocations: string[] | null;
  word_family: string[] | null;
  topic: string | null;
  tenses: string[] | null;

  rw_base_form: string | null;
  rw_comparative: string | null;
  rw_superlative: string | null;
  rw_past_tense: string | null;
  rw_past_participle: string | null;
  rw_present_participle: string | null;
  rw_plural: string | null;

  // Joined/Computed fields
  definitions: WordDefinition[] | null;
  examples: WordExample[] | null;
  confused_words: ConfusedWord[] | null;

  word_audio_path: string | null; // Storage path for word audio pronunciation
  import_status: ImportStatus | null;
  created_at: string;
  updated_at: string;
}

/**
 * User's progress on a specific word (FSRS-compatible)
 */
export interface UserWordProgress {
  id: string;
  user_id: string;
  word_id: string;
  book_id: string;

  // FSRS Core Parameters
  state: FSRSState;
  difficulty: number; // D: [0, 10], initial difficulty
  stability: number; // S: memory stability in days
  retrievability: number; // R: probability of recall (0-1)

  // FSRS Card State
  elapsed_days: number; // Days since last review
  scheduled_days: number; // Days until next review
  reps: number; // Total successful review count
  lapses: number; // Times forgotten (Again count)

  // Short-term Learning Phase
  learning_step: number; // Current step in learning sequence (0, 1, 2...)
  is_learning_phase: boolean; // In short-term phase (minutes)

  // Scheduling
  last_review_at: string | null; // Last review timestamp
  due_at: string; // When this card is due for review

  // Statistics
  total_reviews: number;
  correct_reviews: number;

  created_at: string;
  updated_at: string;
}

/**
 * Review log entry for analytics
 */
export interface ReviewLog {
  id: string;
  user_id: string;
  word_id: string;
  book_id: string;
  progress_id: string;

  rating: FSRSRating;
  state_before: FSRSState;
  state_after: FSRSState;

  difficulty_before: number;
  stability_before: number;
  difficulty_after: number;
  stability_after: number;

  scheduled_days: number;
  elapsed_days: number;
  review_time_ms?: number;

  reviewed_at: string;
  created_at: string;
}

/**
 * User's subscription/progress on a vocabulary book
 */
export interface UserBookProgress {
  id: string;
  user_id: string;
  book_id: string;
  mastered_count: number;
  learning_count: number;
  new_count: number;
  last_studied_at: string | null;
  streak_days: number;
  accuracy_percent: number;

  // Daily limits and counters
  total_reviews: number;
  reviews_today: number;
  new_words_today: number;
  last_review_date: string | null;
  daily_new_limit: number;
  daily_review_limit: number;

  created_at: string;
  updated_at: string;
}

/**
 * FSRS Parameters (configurable)
 */
export interface FSRSParameters {
  requestRetention: number; // Target retention rate (default: 0.9)
  maximumInterval: number; // Max days between reviews (default: 365)
  w: number[]; // Weight parameters for FSRS-4.5
}

/**
 * Default FSRS parameters (FSRS-4.5)
 */
export const DEFAULT_FSRS_PARAMS: FSRSParameters = {
  requestRetention: 0.9,
  maximumInterval: 365,
  // FSRS-4.5 default weights
  w: [
    0.4,
    0.6,
    2.4,
    5.8,
    4.93,
    0.94,
    0.86,
    0.01,
    1.49,
    0.14,
    0.94,
    2.18,
    0.05,
    0.34,
    1.26,
    0.29,
    2.61,
  ],
};

/**
 * Learning phase steps (in minutes)
 * Users must pass through these before entering day-based scheduling
 */
export const LEARNING_STEPS: Record<FSRSRating, number> = {
  1: 1, // Again: 1 minute
  2: 5, // Hard: 5 minutes
  3: 10, // Good: 10 minutes
  4: 60, // Easy: 1 hour (skip to next step or graduate)
};

/**
 * Number of steps required to graduate from learning phase
 */
export const LEARNING_GRADUATION_STEPS = 2;

/**
 * Combined book data with user progress
 */
export interface VocabularyBookWithProgress extends VocabularyBook {
  progress?: UserBookProgress;
}

/**
 * Combined word data with user progress
 */
export interface VocabularyWordWithProgress extends VocabularyWord {
  progress?: UserWordProgress;
}

/**
 * Create vocabulary book input
 */
export interface CreateVocabularyBookInput {
  name: string;
  description?: string;
  cover_color?: string;
  cover_text?: string;
  book_type?: VocabularyBookType;
  words: string[]; // Array of words/phrases to add
}

/**
 * Update vocabulary book input
 */
export interface UpdateVocabularyBookInput {
  name?: string;
  description?: string;
  cover_color?: string;
  cover_text?: string;
}

/**
 * Spaced repetition grade for reviewing words
 */
export type SpacedRepetitionGrade = "forgot" | "hard" | "good" | "easy";

/**
 * Review session result
 */
export interface ReviewResult {
  word_id: string;
  grade: SpacedRepetitionGrade;
  reviewed_at: string;
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
  "bg-gradient-to-br from-green-500 to-emerald-600",
] as const;

/**
 * Default cover color for new books
 */
export const DEFAULT_BOOK_COVER_COLOR = BOOK_COVER_COLORS[3];

/**
 * Book detail statistics
 */
export interface BookDetailStats {
  totalWords: number;
  mastered: number;
  learning: number;
  newWords: number;
  todayReview: number;
  todayNew: number;
  estimatedMinutes: number;
  streak: number;
  accuracy: number;
  averageStability: number;
}

/**
 * Word with progress info for display
 */
export interface WordWithProgress {
  id: string;
  word: string;
  phonetic: string | null;
  definition: string | null;
  // Extended fields for word display
  definitions: WordDefinition[] | null;
  examples: WordExample[] | null;
  synonyms: string[];
  antonyms: string[];
  confused_words: ConfusedWord[] | null;
  word_family: string[];
  collocations: string[];
  topic: string | null;
  tenses: string[];
  word_audio_path: string | null; // Storage path for word audio pronunciation
  // FSRS state fields
  state: FSRSState;
  stability: number;
  due_at: string | null;
  last_review_at: string | null;
  lapses: number;
}

/**
 * Today's learning session data
 */
export interface TodayLearningSession {
  reviewWords: WordWithProgress[];
  newWords: WordWithProgress[];
  totalCount: number;
  estimatedMinutes: number;
}

/**
 * Scheduling result from FSRS calculation
 */
export interface SchedulingResult {
  state: FSRSState;
  difficulty: number;
  stability: number;
  retrievability: number;
  elapsed_days: number;
  scheduled_days: number;
  due_at: Date;
  learning_step: number;
  is_learning_phase: boolean;
}

/**
 * Study order type
 */
export type StudyOrder = "sequential" | "random";

/**
 * Learning mode type
 */
export type LearningMode = "read_only" | "spelling";

/**
 * Book settings - user-specific settings for vocabulary books
 */
export interface BookSettings {
  id: string;
  user_id: string;
  book_id: string;
  daily_new_limit: number;
  daily_review_limit: number;
  learning_mode: LearningMode;
  study_order: StudyOrder;
  created_at: string;
  updated_at: string;
}

/**
 * Default book settings
 */
export const DEFAULT_BOOK_SETTINGS: Omit<
  BookSettings,
  "id" | "user_id" | "book_id" | "created_at" | "updated_at"
> = {
  daily_new_limit: 20,
  daily_review_limit: 60, // 3x of daily_new_limit
  learning_mode: "read_only",
  study_order: "sequential",
};

/**
 * Update book settings input
 * All fields are required - full configuration must be provided on update
 */
export interface UpdateBookSettingsInput {
  daily_new_limit: number;
  daily_review_limit: number;
  learning_mode: LearningMode;
  study_order: StudyOrder;
}

/**
 * Import status for vocabulary book import workflow
 */
export type ImportStatus = "pending" | "importing" | "done" | "failed";

/**
 * Import progress tracking
 */
export interface ImportProgress {
  status: ImportStatus | null;
  current: number;
  total: number;
  startedAt?: string;
  completedAt?: string;
}

/**
 * TTS (Text-to-Speech) voice configuration
 */
export type TTSVoice =
  | "en-US-Neural2-A" // Female, friendly
  | "en-US-Neural2-B" // Female, energetic
  | "en-US-Neural2-C" // Male, calm
  | "en-US-Neural2-D" // Male, warm
  | "en-US-Neural2-E" // Female, cheerful
  | "en-US-Neural2-F" // Female, professional
  | "en-US-Neural2-G" // Female, soft
  | "en-US-Neural2-H" // Male, deep
  | "en-US-Neural2-I" // Male, friendly
  | "en-US-Neural2-J"; // Female, clear

/**
 * Audio generation configuration
 */
export interface AudioConfig {
  voice: TTSVoice;
  speakingRate?: number; // 0.25 to 4.0, default 1.0
  pitch?: number; // -20.0 to 20.0, default 0.0
  volumeGainDb?: number; // -96.0 to 16.0, default 0.0
}

/**
 * Default audio configuration
 */
export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  voice: "en-US-Neural2-F", // Professional female voice
  speakingRate: 1.0,
  pitch: 0.0,
  volumeGainDb: 0.0,
};

/**
 * Supported Gemini text models
 */
export type GeminiTextModel =
  | "gemini-3-flash-preview"
  | "gemini-3-pro-preview";

/**
 * Supported Gemini TTS (Text-to-Speech) models
 */
export type GeminiTTSModel =
  | "gemini-2.5-flash-preview-tts"
  | "gemini-2.5-pro-preview-tts";

/**
 * Gemini text model generation configuration
 */
export interface GeminiTextModelConfig {
  model: GeminiTextModel;
  temperature?: number; // 0.0 to 2.0, default 0.7
  topK?: number; // 1 to 40, default 40
  topP?: number; // 0.0 to 1.0, default 0.95
  maxOutputTokens?: number; // 1 to 8192, default 2048
}

/**
 * Gemini TTS model configuration
 */
export interface GeminiTTSModelConfig {
  model: GeminiTTSModel;
  // Additional TTS parameters can be added here
}

/**
 * Default Gemini text model configuration
 */
export const DEFAULT_GEMINI_TEXT_MODEL_CONFIG: GeminiTextModelConfig = {
  model: "gemini-3-flash-preview",
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 4096,
};

/**
 * Default Gemini TTS model configuration
 */
export const DEFAULT_GEMINI_TTS_MODEL_CONFIG: GeminiTTSModelConfig = {
  model: "gemini-2.5-flash-preview-tts",
};
