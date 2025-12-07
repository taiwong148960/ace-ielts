/**
 * Supabase Edge Function: Add Words to Vocabulary Book
 * Adds new words to an existing vocabulary book
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"

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
    const wordsToInsert = input.words
      .map(word => typeof word === "string" ? word.trim() : "")
      .filter(word => word.length > 0)
      .map(word => ({
        book_id: input.bookId,
        word: word
      }))

    if (wordsToInsert.length === 0) {
      return errorResponse("No valid words provided", 400)
    }

    // Insert words
    const { data: insertedWords, error: insertError } = await supabaseAdmin
      .from("vocabulary_words")
      .insert(wordsToInsert)
      .select()

    if (insertError) {
      console.error("Failed to add words:", insertError)
      return errorResponse("Failed to add words", 500)
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
      words: insertedWords,
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
