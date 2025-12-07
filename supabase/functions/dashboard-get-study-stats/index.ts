/**
 * Supabase Edge Function: Get Study Stats
 * Returns study statistics for dashboard
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "@supabase/functions/_shared/logger.ts"

const logger = createLogger("dashboard-get-study-stats")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    // Get max streak from user_book_progress
    const { data: progressData, error: progressError } = await supabaseAdmin
      .from("user_book_progress")
      .select("streak_days")
      .eq("user_id", user.id)

    if (progressError) {
      logger.warn("Failed to fetch book progress for study stats", { userId: user.id }, new Error(progressError.message))
    }

    const dayStreak = progressData && progressData.length > 0
      ? Math.max(...progressData.map(p => p.streak_days || 0))
      : 0

    // Calculate today's study time from review_logs
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.toISOString()

    const { data: todayReviews, error: todayError } = await supabaseAdmin
      .from("review_logs")
      .select("review_time_ms")
      .eq("user_id", user.id)
      .gte("reviewed_at", todayStart)

    if (todayError) {
      logger.warn("Failed to fetch today's reviews", { userId: user.id }, new Error(todayError.message))
    }

    const todayMinutes = todayReviews
      ? Math.round(
          (todayReviews.reduce((sum, r) => sum + (r.review_time_ms || 30000), 0) / 1000) / 60
        )
      : 0

    // Calculate total study time from all review_logs
    const { data: allReviews, error: allError } = await supabaseAdmin
      .from("review_logs")
      .select("review_time_ms")
      .eq("user_id", user.id)

    if (allError) {
      logger.warn("Failed to fetch all reviews", { userId: user.id }, new Error(allError.message))
    }

    const totalMinutes = allReviews
      ? Math.round(
          (allReviews.reduce((sum, r) => sum + (r.review_time_ms || 30000), 0) / 1000) / 60
        )
      : 0

    return successResponse({
      dayStreak,
      todayMinutes,
      totalMinutes
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
