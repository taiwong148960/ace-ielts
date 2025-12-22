/**
 * Vocabulary Service
 * Handles all vocabulary book and word operations with Supabase
 */

import { isSupabaseInitialized } from "./supabase"
import type {
  VocabularyBook,
  VocabularyWord,
  VocabularyBookWithProgress,
  CreateVocabularyBookInput,
  UpdateVocabularyBookInput,
  BookSettings,
  UpdateBookSettingsInput
} from "../types/vocabulary"
import { createLogger } from "../utils/logger"
import { fetchEdge } from "../utils/edge-client"

// Create logger for this service
const logger = createLogger("VocabularyService")

/**
 * Get user's books with their progress
 * Calls Edge Function: vocabulary-books
 */
export async function getUserBooksWithProgress(
  userId: string
): Promise<VocabularyBookWithProgress[]> {
  if (!isSupabaseInitialized()) {
    logger.warn("Supabase not initialized", { operation: "getUserBooksWithProgress" })
    return []
  }

  logger.debug("Fetching user books with progress via Edge Function", { userId })

  try {
    return await fetchEdge<VocabularyBookWithProgress[]>("vocabulary-books", "/", {
      query: { type: "user" }
    })
  } catch (error) {
    logger.error("Failed to fetch user books with progress", { userId }, error as Error)
    throw new Error("Failed to fetch user vocabulary books")
  }
}

/**
 * Get system books with user's progress
 * Calls Edge Function: vocabulary-books
 */
export async function getSystemBooksWithProgress(
  userId: string
): Promise<VocabularyBookWithProgress[]> {
  if (!isSupabaseInitialized()) {
    logger.warn("Supabase not initialized", { operation: "getSystemBooksWithProgress" })
    return []
  }

  logger.debug("Fetching system books with progress via Edge Function", { userId })

  try {
    return await fetchEdge<VocabularyBookWithProgress[]>("vocabulary-books", "/", {
      query: { type: "system" }
    })
  } catch (error) {
    logger.error("Failed to fetch system books with progress", { userId }, error as Error)
    throw new Error("Failed to fetch system vocabulary books")
  }
}

/**
 * Create a new vocabulary book with words
 * Calls Edge Function: vocabulary-books
 */
export async function createBook(
  userId: string,
  input: CreateVocabularyBookInput
): Promise<VocabularyBook> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  logger.info("Creating vocabulary book via Edge Function", { userId, bookName: input.name, wordCount: input.words.length })

  try {
    const data = await fetchEdge<VocabularyBook>("vocabulary-books", "/", {
      method: "POST",
      body: {
        name: input.name,
        description: input.description,
        cover_color: input.cover_color,
        cover_text: input.cover_text,
        book_type: input.book_type,
        words: input.words
      }
    })
    logger.info("Vocabulary book created", { bookId: data.id, userId, wordCount: input.words.length })
    return data
  } catch (error) {
    logger.error("Failed to create book", { userId, bookName: input.name }, error as Error)
    throw new Error((error as Error).message || "Failed to create vocabulary book")
  }
}

/**
 * Update a vocabulary book
 * Calls Edge Function: vocabulary-books
 */
export async function updateBook(
  bookId: string,
  input: UpdateVocabularyBookInput
): Promise<VocabularyBook> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  logger.info("Updating vocabulary book via Edge Function", { bookId })

  try {
    const data = await fetchEdge<VocabularyBook>("vocabulary-books", `/${bookId}`, {
      method: "PATCH",
      body: {
        name: input.name,
        description: input.description,
        cover_color: input.cover_color,
        cover_text: input.cover_text
      }
    })
    logger.info("Vocabulary book updated", { bookId })
    return data
  } catch (error) {
    logger.error("Failed to update book", { bookId }, error as Error)
    throw new Error((error as Error).message || "Failed to update vocabulary book")
  }
}

/**
 * Delete a vocabulary book
 * Only allows deleting user's own books (not system books)
 * Calls Edge Function: vocabulary-books
 */
export async function deleteBook(bookId: string, userId: string): Promise<void> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  logger.info("Deleting vocabulary book via Edge Function", { bookId, userId })

  try {
    await fetchEdge("vocabulary-books", `/${bookId}`, {
      method: "DELETE"
    })
    logger.info("Vocabulary book deleted", { bookId, userId })
  } catch (error) {
    logger.error("Failed to delete book", { bookId, userId }, error as Error)
    throw new Error((error as Error).message || "Failed to delete vocabulary book")
  }
}

/**
 * Get all words in a vocabulary book
 * Calls Edge Function: vocabulary-words
 */
export async function getBookWords(bookId: string): Promise<VocabularyWord[]> {
  if (!isSupabaseInitialized()) {
    return []
  }

  logger.debug("Fetching words via Edge Function", { bookId })

  try {
    return await fetchEdge<VocabularyWord[]>("vocabulary-words", "/", {
      query: { bookId }
    })
  } catch (error) {
    logger.error("Failed to fetch words", { bookId }, error as Error)
    throw new Error("Failed to fetch vocabulary words")
  }
}

/**
 * Add words to a vocabulary book
 * Calls Edge Function: vocabulary-words
 */
export async function addWords(
  bookId: string,
  words: string[]
): Promise<VocabularyWord[]> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  logger.info("Adding words to book via Edge Function", { bookId, wordCount: words.length })

  try {
    const data = await fetchEdge<{ words: VocabularyWord[], wordCount: number }>("vocabulary-words", "/", {
      method: "POST",
      body: { bookId, words }
    })
    logger.info("Words added to book", { bookId, wordCount: data.words?.length || 0 })
    return data.words || []
  } catch (error) {
    logger.error("Failed to add words", { bookId, wordCount: words.length }, error as Error)
    throw new Error((error as Error).message || "Failed to add vocabulary words")
  }
}

/**
 * Delete a word from a vocabulary book
 * Calls Edge Function: vocabulary-words
 */
export async function deleteWord(wordId: string, bookId: string): Promise<void> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  logger.info("Deleting word via Edge Function", { wordId, bookId })

  try {
    await fetchEdge("vocabulary-words", `/${wordId}`, {
      method: "DELETE",
      query: { bookId }
    })
    logger.info("Word deleted", { wordId, bookId })
  } catch (error) {
    logger.error("Failed to delete word", { wordId, bookId }, error as Error)
    throw new Error((error as Error).message || "Failed to delete vocabulary word")
  }
}

/**
 * Get book settings for a user and book
 * Returns default settings if not found
 * Calls Edge Function: vocabulary-books
 */
export async function getBookSettings(
  userId: string,
  bookId: string
): Promise<BookSettings> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  logger.debug("Fetching book settings via Edge Function", { userId, bookId })

  try {
    return await fetchEdge<BookSettings>("vocabulary-books", `/${bookId}/settings`)
  } catch (error) {
    logger.error("Failed to fetch book settings", { userId, bookId }, error as Error)
    throw new Error("Failed to fetch book settings")
  }
}

/**
 * Update or create book settings
 * Calls Edge Function: vocabulary-books
 */
export async function updateBookSettings(
  userId: string,
  bookId: string,
  input: UpdateBookSettingsInput
): Promise<BookSettings> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  logger.info("Updating book settings via Edge Function", { userId, bookId })

  try {
    // Pass full configuration directly (all fields are required)
    const data = await fetchEdge<BookSettings>("vocabulary-books", `/${bookId}/settings`, {
      method: "PATCH",
      body: input
    })
    logger.info("Book settings updated", { userId, bookId })
    return data
  } catch (error) {
    logger.error("Failed to update book settings", { userId, bookId }, error as Error)
    throw new Error((error as Error).message || "Failed to update book settings")
  }
}
