/**
 * Vocabulary Service
 * Handles all vocabulary book and word operations with Supabase
 */

import { getSupabase, isSupabaseInitialized } from "./supabase"
import type {
  VocabularyBook,
  VocabularyWord,
  UserBookProgress,
  VocabularyBookWithProgress,
  CreateVocabularyBookInput,
  UpdateVocabularyBookInput,
  BookSettings,
  UpdateBookSettingsInput
} from "../types/vocabulary"
import { DEFAULT_BOOK_SETTINGS as DEFAULT_SETTINGS } from "../types/vocabulary"
import { createLogger } from "../utils/logger"

// Create logger for this service
const logger = createLogger("VocabularyService")

/**
 * Vocabulary API interface
 */
export interface IVocabularyApi {
  // Books
  getSystemBooks(): Promise<VocabularyBook[]>
  getUserBooks(userId: string): Promise<VocabularyBookWithProgress[]>
  getBookById(bookId: string): Promise<VocabularyBook | null>
  createBook(userId: string, input: CreateVocabularyBookInput): Promise<VocabularyBook>
  updateBook(bookId: string, input: UpdateVocabularyBookInput): Promise<VocabularyBook>
  deleteBook(bookId: string): Promise<void>
  
  // Book Progress
  getBookProgress(userId: string, bookId: string): Promise<UserBookProgress | null>
  getUserBooksWithProgress(userId: string): Promise<VocabularyBookWithProgress[]>
  
  // Words
  getBookWords(bookId: string): Promise<VocabularyWord[]>
  addWords(bookId: string, words: string[]): Promise<VocabularyWord[]>
  deleteWord(wordId: string): Promise<void>
}

/**
 * Get all system vocabulary books
 */
export async function getSystemBooks(): Promise<VocabularyBook[]> {
  if (!isSupabaseInitialized()) {
    logger.warn("Supabase not initialized", { operation: "getSystemBooks" })
    return []
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("vocabulary_books")
    .select("*")
    .eq("is_system_book", true)
    .order("name")

  if (error) {
    logger.error("Failed to fetch system books", {}, error)
    throw new Error("Failed to fetch system vocabulary books")
  }

  return data || []
}

/**
 * Get all vocabulary books for a user (their own books)
 */
export async function getUserBooks(userId: string): Promise<VocabularyBook[]> {
  if (!isSupabaseInitialized()) {
    logger.warn("Supabase not initialized", { operation: "getUserBooks" })
    return []
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("vocabulary_books")
    .select("*")
    .eq("user_id", userId)
    .eq("is_system_book", false)
    .order("updated_at", { ascending: false })

  if (error) {
    logger.error("Failed to fetch user books", { userId }, error)
    throw new Error("Failed to fetch user vocabulary books")
  }

  return data || []
}

/**
 * Get user's books with their progress
 */
export async function getUserBooksWithProgress(
  userId: string
): Promise<VocabularyBookWithProgress[]> {
  if (!isSupabaseInitialized()) {
    logger.warn("Supabase not initialized", { operation: "getUserBooksWithProgress" })
    return []
  }

  const supabase = getSupabase()
  
  // Get user's own books
  const { data: books, error: booksError } = await supabase
    .from("vocabulary_books")
    .select("*")
    .eq("user_id", userId)
    .eq("is_system_book", false)
    .order("updated_at", { ascending: false })

  if (booksError) {
    logger.error("Failed to fetch user books with progress", { userId }, booksError)
    throw new Error("Failed to fetch user vocabulary books")
  }

  if (!books || books.length === 0) {
    return []
  }

  // Get progress for all books
  const bookIds = books.map(b => b.id)
  const { data: progressData, error: progressError } = await supabase
    .from("user_book_progress")
    .select("*")
    .eq("user_id", userId)
    .in("book_id", bookIds)

  if (progressError) {
    logger.warn("Failed to fetch book progress, returning books without progress", { userId }, progressError)
    // Don't throw, just return books without progress
    return books
  }

  // Merge books with progress
  const progressMap = new Map(progressData?.map(p => [p.book_id, p]) || [])
  
  return books.map(book => ({
    ...book,
    progress: progressMap.get(book.id) || undefined
  }))
}

/**
 * Get system books with user's progress
 */
export async function getSystemBooksWithProgress(
  userId: string
): Promise<VocabularyBookWithProgress[]> {
  if (!isSupabaseInitialized()) {
    logger.warn("Supabase not initialized", { operation: "getSystemBooksWithProgress" })
    return []
  }

  const supabase = getSupabase()
  
  // Get system books
  const { data: books, error: booksError } = await supabase
    .from("vocabulary_books")
    .select("*")
    .eq("is_system_book", true)
    .order("name")

  if (booksError) {
    logger.error("Failed to fetch system books with progress", {}, booksError)
    throw new Error("Failed to fetch system vocabulary books")
  }

  if (!books || books.length === 0 || !userId) {
    return books || []
  }

  // Get progress for all books
  const bookIds = books.map(b => b.id)
  const { data: progressData, error: progressError } = await supabase
    .from("user_book_progress")
    .select("*")
    .eq("user_id", userId)
    .in("book_id", bookIds)

  if (progressError) {
    logger.warn("Failed to fetch book progress for system books", { userId }, progressError)
    return books
  }

  // Merge books with progress
  const progressMap = new Map(progressData?.map(p => [p.book_id, p]) || [])
  
  return books.map(book => ({
    ...book,
    progress: progressMap.get(book.id) || undefined
  }))
}

/**
 * Get a vocabulary book by ID
 */
export async function getBookById(bookId: string): Promise<VocabularyBook | null> {
  if (!isSupabaseInitialized()) {
    return null
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("vocabulary_books")
    .select("*")
    .eq("id", bookId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return null // Not found
    }
    logger.error("Failed to fetch book", { bookId }, error)
    throw new Error("Failed to fetch vocabulary book")
  }

  return data
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
 */
export async function getBookWords(bookId: string): Promise<VocabularyWord[]> {
  if (!isSupabaseInitialized()) {
    return []
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("vocabulary_words")
    .select("*")
    .eq("book_id", bookId)
    .order("word")

  if (error) {
    logger.error("Failed to fetch words", { bookId }, error)
    throw new Error("Failed to fetch vocabulary words")
  }

  return data || []
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
 * Get user's progress on a specific book
 */
export async function getBookProgress(
  userId: string,
  bookId: string
): Promise<UserBookProgress | null> {
  if (!isSupabaseInitialized()) {
    return null
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("user_book_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return null // Not found
    }
    logger.error("Failed to fetch book progress", { userId, bookId }, error)
    throw new Error("Failed to fetch book progress")
  }

  return data
}

/**
 * Vocabulary API object implementing the interface
 */
/**
 * Get book settings for a user and book
 * Returns default settings if not found
 */
export async function getBookSettings(
  userId: string,
  bookId: string
): Promise<BookSettings> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("book_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .single()

  if (error) {
    // If not found, return default settings (will be created on first update)
    if (error.code === "PGRST116") {
      return {
        id: "",
        user_id: userId,
        book_id: bookId,
        ...DEFAULT_SETTINGS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
    logger.error("Failed to fetch book settings", { userId, bookId }, error)
    throw new Error("Failed to fetch book settings")
  }

  return data
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

export const vocabularyApi: IVocabularyApi = {
  getSystemBooks,
  getUserBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook: async (bookId: string) => {
    // This requires userId, so we need to get current user
    const supabase = getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    return deleteBook(bookId, user.id)
  },
  getBookProgress,
  getUserBooksWithProgress,
  getBookWords,
  addWords,
  deleteWord: async (wordId: string) => {
    // We need bookId to update word count, but for simple delete we can skip
    const supabase = getSupabase()
    await supabase.from("vocabulary_words").delete().eq("id", wordId)
  }
}

export default vocabularyApi
