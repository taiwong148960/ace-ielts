/**
 * Vocabulary Import Service
 * Handles vocabulary book import workflow via Edge Functions
 */

import { getSupabase, isSupabaseInitialized } from "./supabase"
import type { ImportProgress } from "../types/vocabulary"
import { createLogger } from "../utils/logger"

const logger = createLogger("VocabularyImportService")

/**
 * Get import progress for a vocabulary book
 */
export async function getImportProgress(bookId: string): Promise<ImportProgress | null> {
  if (!isSupabaseInitialized()) {
    return null
  }

  const supabase = getSupabase()

  const { data, error } = await supabase.functions.invoke('vocabulary-get-import-progress', {
    body: { bookId }
  })

  if (error || !data?.success) {
    logger.warn("Failed to get import progress", { bookId }, error)
    return null
  }

  return data.data as ImportProgress
}

