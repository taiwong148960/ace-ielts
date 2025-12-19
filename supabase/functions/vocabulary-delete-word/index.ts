/**
 * Supabase Edge Function: Delete Word from Vocabulary Book
 * Deletes a word and updates the book's word count
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("vocabulary-delete-word")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface DeleteWordRequest {
  wordId: string
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: DeleteWordRequest = await req.json()

    if (!input.wordId || !input.bookId) {
      return errorResponse("Word ID and Book ID are required", 400)
    }

    // Verify user owns the book
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

    // Delete the word link
    const { error } = await supabaseAdmin
      .from("vocabulary_book_words")
      .delete()
      .eq("word_id", input.wordId)
      .eq("book_id", input.bookId)

    if (error) {
      logger.error("Failed to delete word", { wordId: input.wordId, bookId: input.bookId, userId: user.id }, new Error(error.message))
      return errorResponse("Failed to delete word", 500)
    }

    // Get updated word count
    const { data: book } = await supabaseAdmin
      .from("vocabulary_books")
      .select("word_count")
      .eq("id", input.bookId)
      .single()

    return successResponse({
      deleted: true,
      wordId: input.wordId,
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
