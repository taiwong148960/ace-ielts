/**
 * Vocabulary Import Service
 * Orchestrates the vocabulary book import workflow with Gemini API enrichment
 */

import { getSupabase, isSupabaseInitialized } from "./supabase"
import { enrichWordWithRetry, generateWordAudio, generateExampleAudios } from "./gemini"
import { getLLMApiKey } from "./user-settings"
import { isSaaSMode, getEnvironmentUrls } from "../config/deployment"
import type { WordDetailData, ImportStatus, ImportProgress, ExampleAudioData } from "../types/vocabulary"
import { getBookWords } from "./vocabulary"
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
 * Retry count is tracked only in memory, starting from 0 for each word
 */
async function importWordWithRetry(
  word: { id: string; word: string },
  apiKey: string | null,
  supabase: ReturnType<typeof getSupabase>
): Promise<{ success: boolean; error: string | null }> {
  let attemptCount = 0
  let lastError: string | null = null

  // Try to import the word, with up to MAX_RETRY_ATTEMPTS retries
  // Each word starts from 0, retry count is only tracked in memory
  while (attemptCount < MAX_RETRY_ATTEMPTS) {
    try {
      // Update word import status
      await supabase
        .from("vocabulary_words")
        .update({
          import_status: "importing"
        })
        .eq("id", word.id)

      // Enrich word using Gemini API
      let enrichedWordData: WordDetailData
      let wordAudioUrl: string | null = null
      let exampleAudioUrls: ExampleAudioData[] | null = null

      if (isSaaSMode()) {
        // Call Edge Function for SaaS mode
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error("Not authenticated")
        }

        const { supabaseUrl } = getEnvironmentUrls()
        const functionUrl = `${supabaseUrl}/functions/v1/gemini-enrich-word`

        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ word: word.word })
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
          throw new Error(errorData.error || `Edge Function error: ${response.status}`)
        }

        const responseData = await response.json()
        enrichedWordData = responseData

        // Extract audio URLs from Edge Function response
        if (responseData._audio) {
          wordAudioUrl = responseData._audio.word_audio_url || null
          exampleAudioUrls = responseData._audio.example_audio_urls || null
        }
      } else {
        // Use user's API key for self-hosted mode
        enrichedWordData = await enrichWordWithRetry(word.word, {
          apiKey: apiKey!
        })

        // Generate audio for word and example sentences (self-hosted mode)
        try {
          // Generate word pronunciation audio using Gemini TTS
          wordAudioUrl = await generateWordAudio(word.word, apiKey!)

          // Generate audio for example sentences
          if (enrichedWordData.exampleSentences && enrichedWordData.exampleSentences.length > 0) {
            const exampleSentences = enrichedWordData.exampleSentences.map(ex => ex.sentence)
            exampleAudioUrls = await generateExampleAudios(exampleSentences, apiKey!)
          }
        } catch (audioError) {
          // Don't fail the entire import if audio generation fails
          logger.warn(
            "Audio generation failed",
            { wordId: word.id, word: word.word },
            audioError instanceof Error ? audioError : new Error(String(audioError))
          )
          // Continue with word data update even if audio fails
        }
      }

      // Update word with enriched data and audio URLs
      const updateData: Record<string, unknown> = {
        word_details: enrichedWordData as unknown as Record<string, unknown>,
        import_status: "completed",
        import_error: null
      }

      if (wordAudioUrl) {
        updateData.word_audio_url = wordAudioUrl
      }

      if (exampleAudioUrls && exampleAudioUrls.length > 0) {
        updateData.example_audio_urls = exampleAudioUrls
      }

      const { error: wordUpdateError } = await supabase
        .from("vocabulary_words")
        .update(updateData)
        .eq("id", word.id)

      if (wordUpdateError) {
        throw new Error(`Failed to update word: ${wordUpdateError.message}`)
      }

      // Success! Return immediately
      return { success: true, error: null }
    } catch (error) {
      attemptCount++
      lastError = error instanceof Error ? error.message : String(error)
      
      logger.warn(
        "Word import attempt failed",
        { wordId: word.id, word: word.word, attempt: attemptCount, maxAttempts: MAX_RETRY_ATTEMPTS },
        error instanceof Error ? error : new Error(lastError)
      )

      // If this was the last attempt, mark as failed
      if (attemptCount >= MAX_RETRY_ATTEMPTS) {
        await supabase
          .from("vocabulary_words")
          .update({
            import_status: "failed",
            import_error: lastError
          })
          .eq("id", word.id)
        
        return { success: false, error: lastError }
      }

      // Wait a bit before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attemptCount))
    }
  }

  // Should not reach here, but just in case
  return { success: false, error: lastError }
}

/**
 * Start import workflow for a vocabulary book
 * Enriches all words in the book using Gemini API
 * Processes words sequentially: one word must complete (or fail after 3 retries) before the next starts
 * If any word fails after 3 retries, the entire import is marked as failed
 */
export async function startImport(
  bookId: string,
  userId: string
): Promise<void> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()

  // Get all words for the book
  const words = await getBookWords(bookId)
  if (words.length === 0) {
    throw new Error("No words found in book")
  }

  // Update book import status to 'importing'
  const { error: updateError } = await supabase
    .from("vocabulary_books")
    .update({
      import_status: "importing",
      import_progress: 0,
      import_total: words.length,
      import_started_at: new Date().toISOString()
    })
    .eq("id", bookId)

  if (updateError) {
    logger.error("Failed to update book import status", { bookId }, updateError)
    throw new Error("Failed to start import")
  }
  
  logger.info("Starting vocabulary book import", { bookId, userId, wordCount: words.length })

  // Reset all words' status to importing for this import session
  await supabase
    .from("vocabulary_words")
    .update({
      import_status: "importing"
    })
    .eq("book_id", bookId)

  // Get API key based on deployment mode
  let apiKey: string | null = null

  // In SaaS mode, Edge Function will be called per word
  // In self-hosted mode, get user's API key
  if (!isSaaSMode()) {
    // Self-hosted mode: get user's API key
    apiKey = await getLLMApiKey(userId)
    if (!apiKey) {
      const errorMsg = "LLM API key not configured. Please set your API key in settings."
      // Update book status to failed
      await supabase
        .from("vocabulary_books")
        .update({
          import_status: "failed",
          import_completed_at: new Date().toISOString(),
          import_error: errorMsg
        })
        .eq("id", bookId)
      throw new Error(errorMsg)
    }
  }

  // Process each word sequentially - one must complete before moving to the next
  for (let i = 0; i < words.length; i++) {
    const word = words[i]

    // Import word with retry logic
    const result = await importWordWithRetry(word, apiKey, supabase)

    if (result.success) {
      // Update book progress
      await supabase
        .from("vocabulary_books")
        .update({
          import_progress: i + 1
        })
        .eq("id", bookId)

      // Add small delay to avoid rate limiting (only if not the last word)
      if (i < words.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } else {
      // Word failed after all retries - stop entire import
      logger.error("Word failed after max retries - stopping import", {
        bookId,
        wordId: word.id,
        word: word.word,
        attempts: MAX_RETRY_ATTEMPTS
      })
      
      // Mark book import as failed
      const errorMessage = `Import failed: Word "${word.word}" failed after ${MAX_RETRY_ATTEMPTS} retry attempts. ${result.error}`
      
      await supabase
        .from("vocabulary_books")
        .update({
          import_status: "failed",
          import_completed_at: new Date().toISOString(),
          import_error: errorMessage,
          import_progress: i // Progress is the number of successfully imported words
        })
        .eq("id", bookId)
      
      // Stop processing - return early
      throw new Error(errorMessage)
    }
  }

  // All words imported successfully
  await supabase
    .from("vocabulary_books")
    .update({
      import_status: "completed",
      import_completed_at: new Date().toISOString(),
      import_error: null,
      import_progress: words.length
    })
    .eq("id", bookId)
  
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
 */
export async function retryFailedWords(bookId: string, userId: string): Promise<void> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()

  // Get failed words
  const { data: failedWords, error } = await supabase
    .from("vocabulary_words")
    .select("*")
    .eq("book_id", bookId)
    .eq("import_status", "failed")
    .order("created_at", { ascending: true }) // Process in creation order

  if (error || !failedWords || failedWords.length === 0) {
    return // No failed words to retry
  }

  // Get API key
  let apiKey: string | null = null
  if (!isSaaSMode()) {
    apiKey = await getLLMApiKey(userId)
    if (!apiKey) {
      throw new Error("LLM API key not configured")
    }
  }

  // Update book status to importing
  await supabase
    .from("vocabulary_books")
    .update({
      import_status: "importing"
    })
    .eq("id", bookId)

  // Retry each failed word sequentially with retry logic
  let successCount = 0
  
  for (let i = 0; i < failedWords.length; i++) {
    const word = failedWords[i]
    
    // Import word with retry logic (retry count starts from 0 in memory)
    const result = await importWordWithRetry(word, apiKey, supabase)

    if (result.success) {
      successCount++
      
      // Add small delay to avoid rate limiting (only if not the last word)
      if (i < failedWords.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } else {
      // Word failed after all retries - stop retry operation
      const errorMessage = `Retry failed: Word "${word.word}" failed after ${MAX_RETRY_ATTEMPTS} retry attempts. ${result.error}`
      
      // Update book status
      await supabase
        .from("vocabulary_books")
        .update({
          import_status: "failed",
          import_completed_at: new Date().toISOString(),
          import_error: errorMessage
        })
        .eq("id", bookId)
      
      throw new Error(errorMessage)
    }
  }

  // All words retried successfully - update book status
  if (successCount === failedWords.length) {
    // Check if all words in the book are now completed
    const { count: completedCount } = await supabase
      .from("vocabulary_words")
      .select("*", { count: "exact", head: true })
      .eq("book_id", bookId)
      .eq("import_status", "completed")

    const { count: totalCount } = await supabase
      .from("vocabulary_words")
      .select("*", { count: "exact", head: true })
      .eq("book_id", bookId)

    // Update book progress and status
    await supabase
      .from("vocabulary_books")
      .update({
        import_status: completedCount === totalCount ? "completed" : "importing",
        import_progress: completedCount || 0,
        import_completed_at: completedCount === totalCount ? new Date().toISOString() : null,
        import_error: null
      })
      .eq("id", bookId)
  }
}

