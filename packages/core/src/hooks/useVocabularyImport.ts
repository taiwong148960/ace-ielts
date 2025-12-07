/**
 * useVocabularyImport Hook
 * React hook for managing vocabulary book import workflow
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { startImport, getImportProgress, retryFailedWords } from "../services/vocabulary-import"
import { queryKeys } from "../query"
import type { ImportProgress } from "../types/vocabulary"

/**
 * Hook for starting and tracking vocabulary book import
 */
export function useVocabularyImport(bookId: string | null, userId: string | null) {
  const queryClient = useQueryClient()

  // Query for import progress
  const {
    data: progress,
    isLoading: isLoadingProgress,
    refetch: refetchProgress
  } = useQuery<ImportProgress | null>({
    queryKey: queryKeys.vocabularyImport.progress(bookId || ""),
    queryFn: () => (bookId ? getImportProgress(bookId) : null),
    enabled: !!bookId,
    refetchInterval: (query) => {
      // Poll every 1 second if importing (to catch failures quickly)
      // Also poll for a short time after completion to catch any final state changes
      const data = query.state.data
      if (!data) return false
      
      if (data.status === "importing") {
        return 1000 // Poll every 1 second while importing
      }
      
      // For completed/failed, poll once more after 1 second to catch any final updates
      // then stop polling
      const completedAt = data.completedAt
      if (completedAt) {
        const completedTime = new Date(completedAt).getTime()
        const now = Date.now()
        const timeSinceCompletion = now - completedTime
        // Poll once more within 3 seconds of completion, then stop
        return timeSinceCompletion < 3000 ? 1000 : false
      }
      
      return false
    }
  })

  // Mutation for starting import
  const startImportMutation = useMutation({
    mutationFn: async () => {
      if (!bookId || !userId) {
        throw new Error("Book ID and User ID are required")
      }
      return startImport(bookId, userId)
    },
    onSuccess: () => {
      // Invalidate and refetch progress
      queryClient.invalidateQueries({ queryKey: queryKeys.vocabularyImport.progress(bookId || "") })
      queryClient.invalidateQueries({ queryKey: queryKeys.vocabularyBooks.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.vocabularyBooks.detail(bookId || "") })
    }
  })

  // Mutation for retrying failed words
  const retryFailedMutation = useMutation({
    mutationFn: async () => {
      if (!bookId || !userId) {
        throw new Error("Book ID and User ID are required")
      }
      return retryFailedWords(bookId, userId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vocabularyImport.progress(bookId || "") })
      queryClient.invalidateQueries({ queryKey: queryKeys.vocabularyBooks.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.vocabularyBooks.detail(bookId || "") })
    }
  })

  return {
    // Progress state
    progress,
    isLoadingProgress,
    isImporting: progress?.status === "importing",
    isCompleted: progress?.status === "completed",
    isFailed: progress?.status === "failed",

    // Actions
    startImport: () => startImportMutation.mutate(),
    retryFailed: () => retryFailedMutation.mutate(),
    refetchProgress,

    // Mutation states
    isStarting: startImportMutation.isPending,
    isRetrying: retryFailedMutation.isPending,
    startError: startImportMutation.error,
    retryError: retryFailedMutation.error
  }
}

