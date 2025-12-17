/**
 * Supabase Edge Function: Create Vocabulary Book
 * Creates a new vocabulary book with words and initializes user progress
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "@supabase/functions/_shared/logger.ts"
import { BOOK_COVER_COLORS, type CreateBookInput } from "../_shared/types.ts"

// Create logger for this function
const logger = createLogger("vocabulary-create-book")

// Declare Deno global
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Initialize Supabase with auth
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    // Get request body
    const input: CreateBookInput = await req.json()

    // Validate input
    if (!input.name || typeof input.name !== "string" || input.name.trim().length === 0) {
      return errorResponse("Book name is required", 400)
    }

    if (!input.words || !Array.isArray(input.words)) {
      return errorResponse("Words array is required", 400)
    }

    // Filter and clean words
    const cleanedWords = input.words
      .map(word => typeof word === "string" ? word.trim() : "")
      .filter(word => word.length > 0)

    // Create the book
    const bookData = {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      cover_color: input.cover_color || BOOK_COVER_COLORS[Math.floor(Math.random() * BOOK_COVER_COLORS.length)],
      cover_text: input.cover_text?.trim() || null,
      book_type: input.book_type || "custom",
      is_system_book: false,
      user_id: user.id,
      word_count: cleanedWords.length,
      import_status: cleanedWords.length > 0 ? "importing" : "done"
    }

    const { data: book, error: bookError } = await supabaseAdmin
      .from("vocabulary_books")
      .insert(bookData)
      .select()
      .single()

    if (bookError) {
      logger.error("Failed to create book", { userId: user.id, bookName: input.name }, new Error(bookError.message))
      return errorResponse("Failed to create vocabulary book", 500)
    }

    logger.info("Book created", { bookId: book.id, userId: user.id, bookName: input.name })

    // Add words to the book
    if (cleanedWords.length > 0) {
      const { error: wordsError } = await supabaseAdmin
        .rpc("add_words_to_book", {
          p_book_id: book.id,
          p_words: cleanedWords
        })

      if (wordsError) {
        logger.warn("Failed to add words to book", { bookId: book.id, wordCount: cleanedWords.length }, new Error(wordsError.message))
        // Don't fail - book was created, just words failed
      } else {
        logger.info("Words added to book", { bookId: book.id, wordCount: cleanedWords.length })
      }
    }

    // Initialize user book progress
    const { error: progressError } = await supabaseAdmin
      .from("vocabulary_user_book_progress")
      .insert({
        user_id: user.id,
        book_id: book.id,
        mastered_count: 0,
        learning_count: 0,
        new_count: cleanedWords.length,
        streak_days: 0,
        accuracy_percent: 0
      })

    if (progressError) {
      logger.warn("Failed to create book progress", { bookId: book.id, userId: user.id }, new Error(progressError.message))
      // Don't fail - book was created
    }

    return successResponse(book)
  } catch (error) {
    logger.error("Edge function error", {}, error instanceof Error ? error : new Error(String(error)))
    
    if (error instanceof Error) {
      if (error.message === "Unauthorized" || error.message === "Missing authorization header") {
        return errorResponse(error.message, 401)
      }
    }
    
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    )
  }
})
