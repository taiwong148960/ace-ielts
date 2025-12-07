/**
 * Supabase Edge Function: Get Vocabulary Book
 * Returns a single vocabulary book by ID
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("vocabulary-get-book")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetBookRequest {
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetBookRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // Get book
    const { data: book, error: bookError } = await supabaseAdmin
      .from("vocabulary_books")
      .select("*")
      .eq("id", input.bookId)
      .single()

    if (bookError) {
      if (bookError.code === "PGRST116") {
        return successResponse(null, 200)
      }
      logger.error("Failed to fetch book", { bookId: input.bookId, userId: user.id }, new Error(bookError.message))
      return errorResponse("Failed to fetch vocabulary book", 500)
    }

    // Verify access (user owns it or it's a system book)
    if (!book.is_system_book && book.user_id !== user.id) {
      return errorResponse("You don't have permission to view this book", 403)
    }

    logger.debug("Book fetched", { bookId: input.bookId, userId: user.id })
    return successResponse(book, 200)
  } catch (error) {
    logger.error("Unexpected error", {}, error as Error)
    return errorResponse("Internal server error", 500)
  }
})
