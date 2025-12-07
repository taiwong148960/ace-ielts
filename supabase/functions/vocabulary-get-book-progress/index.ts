/**
 * Supabase Edge Function: Get Book Progress
 * Returns user's progress on a specific vocabulary book
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("vocabulary-get-book-progress")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetBookProgressRequest {
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetBookProgressRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // Get user progress
    const { data: progress, error: progressError } = await supabaseAdmin
      .from("user_book_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("book_id", input.bookId)
      .single()

    if (progressError) {
      if (progressError.code === "PGRST116") {
        // Not found - return null (not an error)
        return successResponse(null, 200)
      }
      logger.error("Failed to fetch book progress", { bookId: input.bookId, userId: user.id }, new Error(progressError.message))
      return errorResponse("Failed to fetch book progress", 500)
    }

    logger.debug("Book progress fetched", { bookId: input.bookId, userId: user.id })
    return successResponse(progress, 200)
  } catch (error) {
    logger.error("Unexpected error", {}, error as Error)
    return errorResponse("Internal server error", 500)
  }
})
