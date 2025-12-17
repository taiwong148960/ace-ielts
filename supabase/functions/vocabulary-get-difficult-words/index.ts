/**
 * Supabase Edge Function: Get Difficult Words
 * Returns difficult words (high lapse count or low stability) for a book
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "@supabase/functions/_shared/logger.ts"
import type { FSRSState } from "../_shared/types.ts"

const logger = createLogger("vocabulary-get-difficult-words")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetDifficultWordsRequest {
  bookId: string
  limit?: number
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetDifficultWordsRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    const limit = input.limit || 5

    // Verify access
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

    // Get difficult words
    const { data } = await supabaseAdmin
      .from("vocabulary_user_word_progress")
      .select(`
        word_id,
        state,
        stability,
        due_at,
        last_review_at,
        lapses,
        vocabulary_words!inner (
          id,
          word,
          phonetic,
          definition,
          import_status
        )
      `)
      .eq("user_id", user.id)
      .eq("book_id", input.bookId)
      .eq("vocabulary_words.import_status", "done")
      .gt("lapses", 0)
      .order("lapses", { ascending: false })
      .order("stability", { ascending: true })
      .limit(limit)

    const words = (data || []).map((p: any) => ({
      id: p.word_id,
      word: p.vocabulary_words.word,
      phonetic: p.vocabulary_words.phonetic,
      definition: p.vocabulary_words.definition,
      state: p.state as FSRSState,
      stability: p.stability,
      due_at: p.due_at,
      last_review_at: p.last_review_at,
      lapses: p.lapses
    }))

    return successResponse(words)
  } catch (error) {
    logger.error("Edge function error", {}, error instanceof Error ? error : new Error(String(error)))
    
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
