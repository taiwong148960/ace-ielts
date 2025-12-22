/**
 * @ace-ielts/core
 * Shared core package for AceIELTS application
 * Contains types, services, hooks, i18n, utils, config, and platform adapters
 */

// Types
export * from "./types"

// Services
export * from "./services"

// Utils
export * from "./utils"

// Hooks
export * from "./hooks"

// Config
export * from "./config"

// TanStack Query
export { QueryClient, QueryClientProvider, createQueryClient, queryKeys } from "./query"

// i18n
export { 
  i18n, 
  changeLanguage, 
  initI18nWithStorage,
  setLanguageStorageAdapter,
  SUPPORTED_LANGUAGES
} from "./i18n"
export type { LanguageCode, LanguageStorageAdapter } from "./i18n"

// Platform Adapters
export * from "./adapters"

