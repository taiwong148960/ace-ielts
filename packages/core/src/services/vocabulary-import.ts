/**
 * Vocabulary Import Service
 * Orchestrates the vocabulary book import workflow with Gemini API enrichment
 */

import { getSupabase, isSupabaseInitialized } from "./supabase"
import { enrichWordWithRetry } from "./gemini"
import { getLLMApiKey } from "./user-settings"
import { isSaaSMode, getEnvironmentUrls } from "../config/deployment"
import type { WordDetailData, ImportStatus, ImportProgress } from "../types/vocabulary"
import { getBookWords } from "./vocabulary"

/**
 * Start import workflow for a vocabulary book
 * Enriches all words in the book using Gemini API
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
    console.error("Error updating book import status:", updateError)
    throw new Error("Failed to start import")
  }

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

  // Process each word
  let successCount = 0
  let failCount = 0

  for (let i = 0; i < words.length; i++) {
    const word = words[i]

    try {
      // Update word import status
      await supabase
        .from("vocabulary_words")
        .update({
          import_status: "importing"
        })
        .eq("id", word.id)

      // Enrich word using Gemini API
      let wordData: WordDetailData

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

        wordData = await response.json()
      } else {
        // Use user's API key for self-hosted mode
        wordData = await enrichWordWithRetry(word.word, {
          apiKey: apiKey!
        })
      }

      // Update word with enriched data
      const { error: wordUpdateError } = await supabase
        .from("vocabulary_words")
        .update({
          word_details: wordData as unknown as Record<string, unknown>,
          import_status: "completed",
          import_error: null
        })
        .eq("id", word.id)

      if (wordUpdateError) {
        throw new Error(`Failed to update word: ${wordUpdateError.message}`)
      }

      successCount++

      // Update book progress
      await supabase
        .from("vocabulary_books")
        .update({
          import_progress: i + 1
        })
        .eq("id", bookId)

      // Add small delay to avoid rate limiting
      if (i < words.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } catch (error) {
      failCount++
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Mark word as failed
      await supabase
        .from("vocabulary_words")
        .update({
          import_status: "failed",
          import_error: errorMessage
        })
        .eq("id", word.id)

      console.error(`Failed to import word "${word.word}":`, errorMessage)

      // Continue with next word
    }
  }

  // Update book import status
  const finalStatus: ImportStatus = failCount === words.length ? "failed" : "completed"
  
  // Get error messages from failed words for summary
  let errorMessage: string | null = null
  if (failCount > 0) {
    const { data: failedWords } = await supabase
      .from("vocabulary_words")
      .select("import_error")
      .eq("book_id", bookId)
      .eq("import_status", "failed")
      .not("import_error", "is", null)
      .limit(5) // Get first 5 errors as sample
    
    if (failedWords && failedWords.length > 0) {
      const errors = failedWords
        .map(w => w.import_error)
        .filter((e): e is string => typeof e === "string")
        .slice(0, 3) // Show up to 3 unique errors
      
      if (errors.length > 0) {
        const uniqueErrors = [...new Set(errors)]
        if (uniqueErrors.length === 1) {
          errorMessage = uniqueErrors[0]
        } else {
          errorMessage = `${failCount} words failed. Common errors: ${uniqueErrors.join("; ")}`
        }
      } else {
        errorMessage = `${failCount} out of ${words.length} words failed to import`
      }
    } else {
      errorMessage = `${failCount} out of ${words.length} words failed to import`
    }
  }

  await supabase
    .from("vocabulary_books")
    .update({
      import_status: finalStatus,
      import_completed_at: new Date().toISOString(),
      import_error: errorMessage
    })
    .eq("id", bookId)

  if (failCount > 0) {
    console.warn(`Import completed with ${failCount} failures and ${successCount} successes out of ${words.length} words`)
  }
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
    status: (data.import_status as ImportStatus) || "pending",
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

  // Retry each failed word
  for (const word of failedWords) {
    try {
      await supabase
        .from("vocabulary_words")
        .update({
          import_status: "importing"
        })
        .eq("id", word.id)

      let wordData: WordDetailData
      
      if (isSaaSMode()) {
        // Call Edge Function
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

        wordData = await response.json()
      } else {
        wordData = await enrichWordWithRetry(word.word, {
          apiKey: apiKey!
        })
      }

      await supabase
        .from("vocabulary_words")
        .update({
          word_details: wordData as unknown as Record<string, unknown>,
          import_status: "completed",
          import_error: null
        })
        .eq("id", word.id)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await supabase
        .from("vocabulary_words")
        .update({
          import_status: "failed",
          import_error: errorMessage
        })
        .eq("id", word.id)
    }
  }
}

