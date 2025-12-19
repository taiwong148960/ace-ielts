/**
 * Supabase Edge Function: Add Words to Vocabulary Book
 * Adds new words to an existing vocabulary book
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("vocabulary-add-words")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface AddWordsRequest {
  bookId: string
  words: string[]
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: AddWordsRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    if (!input.words || !Array.isArray(input.words) || input.words.length === 0) {
      return errorResponse("Words array is required", 400)
    }

    // Verify user owns this book
    const { data: existingBook } = await supabaseAdmin
      .from("vocabulary_books")
      .select("id, user_id")
      .eq("id", input.bookId)
      .single()

    if (!existingBook) {
      return errorResponse("Book not found", 404)
    }

    if (existingBook.user_id !== user.id) {
      return errorResponse("You don't have permission to modify this book", 403)
    }

    // Filter and clean words
    const cleanedWords = input.words
      .map(word => typeof word === "string" ? word.trim() : "")
      .filter(word => word.length > 0)

    if (cleanedWords.length === 0) {
      return errorResponse("No valid words provided", 400)
    }

    // Insert words using RPC
    const { data: processedCount, error: insertError } = await supabaseAdmin
      .rpc("add_words_to_book", {
        p_book_id: input.bookId,
        p_words: cleanedWords
      })

    if (insertError) {
      logger.error("Failed to add words", { bookId: input.bookId, userId: user.id, wordCount: cleanedWords.length }, new Error(insertError.message))
      return errorResponse("Failed to add words", 500)
    }

    // Get updated word count
    const { data: book } = await supabaseAdmin
      .from("vocabulary_books")
      .select("word_count")
      .eq("id", input.bookId)
      .single()

    return successResponse({
      words: [], // RPC doesn't return word objects
      wordCount: book?.word_count || 0
    })
  } catch (error) {
    logger.error("Edge function error", {}, error as Error)
    
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
