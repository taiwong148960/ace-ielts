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
  UpdateVocabularyBookInput
} from "../types/vocabulary"
import { DEFAULT_BOOK_COVER_COLOR, BOOK_COVER_COLORS } from "../types/vocabulary"

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
    console.warn("Supabase not initialized, returning empty array")
    return []
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("vocabulary_books")
    .select("*")
    .eq("is_system_book", true)
    .order("name")

  if (error) {
    console.error("Error fetching system books:", error)
    throw new Error("Failed to fetch system vocabulary books")
  }

  return data || []
}

/**
 * Get all vocabulary books for a user (their own books)
 */
export async function getUserBooks(userId: string): Promise<VocabularyBook[]> {
  if (!isSupabaseInitialized()) {
    console.warn("Supabase not initialized, returning empty array")
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
    console.error("Error fetching user books:", error)
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
    console.warn("Supabase not initialized, returning empty array")
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
    console.error("Error fetching user books:", booksError)
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
    console.error("Error fetching book progress:", progressError)
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
    console.warn("Supabase not initialized, returning empty array")
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
    console.error("Error fetching system books:", booksError)
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
    console.error("Error fetching book progress:", progressError)
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
    console.error("Error fetching book:", error)
    throw new Error("Failed to fetch vocabulary book")
  }

  return data
}

/**
 * Create a new vocabulary book with words
 */
export async function createBook(
  userId: string,
  input: CreateVocabularyBookInput
): Promise<VocabularyBook> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()

  // Create the book
  const bookData = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    cover_color: input.cover_color || BOOK_COVER_COLORS[Math.floor(Math.random() * BOOK_COVER_COLORS.length)],
    cover_text: input.cover_text?.trim() || null,
    book_type: input.book_type || "custom",
    is_system_book: false,
    user_id: userId,
    word_count: input.words.length
  }

  const { data: book, error: bookError } = await supabase
    .from("vocabulary_books")
    .insert(bookData)
    .select()
    .single()

  if (bookError) {
    console.error("Error creating book:", bookError)
    throw new Error("Failed to create vocabulary book")
  }

  // Add words to the book
  if (input.words.length > 0) {
    const wordsToInsert = input.words
      .map(word => word.trim())
      .filter(word => word.length > 0)
      .map(word => ({
        book_id: book.id,
        word: word
      }))

    if (wordsToInsert.length > 0) {
      const { error: wordsError } = await supabase
        .from("vocabulary_words")
        .insert(wordsToInsert)

      if (wordsError) {
        console.error("Error adding words:", wordsError)
        // Don't throw - book was created, just words failed
      }
    }

    // Update word count if filtered list is different
    if (wordsToInsert.length !== input.words.length) {
      await supabase
        .from("vocabulary_books")
        .update({ word_count: wordsToInsert.length })
        .eq("id", book.id)
      
      book.word_count = wordsToInsert.length
    }
  }

  // Initialize user book progress
  await supabase
    .from("user_book_progress")
    .insert({
      user_id: userId,
      book_id: book.id,
      mastered_count: 0,
      learning_count: 0,
      new_count: input.words.length,
      streak_days: 0,
      accuracy_percent: 0
    })

  return book
}

/**
 * Update a vocabulary book
 */
export async function updateBook(
  bookId: string,
  input: UpdateVocabularyBookInput
): Promise<VocabularyBook> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  const updateData: Record<string, unknown> = {}
  if (input.name !== undefined) updateData.name = input.name.trim()
  if (input.description !== undefined) updateData.description = input.description?.trim() || null
  if (input.cover_color !== undefined) updateData.cover_color = input.cover_color
  if (input.cover_text !== undefined) updateData.cover_text = input.cover_text?.trim() || null

  const { data, error } = await supabase
    .from("vocabulary_books")
    .update(updateData)
    .eq("id", bookId)
    .select()
    .single()

  if (error) {
    console.error("Error updating book:", error)
    throw new Error("Failed to update vocabulary book")
  }

  return data
}

/**
 * Delete a vocabulary book
 * Only allows deleting user's own books (not system books)
 */
export async function deleteBook(bookId: string, userId: string): Promise<void> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  const { error } = await supabase
    .from("vocabulary_books")
    .delete()
    .eq("id", bookId)
    .eq("user_id", userId)
    .eq("is_system_book", false)

  if (error) {
    console.error("Error deleting book:", error)
    throw new Error("Failed to delete vocabulary book")
  }
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
    console.error("Error fetching words:", error)
    throw new Error("Failed to fetch vocabulary words")
  }

  return data || []
}

/**
 * Add words to a vocabulary book
 */
export async function addWords(
  bookId: string,
  words: string[]
): Promise<VocabularyWord[]> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  const wordsToInsert = words
    .map(word => word.trim())
    .filter(word => word.length > 0)
    .map(word => ({
      book_id: bookId,
      word: word
    }))

  if (wordsToInsert.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from("vocabulary_words")
    .insert(wordsToInsert)
    .select()

  if (error) {
    console.error("Error adding words:", error)
    throw new Error("Failed to add vocabulary words")
  }

  // Update word count in the book
  const { count } = await supabase
    .from("vocabulary_words")
    .select("*", { count: "exact", head: true })
    .eq("book_id", bookId)

  if (count !== null) {
    await supabase
      .from("vocabulary_books")
      .update({ word_count: count })
      .eq("id", bookId)
  }

  return data || []
}

/**
 * Delete a word from a vocabulary book
 */
export async function deleteWord(wordId: string, bookId: string): Promise<void> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  const { error } = await supabase
    .from("vocabulary_words")
    .delete()
    .eq("id", wordId)

  if (error) {
    console.error("Error deleting word:", error)
    throw new Error("Failed to delete vocabulary word")
  }

  // Update word count in the book
  const { count } = await supabase
    .from("vocabulary_words")
    .select("*", { count: "exact", head: true })
    .eq("book_id", bookId)

  if (count !== null) {
    await supabase
      .from("vocabulary_books")
      .update({ word_count: count })
      .eq("id", bookId)
  }
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
    console.error("Error fetching book progress:", error)
    throw new Error("Failed to fetch book progress")
  }

  return data
}

/**
 * Vocabulary API object implementing the interface
 */
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
