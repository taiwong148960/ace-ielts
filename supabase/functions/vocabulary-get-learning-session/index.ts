/**
 * Supabase Edge Function: Get Today's Learning Session
 * Returns words to review and new words for today's learning session
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "@supabase/functions/_shared/logger.ts"
import type { FSRSState } from "../_shared/types.ts"

const logger = createLogger("vocabulary-get-learning-session")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetLearningSessionRequest {
  bookId: string
  newLimit?: number
  reviewLimit?: number
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetLearningSessionRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    const newLimit = input.newLimit || 20
    const reviewLimit = input.reviewLimit || 100
    const now = new Date()

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

    // Get words due for review (only completed words)
    const { data: dueProgress } = await supabaseAdmin
      .from("user_word_progress")
      .select(`
        id,
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
      .eq("vocabulary_words.import_status", "completed")
      .lte("due_at", now.toISOString())
      .order("due_at")
      .limit(reviewLimit)

    const reviewWords = (dueProgress || []).map((p: any) => ({
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

    // Get new words (words without progress, only completed words)
    const { data: allWords } = await supabaseAdmin
      .from("vocabulary_words")
      .select("id, word, phonetic, definition")
      .eq("book_id", input.bookId)
      .eq("import_status", "completed")

    const { data: existingProgress } = await supabaseAdmin
      .from("user_word_progress")
      .select("word_id")
      .eq("user_id", user.id)
      .eq("book_id", input.bookId)

    const existingWordIds = new Set((existingProgress || []).map((p: any) => p.word_id))
    const newWordsData = (allWords || [])
      .filter((w: any) => !existingWordIds.has(w.id))
      .slice(0, newLimit)

    const newWords = newWordsData.map((w: any) => ({
      id: w.id,
      word: w.word,
      phonetic: w.phonetic,
      definition: w.definition,
      state: "new" as FSRSState,
      stability: 0,
      due_at: null,
      last_review_at: null,
      lapses: 0
    }))

    const totalCount = reviewWords.length + newWords.length
    const estimatedMinutes = Math.ceil(totalCount * 0.5)

    return successResponse({
      reviewWords,
      newWords,
      totalCount,
      estimatedMinutes
    })
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
