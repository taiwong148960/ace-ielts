/**
 * Vocabulary Service
 * Handles all vocabulary book and word operations with Supabase
 */

import { getSupabase, isSupabaseInitialized } from "./supabase"
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

// Create logger for this service
const logger = createLogger("VocabularyService")

/**
 * Get user's books with their progress
 * Calls Edge Function: vocabulary-get-books-with-progress
 */
export async function getUserBooksWithProgress(
  userId: string
): Promise<VocabularyBookWithProgress[]> {
  if (!isSupabaseInitialized()) {
    logger.warn("Supabase not initialized", { operation: "getUserBooksWithProgress" })
    return []
  }

  const supabase = getSupabase()
  
  logger.debug("Fetching user books with progress via Edge Function", { userId })

  const { data, error } = await supabase.functions.invoke('vocabulary-get-books-with-progress', {
    body: { type: "user" }
  })

  if (error || !data?.success) {
    logger.error("Failed to fetch user books with progress via Edge Function", { userId }, error)
    throw new Error("Failed to fetch user vocabulary books")
  }

  return data.data as VocabularyBookWithProgress[]
}

/**
 * Get system books with user's progress
 * Calls Edge Function: vocabulary-get-books-with-progress
 */
export async function getSystemBooksWithProgress(
  userId: string
): Promise<VocabularyBookWithProgress[]> {
  if (!isSupabaseInitialized()) {
    logger.warn("Supabase not initialized", { operation: "getSystemBooksWithProgress" })
    return []
  }

  const supabase = getSupabase()
  
  logger.debug("Fetching system books with progress via Edge Function", { userId })

  const { data, error } = await supabase.functions.invoke('vocabulary-get-books-with-progress', {
    body: { type: "system" }
  })

  if (error || !data?.success) {
    logger.error("Failed to fetch system books with progress via Edge Function", { userId }, error)
    throw new Error("Failed to fetch system vocabulary books")
  }

  return data.data as VocabularyBookWithProgress[]
}

/**
 * Create a new vocabulary book with words
 * Calls Edge Function: vocabulary-create-book
 */
export async function createBook(
  userId: string,
  input: CreateVocabularyBookInput
): Promise<VocabularyBook> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  logger.info("Creating vocabulary book via Edge Function", { userId, bookName: input.name, wordCount: input.words.length })

  const { data, error } = await supabase.functions.invoke('vocabulary-create-book', {
    body: {
      name: input.name,
      description: input.description,
      cover_color: input.cover_color,
      cover_text: input.cover_text,
      book_type: input.book_type,
      words: input.words
    }
  })

  if (error) {
    logger.error("Failed to create book via Edge Function", { userId, bookName: input.name }, error)
    throw new Error(error.message || "Failed to create vocabulary book")
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to create vocabulary book")
  }

  logger.info("Vocabulary book created", { bookId: data.data.id, userId, wordCount: input.words.length })
  return data.data
}

/**
 * Update a vocabulary book
 * Calls Edge Function: vocabulary-update-book
 */
export async function updateBook(
  bookId: string,
  input: UpdateVocabularyBookInput
): Promise<VocabularyBook> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  logger.info("Updating vocabulary book via Edge Function", { bookId })

  const { data, error } = await supabase.functions.invoke('vocabulary-update-book', {
    body: {
      bookId,
      name: input.name,
      description: input.description,
      cover_color: input.cover_color,
      cover_text: input.cover_text
    }
  })

  if (error) {
    logger.error("Failed to update book via Edge Function", { bookId }, error)
    throw new Error(error.message || "Failed to update vocabulary book")
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to update vocabulary book")
  }
  
  logger.info("Vocabulary book updated", { bookId })
  return data.data
}

/**
 * Delete a vocabulary book
 * Only allows deleting user's own books (not system books)
 * Calls Edge Function: vocabulary-delete-book
 */
export async function deleteBook(bookId: string, userId: string): Promise<void> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  logger.info("Deleting vocabulary book via Edge Function", { bookId, userId })

  const { data, error } = await supabase.functions.invoke('vocabulary-delete-book', {
    body: { bookId }
  })

  if (error) {
    logger.error("Failed to delete book via Edge Function", { bookId, userId }, error)
    throw new Error(error.message || "Failed to delete vocabulary book")
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to delete vocabulary book")
  }
  
  logger.info("Vocabulary book deleted", { bookId, userId })
}

/**
 * Get all words in a vocabulary book
 * Calls Edge Function: vocabulary-get-words
 */
export async function getBookWords(bookId: string): Promise<VocabularyWord[]> {
  if (!isSupabaseInitialized()) {
    return []
  }

  const supabase = getSupabase()
  
  logger.debug("Fetching words via Edge Function", { bookId })

  const { data, error } = await supabase.functions.invoke('vocabulary-get-words', {
    body: { bookId }
  })

  if (error || !data?.success) {
    logger.error("Failed to fetch words via Edge Function", { bookId }, error)
    throw new Error("Failed to fetch vocabulary words")
  }

  return data.data as VocabularyWord[]
}

/**
 * Add words to a vocabulary book
 * Calls Edge Function: vocabulary-add-words
 */
export async function addWords(
  bookId: string,
  words: string[]
): Promise<VocabularyWord[]> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  logger.info("Adding words to book via Edge Function", { bookId, wordCount: words.length })

  const { data, error } = await supabase.functions.invoke('vocabulary-add-words', {
    body: { bookId, words }
  })

  if (error) {
    logger.error("Failed to add words via Edge Function", { bookId, wordCount: words.length }, error)
    throw new Error(error.message || "Failed to add vocabulary words")
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to add vocabulary words")
  }
  
  logger.info("Words added to book", { bookId, wordCount: data.data.words?.length || 0 })
  return data.data.words || []
}

/**
 * Delete a word from a vocabulary book
 * Calls Edge Function: vocabulary-delete-word
 */
export async function deleteWord(wordId: string, bookId: string): Promise<void> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  logger.info("Deleting word via Edge Function", { wordId, bookId })

  const { data, error } = await supabase.functions.invoke('vocabulary-delete-word', {
    body: { wordId, bookId }
  })

  if (error) {
    logger.error("Failed to delete word via Edge Function", { wordId, bookId }, error)
    throw new Error(error.message || "Failed to delete vocabulary word")
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to delete vocabulary word")
  }
  
  logger.info("Word deleted", { wordId, bookId })
}

/**
 * Vocabulary API object implementing the interface
 */
/**
 * Get book settings for a user and book
 * Returns default settings if not found
 * Calls Edge Function: vocabulary-get-book-settings
 */
export async function getBookSettings(
  userId: string,
  bookId: string
): Promise<BookSettings> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  logger.debug("Fetching book settings via Edge Function", { userId, bookId })

  const { data, error } = await supabase.functions.invoke('vocabulary-get-book-settings', {
    body: { bookId }
  })

  if (error || !data?.success) {
    logger.error("Failed to fetch book settings via Edge Function", { userId, bookId }, error)
    throw new Error("Failed to fetch book settings")
  }

  return data.data as BookSettings
}

/**
 * Update or create book settings
 * Calls Edge Function: vocabulary-update-settings
 */
export async function updateBookSettings(
  userId: string,
  bookId: string,
  input: UpdateBookSettingsInput
): Promise<BookSettings> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  logger.info("Updating book settings via Edge Function", { userId, bookId })

  const { data, error } = await supabase.functions.invoke('vocabulary-update-settings', {
    body: {
      bookId,
      daily_new_limit: input.daily_new_limit,
      daily_review_limit: input.daily_review_limit,
      learning_mode: input.learning_mode,
      study_order: input.study_order
    }
  })

  if (error) {
    logger.error("Failed to update book settings via Edge Function", { userId, bookId }, error)
    throw new Error(error.message || "Failed to update book settings")
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to update book settings")
  }
    
  logger.info("Book settings updated", { userId, bookId })
  return data.data
}
