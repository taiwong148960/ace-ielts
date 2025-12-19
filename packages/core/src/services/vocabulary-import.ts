/**
 * Vocabulary Import Service
 * Handles vocabulary book import workflow via Edge Functions
 */

import { isSupabaseInitialized } from "./supabase"
import type { ImportProgress } from "../types/vocabulary"
import { createLogger } from "../utils/logger"
import { fetchEdge } from "../utils/edge-client"

const logger = createLogger("VocabularyImportService")

/**
 * Get import progress for a vocabulary book
 */
export async function getImportProgress(bookId: string): Promise<ImportProgress | null> {
  if (!isSupabaseInitialized()) {
    return null
  }

  try {
    return await fetchEdge<ImportProgress>("vocabulary-books", `/${bookId}/import-progress`)
  } catch (error) {
    logger.warn("Failed to get import progress", { bookId }, error as Error)
    return null
  }
}
