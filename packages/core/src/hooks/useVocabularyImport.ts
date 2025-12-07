/**
 * useVocabularyImport Hook
 * React hook for managing vocabulary book import workflow
 */

import { useQuery } from "@tanstack/react-query"
import { getImportProgress } from "../services/vocabulary-import"
import { queryKeys } from "../query"
import type { ImportProgress } from "../types/vocabulary"

export function useVocabularyImport(bookId: string | null) {
  const {
    data: progress,
    isLoading: isLoadingProgress,
    refetch: refetchProgress
  } = useQuery<ImportProgress | null>({
    queryKey: queryKeys.vocabularyImport.progress(bookId || ""),
    queryFn: () => (bookId ? getImportProgress(bookId) : null),
    enabled: !!bookId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || data.status !== "importing") return false
      return 1000
    }
  })

  return {
    progress,
    isLoadingProgress,
    isImporting: progress?.status === "importing",
    isCompleted: progress?.status === "completed",
    refetchProgress
  }
}

