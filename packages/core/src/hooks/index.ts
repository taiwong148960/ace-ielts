/**
 * Shared React Hooks
 * Platform-agnostic hooks for common functionality
 */

export {
  useEnvironment,
  useNavigation,
  usePlatform,
  usePlatformType,
  useStorage,
} from "../adapters/context";

// Re-export i18n hook from react-i18next
export { useTranslation } from "react-i18next";

// TanStack Query hooks
export {
  useInvalidateVocabularyBooks,
  useVocabularyBooks,
} from "./useVocabularyBooks";
export { useBookSettings } from "./useBookSettings";
export {
  formatWordForDisplay,
  useBookDetail,
  useInvalidateBookDetail,
} from "./useBookDetail";
export type { BookDetailData, UseBookDetailReturn } from "./useBookDetail";
export { useDashboardData, useTakeawayStats } from "./useDashboardData";
export { useCreateBook } from "./useCreateBook";
export { useVocabularyImport } from "./useVocabularyImport";
export { useUserSettings } from "./useUserSettings";
export { useVocabularyLearning } from "./useVocabularyLearning";
