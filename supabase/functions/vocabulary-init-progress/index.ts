/**
 * Supabase Edge Function: Initialize Book Progress
 * Initializes user's progress tracking for a vocabulary book
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface InitProgressRequest {
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: InitProgressRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // Check if already exists
    const { data: existing } = await supabaseAdmin
      .from("user_book_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("book_id", input.bookId)
      .single()

    if (existing) {
      return successResponse(existing)
    }

    // Get word count
    const { data: book } = await supabaseAdmin
      .from("vocabulary_books")
      .select("word_count")
      .eq("id", input.bookId)
      .single()

    if (!book) {
      return errorResponse("Book not found", 404)
    }

    const wordCount = book.word_count || 0

    // Create progress
    const { data: progress, error } = await supabaseAdmin
      .from("user_book_progress")
      .insert({
        user_id: user.id,
        book_id: input.bookId,
        mastered_count: 0,
        learning_count: 0,
        new_count: wordCount,
        streak_days: 0,
        accuracy_percent: 0,
        total_reviews: 0,
        reviews_today: 0,
        new_words_today: 0,
        last_review_date: null,
        daily_new_limit: 20,
        daily_review_limit: 100
      })
      .select()
      .single()

    if (error) {
      console.error("Failed to initialize book progress:", error)
      return errorResponse("Failed to initialize book progress", 500)
    }

    return successResponse(progress)
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
