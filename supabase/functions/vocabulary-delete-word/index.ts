/**
 * Supabase Edge Function: Delete Word from Vocabulary Book
 * Deletes a word and updates the book's word count
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"

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

    // Delete the word
    const { error } = await supabaseAdmin
      .from("vocabulary_words")
      .delete()
      .eq("id", input.wordId)
      .eq("book_id", input.bookId)

    if (error) {
      console.error("Failed to delete word:", error)
      return errorResponse("Failed to delete word", 500)
    }

    // Update word count in the book
    const { count } = await supabaseAdmin
      .from("vocabulary_words")
      .select("*", { count: "exact", head: true })
      .eq("book_id", input.bookId)

    if (count !== null) {
      await supabaseAdmin
        .from("vocabulary_books")
        .update({ word_count: count })
        .eq("id", input.bookId)
    }

    return successResponse({
      deleted: true,
      wordId: input.wordId,
      wordCount: count
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
