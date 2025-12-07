/**
 * TanStack Query Configuration
 * Provides QueryClient and QueryClientProvider for the application
 */

export { QueryClient, QueryClientProvider } from "@tanstack/react-query"
export type { QueryClientConfig } from "@tanstack/react-query"

/**
 * Create a configured QueryClient instance
 * Use this to create a single QueryClient for the application
 */
export function createQueryClient() {
  const { QueryClient } = require("@tanstack/react-query")
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default stale time of 5 minutes
        staleTime: 5 * 60 * 1000,
        // Retry failed requests once
        retry: 1,
        // Don't refetch on window focus by default
        refetchOnWindowFocus: false
      },
      mutations: {
        // Retry failed mutations once
        retry: 1
      }
    }
  })
}

// Query keys for consistent cache management
export const queryKeys = {
  // Vocabulary Books
  vocabularyBooks: {
    all: ["vocabularyBooks"] as const,
    user: (userId: string) => ["vocabularyBooks", "user", userId] as const,
    system: (userId: string) => ["vocabularyBooks", "system", userId] as const,
    detail: (bookId: string) => ["vocabularyBooks", "detail", bookId] as const,
    settings: (userId: string, bookId: string) => ["vocabularyBooks", "settings", userId, bookId] as const,
    words: (bookId: string) => ["vocabularyBooks", "words", bookId] as const
  },
  // Book Detail
  bookDetail: {
    all: ["bookDetail"] as const,
    byId: (bookId: string, userId: string) => ["bookDetail", bookId, userId] as const,
    recentWords: (bookId: string, userId: string) => ["bookDetail", "recentWords", bookId, userId] as const,
    difficultWords: (bookId: string, userId: string) => ["bookDetail", "difficultWords", bookId, userId] as const,
    todaySession: (bookId: string, userId: string) => ["bookDetail", "todaySession", bookId, userId] as const
  },
  // Vocabulary Import
  vocabularyImport: {
    all: ["vocabularyImport"] as const,
    progress: (bookId: string) => ["vocabularyImport", "progress", bookId] as const,
    failedWords: (bookId: string) => ["vocabularyImport", "failedWords", bookId] as const
  },
  // Dashboard
  dashboard: {
    all: ["dashboard"] as const,
    data: () => ["dashboard", "data"] as const,
    takeawayStats: (timeRange: string) => ["dashboard", "takeaway", timeRange] as const
  },
  // User Settings
  userSettings: {
    all: ["userSettings"] as const,
    byUser: (userId: string) => ["userSettings", userId] as const
  }
} as const

