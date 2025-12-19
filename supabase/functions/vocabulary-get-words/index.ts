/**
 * Supabase Edge Function: Get Vocabulary Words
 * Returns all words in a vocabulary book
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("vocabulary-get-words")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetWordsRequest {
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetWordsRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // First verify book access
    const { data: book, error: bookError } = await supabaseAdmin
      .from("vocabulary_books")
      .select("id, user_id, is_system_book")
      .eq("id", input.bookId)
      .single()

    if (bookError || !book) {
      return errorResponse("Book not found", 404)
    }

    // Verify access (user owns it or it's a system book)
    if (!book.is_system_book && book.user_id !== user.id) {
      return errorResponse("You don't have permission to view this book", 403)
    }

    // Get words
    const { data: words, error: wordsError } = await supabaseAdmin
      .rpc("get_book_words", {
        p_book_id: input.bookId
      })

    if (wordsError) {
      logger.error("Failed to fetch words", { bookId: input.bookId, userId: user.id }, new Error(wordsError.message))
      return errorResponse("Failed to fetch vocabulary words", 500)
    }

    logger.debug("Words fetched", { bookId: input.bookId, userId: user.id, wordCount: words?.length || 0 })
    return successResponse(words || [], 200)
  } catch (error) {
    logger.error("Unexpected error", {}, error as Error)
    return errorResponse("Internal server error", 500)
  }
})
