/**
 * Supabase Edge Function: Start Vocabulary Import
 * Starts the import workflow for a vocabulary book
 * This function updates status and starts the background import process
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface StartImportRequest {
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: StartImportRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // Verify user owns this book
    const { data: book } = await supabaseAdmin
      .from("vocabulary_books")
      .select("id, user_id, word_count, import_status")
      .eq("id", input.bookId)
      .single()

    if (!book) {
      return errorResponse("Book not found", 404)
    }

    if (book.user_id !== user.id) {
      return errorResponse("You don't have permission to import this book", 403)
    }

    // Check if already importing
    if (book.import_status === "importing") {
      return errorResponse("Import already in progress", 400)
    }

    // Get all words for the book
    const { data: words, error: wordsError } = await supabaseAdmin
      .from("vocabulary_words")
      .select("id, word")
      .eq("book_id", input.bookId)

    if (wordsError || !words || words.length === 0) {
      return errorResponse("No words found in book", 400)
    }

    // Update book import status to 'importing'
    const { error: updateError } = await supabaseAdmin
      .from("vocabulary_books")
      .update({
        import_status: "importing",
        import_progress: 0,
        import_total: words.length,
        import_started_at: new Date().toISOString(),
        import_error: null
      })
      .eq("id", input.bookId)

    if (updateError) {
      console.error("Failed to update book import status:", updateError)
      return errorResponse("Failed to start import", 500)
    }

    // Reset all words' status
    await supabaseAdmin
      .from("vocabulary_words")
      .update({
        import_status: "importing",
        import_error: null
      })
      .eq("book_id", input.bookId)

    // Note: The actual word-by-word import will be handled by the client
    // calling gemini-enrich-word for each word sequentially
    // This is because Edge Functions have a 60s timeout limit
    // The client will poll import progress and handle the sequential enrichment

    return successResponse({
      started: true,
      bookId: input.bookId,
      wordCount: words.length,
      words: words.map(w => ({ id: w.id, word: w.word }))
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
