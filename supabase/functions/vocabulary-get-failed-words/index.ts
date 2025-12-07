/**
 * Supabase Edge Function: Get Failed Words
 * Returns list of failed words with error messages for a book
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetFailedWordsRequest {
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetFailedWordsRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // Verify user owns this book
    const { data: book } = await supabaseAdmin
      .from("vocabulary_books")
      .select("id, user_id, is_system_book")
      .eq("id", input.bookId)
      .single()

    if (!book) {
      return errorResponse("Book not found", 404)
    }

    if (!book.is_system_book && book.user_id !== user.id) {
      return errorResponse("You don't have permission to view this book", 403)
    }

    // Get failed words
    const { data: words, error: wordsError } = await supabaseAdmin
      .from("vocabulary_words")
      .select("word, import_error")
      .eq("book_id", input.bookId)
      .eq("import_status", "failed")
      .not("import_error", "is", null)

    if (wordsError) {
      console.error("Failed to fetch failed words:", wordsError)
      return errorResponse("Failed to fetch failed words", 500)
    }

    const failedWords = (words || [])
      .filter((item) => item.import_error)
      .map((item) => ({
        word: item.word,
        error: item.import_error as string
      }))

    return successResponse(failedWords)
  } catch (error) {
    console.error("Edge function error:", error)
    
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
