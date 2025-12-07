/**
 * Supabase Edge Function: Get Browsing History
 * Returns browsing history from review logs
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("dashboard-get-browsing-history")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetBrowsingHistoryRequest {
  limit?: number
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetBrowsingHistoryRequest = await req.json()
    const limit = input.limit || 10

    // Get recent reviews with word information
    const { data: reviews, error } = await supabaseAdmin
      .from("review_logs")
      .select("id, word_id, book_id, reviewed_at")
      .eq("user_id", user.id)
      .order("reviewed_at", { ascending: false })
      .limit(limit)

    if (error) {
      logger.warn("Failed to fetch browsing history", { userId: user.id, limit }, new Error(error.message))
      return successResponse([])
    }

    if (!reviews || reviews.length === 0) {
      return successResponse([])
    }

    // Get unique word IDs and book IDs
    const wordIds = Array.from(new Set(reviews.map(r => r.word_id)))
    const bookIds = Array.from(new Set(reviews.map(r => r.book_id)))

    // Fetch words and books in parallel
    const [wordsResult, booksResult] = await Promise.all([
      supabaseAdmin
        .from("vocabulary_words")
        .select("id, word, book_id")
        .in("id", wordIds),
      supabaseAdmin
        .from("vocabulary_books")
        .select("id, name")
        .in("id", bookIds)
    ])

    if (wordsResult.error) {
      logger.warn("Failed to fetch words for browsing history", { userId: user.id }, new Error(wordsResult.error.message))
      return successResponse([])
    }

    if (booksResult.error) {
      logger.warn("Failed to fetch books for browsing history", { userId: user.id }, new Error(booksResult.error.message))
      return successResponse([])
    }

    // Create maps for quick lookup
    const wordsMap = new Map(
      (wordsResult.data || []).map(w => [w.id, w])
    )
    const booksMap = new Map(
      (booksResult.data || []).map(b => [b.id, b])
    )

    // Build browsing history items
    const historyItems = []

    for (const review of reviews) {
      const word = wordsMap.get(review.word_id)
      const book = booksMap.get(review.book_id)

      if (word) {
        historyItems.push({
          id: review.id,
          type: "word" as const,
          title: word.word,
          source: book?.name || "Vocabulary",
          timestamp: review.reviewed_at,
          url: undefined
        })
      }
    }

    return successResponse(historyItems)
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
