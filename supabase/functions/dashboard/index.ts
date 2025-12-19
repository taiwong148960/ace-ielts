
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"
import { Router } from "../_shared/router.ts"

const logger = createLogger("dashboard")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

const router = new Router()

router.get("/study-stats", handleGetStudyStats)
router.get("/browsing-history", handleGetBrowsingHistory)
router.get("/takeaway-stats", handleGetTakeawayStats)

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  
  try {
    return await router.handle(req)
  } catch (error) {
    logger.error("Router error", {}, error as Error)
    return errorResponse(error instanceof Error ? error.message : "Internal server error", 500)
  }
})

// ============================================================================
// Handlers
// ============================================================================

async function handleGetStudyStats(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))

  // Get max streak
  const { data: progressData } = await supabaseAdmin
    .from("vocabulary_user_book_progress")
    .select("streak_days")
    .eq("user_id", user.id)

  const dayStreak = progressData && progressData.length > 0
    ? Math.max(...progressData.map((p: { streak_days?: number }) => p.streak_days || 0))
    : 0

  // Calculate today's study time
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStart = today.toISOString()

  const { data: todayReviews } = await supabaseAdmin
    .from("vocabulary_review_logs")
    .select("review_time_ms")
    .eq("user_id", user.id)
    .gte("reviewed_at", todayStart)

  const todayMinutes = todayReviews
    ? Math.round((todayReviews.reduce((sum: number, r: { review_time_ms?: number }) => sum + (r.review_time_ms || 30000), 0) / 1000) / 60)
    : 0

  // Calculate total study time
  const { data: allReviews } = await supabaseAdmin
    .from("vocabulary_review_logs")
    .select("review_time_ms")
    .eq("user_id", user.id)

  const totalMinutes = allReviews
    ? Math.round((allReviews.reduce((sum: number, r: { review_time_ms?: number }) => sum + (r.review_time_ms || 30000), 0) / 1000) / 60)
    : 0

  return successResponse({ dayStreak, todayMinutes, totalMinutes })
}

async function handleGetBrowsingHistory(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get("limit") || "10")

  logger.info("Fetching browsing history", { userId: user.id, limit })

  const { data: reviews, error } = await supabaseAdmin
    .from("vocabulary_review_logs")
    .select("id, word_id, book_id, reviewed_at")
    .eq("user_id", user.id)
    .order("reviewed_at", { ascending: false })
    .limit(limit)

  if (error || !reviews || reviews.length === 0) return successResponse([])

  const wordIds = Array.from(new Set(reviews.map((r: { word_id: string }) => r.word_id)))
  const bookIds = Array.from(new Set(reviews.map((r: { book_id: string }) => r.book_id)))

  const [wordsResult, booksResult] = await Promise.all([
    supabaseAdmin.from("vocabulary_words").select("id, word, book_id").in("id", wordIds),
    supabaseAdmin.from("vocabulary_books").select("id, name").in("id", bookIds)
  ])

  const wordsMap = new Map((wordsResult.data || []).map((w: { id: string; word: string; book_id: string }) => [w.id, w]))
  const booksMap = new Map((booksResult.data || []).map((b: { id: string; name: string }) => [b.id, b]))

  const historyItems = []
  for (const review of reviews) {
    const word = wordsMap.get(review.word_id) as { word: string } | undefined
    const book = booksMap.get(review.book_id) as { name: string } | undefined
    if (word) {
      historyItems.push({
        id: review.id,
        type: "word",
        title: word.word,
        source: book?.name || "Vocabulary",
        timestamp: review.reviewed_at,
        url: undefined
      })
    }
  }

  return successResponse(historyItems)
}

async function handleGetTakeawayStats(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const url = new URL(req.url)
  const timeRange = url.searchParams.get("timeRange") || "week"

  logger.info("Fetching takeaway stats", { userId: user.id, timeRange })

  if (!["day", "week", "month", "all"].includes(timeRange)) {
    return errorResponse("Invalid timeRange", 400)
  }

  const now = new Date()
  let startDate: Date

  switch (timeRange) {
    case "day": startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
    case "week": startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case "month": startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    case "all": startDate = new Date(0); break;
    default: startDate = new Date(0);
  }

  const { data: reviews } = await supabaseAdmin
    .from("vocabulary_review_logs")
    .select("word_id")
    .eq("user_id", user.id)
    .gte("reviewed_at", startDate.toISOString())

  const uniqueWords = reviews ? new Set(reviews.map((r: { word_id: string }) => r.word_id)).size : 0

  return successResponse({
    wordsViewed: uniqueWords,
    articlesRead: 0,
    videosWatched: 0,
    timeRange
  })
}
