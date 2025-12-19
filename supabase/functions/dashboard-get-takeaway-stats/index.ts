/**
 * Supabase Edge Function: Get Takeaway Stats
 * Returns takeaway statistics for a given time range
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("dashboard-get-takeaway-stats")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetTakeawayStatsRequest {
  timeRange: "day" | "week" | "month" | "all"
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetTakeawayStatsRequest = await req.json()

    if (!input.timeRange || !["day", "week", "month", "all"].includes(input.timeRange)) {
      return errorResponse("Time range must be 'day', 'week', 'month', or 'all'", 400)
    }

    // Calculate date range
    const now = new Date()
    let startDate: Date

    switch (input.timeRange) {
      case "day":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "all":
        startDate = new Date(0) // Beginning of time
        break
    }

    // Count unique words viewed from vocabulary_review_logs
    const { data: reviews, error } = await supabaseAdmin
      .from("vocabulary_review_logs")
      .select("word_id")
      .eq("user_id", user.id)
      .gte("reviewed_at", startDate.toISOString())

    if (error) {
      logger.warn("Failed to fetch reviews for takeaway stats", { userId: user.id, timeRange: input.timeRange }, new Error(error.message))
    }

    const uniqueWords = reviews
      ? new Set(reviews.map(r => r.word_id)).size
      : 0

    // For now, articles and videos are not tracked, return 0
    return successResponse({
      wordsViewed: uniqueWords,
      articlesRead: 0,
      videosWatched: 0,
      timeRange: input.timeRange
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
