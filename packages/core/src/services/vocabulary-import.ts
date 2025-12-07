/**
 * Vocabulary Import Service
 * Orchestrates the vocabulary book import workflow with Gemini API enrichment
 * 
 * Architecture: This service coordinates between the client and Edge Functions:
 * 1. Client calls startImport() which invokes vocabulary-start-import Edge Function
 * 2. Edge Function returns list of words to process
 * 3. Client processes each word by calling gemini-enrich-word Edge Function
 * 4. Client calls updateImportStatus() for each word result
 */

import { getSupabase, isSupabaseInitialized } from "./supabase"
import { enrichWordWithRetry, generateWordAudio, generateExampleAudios } from "./gemini"
import { getLLMApiKey } from "./user-settings"
import { isSaaSMode } from "../config/deployment"
import type { WordDetailData, ImportStatus, ImportProgress, ExampleAudioData } from "../types/vocabulary"
import { createLogger } from "../utils/logger"

// Create logger for this service
const logger = createLogger("VocabularyImportService")

/**
 * Maximum number of retry attempts for a single word
 */
const MAX_RETRY_ATTEMPTS = 3

/**
 * Helper function to import a single word with retry logic
 * Returns true if successful, false if failed after all retries
 */
async function importWordWithRetry(
  word: { id: string; word: string },
  bookId: string,
  apiKey: string | null,
  supabase: ReturnType<typeof getSupabase>
): Promise<{ success: boolean; error: string | null }> {
  let attemptCount = 0
  let lastError: string | null = null

  while (attemptCount < MAX_RETRY_ATTEMPTS) {
    try {
      let enrichedWordData: WordDetailData
      let wordAudioUrl: string | null = null
      let exampleAudioUrls: ExampleAudioData[] | null = null

      if (isSaaSMode()) {
        // Call Edge Function for SaaS mode
        const { data, error } = await supabase.functions.invoke('gemini-enrich-word', {
          body: { word: word.word }
        })

        if (error) {
          throw new Error(error.message || "Edge Function error")
        }

        enrichedWordData = data

        // Extract audio URLs from Edge Function response
        if (data._audio) {
          wordAudioUrl = data._audio.word_audio_url || null
          exampleAudioUrls = data._audio.example_audio_urls || null
        }
      } else {
        // Use user's API key for self-hosted mode
        enrichedWordData = await enrichWordWithRetry(word.word, {
          apiKey: apiKey!
        })

        // Generate audio for word and example sentences (self-hosted mode)
        try {
          wordAudioUrl = await generateWordAudio(word.word, apiKey!)

          if (enrichedWordData.exampleSentences && enrichedWordData.exampleSentences.length > 0) {
            const exampleSentences = enrichedWordData.exampleSentences.map(ex => ex.sentence)
            exampleAudioUrls = await generateExampleAudios(exampleSentences, apiKey!)
          }
        } catch (audioError) {
          logger.warn(
            "Audio generation failed",
            { wordId: word.id, word: word.word },
            audioError instanceof Error ? audioError : new Error(String(audioError))
          )
        }
      }

      // Update import status via Edge Function
      const { error: statusError } = await supabase.functions.invoke('vocabulary-update-import-status', {
        body: {
          bookId,
          wordId: word.id,
          success: true,
          wordDetails: enrichedWordData,
          wordAudioUrl,
          exampleAudioUrls
        }
      })

      if (statusError) {
        throw new Error(`Failed to update status: ${statusError.message}`)
      }

      return { success: true, error: null }
    } catch (error) {
      attemptCount++
      lastError = error instanceof Error ? error.message : String(error)
      
      logger.warn(
        "Word import attempt failed",
        { wordId: word.id, word: word.word, attempt: attemptCount, maxAttempts: MAX_RETRY_ATTEMPTS },
        error instanceof Error ? error : new Error(lastError)
      )

      if (attemptCount >= MAX_RETRY_ATTEMPTS) {
        // Report failure via Edge Function
        await supabase.functions.invoke('vocabulary-update-import-status', {
          body: {
            bookId,
            wordId: word.id,
            success: false,
            error: lastError
          }
        })
        
        return { success: false, error: lastError }
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 1000 * attemptCount))
    }
  }

  return { success: false, error: lastError }
}

/**
 * Start import workflow for a vocabulary book
 * Enriches all words in the book using Gemini API
 * Processes words sequentially: one word must complete (or fail after 3 retries) before the next starts
 * If any word fails after 3 retries, the entire import is marked as failed
 * 
 * Calls Edge Function: vocabulary-start-import to initialize, then processes each word
 */
export async function startImport(
  bookId: string,
  userId: string
): Promise<void> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()

  logger.info("Starting vocabulary book import via Edge Function", { bookId, userId })

  // Call Edge Function to start import and get word list
  const { data: startData, error: startError } = await supabase.functions.invoke('vocabulary-start-import', {
    body: { bookId }
  })

  if (startError) {
    logger.error("Failed to start import via Edge Function", { bookId }, startError)
    throw new Error(startError.message || "Failed to start import")
  }

  if (!startData?.success) {
    throw new Error(startData?.error || "Failed to start import")
  }

  const words = startData.data.words as Array<{ id: string; word: string }>
  logger.info("Import started", { bookId, userId, wordCount: words.length })

  // Get API key for self-hosted mode
  let apiKey: string | null = null
  if (!isSaaSMode()) {
    apiKey = await getLLMApiKey(userId)
    if (!apiKey) {
      const errorMsg = "LLM API key not configured. Please set your API key in settings."
      // Update status via Edge Function
      await supabase.functions.invoke('vocabulary-update-import-status', {
        body: {
          bookId,
          wordId: words[0]?.id,
          success: false,
          error: errorMsg
        }
      })
      throw new Error(errorMsg)
    }
  }

  // Process each word sequentially
  for (let i = 0; i < words.length; i++) {
    const word = words[i]

    // Import word with retry logic
    const result = await importWordWithRetry(word, bookId, apiKey, supabase)

    if (result.success) {
      // Small delay to avoid rate limiting
      if (i < words.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } else {
      // Word failed - import already marked as failed by importWordWithRetry
      const errorMessage = `Import failed: Word "${word.word}" failed after ${MAX_RETRY_ATTEMPTS} retry attempts. ${result.error}`
      logger.error("Word failed after max retries - stopping import", {
        bookId,
        wordId: word.id,
        word: word.word,
        attempts: MAX_RETRY_ATTEMPTS
      })
      throw new Error(errorMessage)
    }
  }
  
  logger.info("Vocabulary book import completed", { bookId, wordCount: words.length })
}

/**
 * Get import progress for a vocabulary book
 */
export async function getImportProgress(bookId: string): Promise<ImportProgress | null> {
  if (!isSupabaseInitialized()) {
    return null
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("vocabulary_books")
    .select("import_status, import_progress, import_total, import_started_at, import_completed_at, import_error")
    .eq("id", bookId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    status: (data.import_status as ImportStatus | null) || null,
    current: data.import_progress || 0,
    total: data.import_total || 0,
    startedAt: data.import_started_at || undefined,
    completedAt: data.import_completed_at || undefined,
    error: data.import_error || undefined
  }
}

/**
 * Get failed words with error messages for a book
 */
export async function getFailedWordsErrors(bookId: string): Promise<Array<{ word: string; error: string }>> {
  if (!isSupabaseInitialized()) {
    return []
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("vocabulary_words")
    .select("word, import_error")
    .eq("book_id", bookId)
    .eq("import_status", "failed")
    .not("import_error", "is", null)

  if (error || !data) {
    return []
  }

  return data
    .filter((item) => item.import_error)
    .map((item) => ({
      word: item.word,
      error: item.import_error as string
    }))
}

/**
 * Retry failed words in a book
 * Processes words sequentially with retry logic
 * If any word fails after 3 retries, the retry operation stops
 * 
 * Calls Edge Function: vocabulary-retry-failed to initialize, then processes each word
 */
export async function retryFailedWords(bookId: string, userId: string): Promise<void> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()

  logger.info("Retrying failed words via Edge Function", { bookId, userId })

  // Call Edge Function to get failed words and reset their status
  const { data: retryData, error: retryError } = await supabase.functions.invoke('vocabulary-retry-failed', {
    body: { bookId }
  })

  if (retryError) {
    logger.error("Failed to start retry via Edge Function", { bookId }, retryError)
    throw new Error(retryError.message || "Failed to start retry")
  }

  if (!retryData?.success) {
    throw new Error(retryData?.error || "Failed to start retry")
  }

  const failedWords = retryData.data.words as Array<{ id: string; word: string }>
  
  if (!failedWords || failedWords.length === 0) {
    logger.info("No failed words to retry", { bookId })
    return
  }

  logger.info("Retrying failed words", { bookId, failedCount: failedWords.length })

  // Get API key for self-hosted mode
  let apiKey: string | null = null
  if (!isSaaSMode()) {
    apiKey = await getLLMApiKey(userId)
    if (!apiKey) {
      throw new Error("LLM API key not configured")
    }
  }

  // Retry each failed word sequentially
  for (let i = 0; i < failedWords.length; i++) {
    const word = failedWords[i]
    
    const result = await importWordWithRetry(word, bookId, apiKey, supabase)

    if (result.success) {
      // Small delay to avoid rate limiting
      if (i < failedWords.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } else {
      // Word failed - import already marked as failed by importWordWithRetry
      const errorMessage = `Retry failed: Word "${word.word}" failed after ${MAX_RETRY_ATTEMPTS} retry attempts. ${result.error}`
      logger.error("Word retry failed", { bookId, wordId: word.id, word: word.word })
      throw new Error(errorMessage)
    }
  }

  logger.info("Retry completed successfully", { bookId, retryCount: failedWords.length })
}

