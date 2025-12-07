/**
 * Supabase Edge Function: Delete Vocabulary Book
 * Deletes a user's vocabulary book (not system books)
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "@supabase/functions/_shared/logger.ts"

const logger = createLogger("vocabulary-delete-book")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface DeleteBookRequest {
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: DeleteBookRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // Verify user owns this book and it's not a system book
    const { data: existingBook } = await supabaseAdmin
      .from("vocabulary_books")
      .select("id, user_id, is_system_book")
      .eq("id", input.bookId)
      .single()

    if (!existingBook) {
      return errorResponse("Book not found", 404)
    }

    if (existingBook.is_system_book) {
      return errorResponse("Cannot delete system books", 403)
    }

    if (existingBook.user_id !== user.id) {
      return errorResponse("You don't have permission to delete this book", 403)
    }

    // Delete will cascade to vocabulary_words, user_word_progress, user_book_progress
    const { error } = await supabaseAdmin
      .from("vocabulary_books")
      .delete()
      .eq("id", input.bookId)

    if (error) {
      logger.error("Failed to delete book", { bookId: input.bookId, userId: user.id }, new Error(error.message))
      return errorResponse("Failed to delete vocabulary book", 500)
    }

    return successResponse({ deleted: true, bookId: input.bookId })
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
