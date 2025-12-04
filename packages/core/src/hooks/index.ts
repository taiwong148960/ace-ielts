/**
 * Shared React Hooks
 * Platform-agnostic hooks for common functionality
 */

export {
  usePlatform,
  useStorage,
  useNavigation,
  useEnvironment,
  usePlatformType
} from "../adapters/context"

// Re-export i18n hook from react-i18next
export { useTranslation } from "react-i18next"

// TanStack Query hooks
export { useVocabularyBooks, useInvalidateVocabularyBooks } from "./useVocabularyBooks"
export { useBookSettings } from "./useBookSettings"
export { useBookDetail, useInvalidateBookDetail, formatWordForDisplay } from "./useBookDetail"
export type { UseBookDetailReturn, BookDetailData } from "./useBookDetail"
export { useDashboardData, useTakeawayStats } from "./useDashboardData"
export { useCreateBook } from "./useCreateBook"
export { useVocabularyImport } from "./useVocabularyImport"
export { useUserSettings } from "./useUserSettings"
