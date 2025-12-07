/**
 * Supabase Edge Function: Retry Failed Words
 * Prepares failed words for retry by resetting their status
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface RetryFailedRequest {
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: RetryFailedRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // Verify user owns this book
    const { data: book } = await supabaseAdmin
      .from("vocabulary_books")
      .select("id, user_id, import_total")
      .eq("id", input.bookId)
      .single()

    if (!book) {
      return errorResponse("Book not found", 404)
    }

    if (book.user_id !== user.id) {
      return errorResponse("You don't have permission to retry this book", 403)
    }

    // Get failed words
    const { data: failedWords, error } = await supabaseAdmin
      .from("vocabulary_words")
      .select("id, word")
      .eq("book_id", input.bookId)
      .eq("import_status", "failed")
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Failed to get failed words:", error)
      return errorResponse("Failed to get failed words", 500)
    }

    if (!failedWords || failedWords.length === 0) {
      return successResponse({ message: "No failed words to retry", words: [] })
    }

    // Reset failed words status
    await supabaseAdmin
      .from("vocabulary_words")
      .update({
        import_status: "importing",
        import_error: null
      })
      .eq("book_id", input.bookId)
      .eq("import_status", "failed")

    // Update book status to importing
    // Calculate current progress (completed words)
    const { count: completedCount } = await supabaseAdmin
      .from("vocabulary_words")
      .select("*", { count: "exact", head: true })
      .eq("book_id", input.bookId)
      .eq("import_status", "completed")

    await supabaseAdmin
      .from("vocabulary_books")
      .update({
        import_status: "importing",
        import_progress: completedCount || 0,
        import_error: null
      })
      .eq("id", input.bookId)

    return successResponse({
      started: true,
      bookId: input.bookId,
      failedCount: failedWords.length,
      words: failedWords.map(w => ({ id: w.id, word: w.word }))
    })
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
