/**
 * Supabase Edge Function: Get Book Settings
 * Returns book settings for a user and book, or default settings if not found
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("vocabulary-get-book-settings")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetBookSettingsRequest {
  bookId: string
}

// Default book settings
const DEFAULT_SETTINGS = {
  daily_new_limit: 20,
  daily_review_limit: 100,
  learning_mode: "meaning" as const,
  study_order: "random" as const
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetBookSettingsRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // Get book settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("book_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("book_id", input.bookId)
      .single()

    if (settingsError) {
      if (settingsError.code === "PGRST116") {
        // Not found - return default settings
        const defaultSettings = {
          id: "",
          user_id: user.id,
          book_id: input.bookId,
          ...DEFAULT_SETTINGS,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        logger.debug("Returning default settings", { bookId: input.bookId, userId: user.id })
        return successResponse(defaultSettings, 200)
      }
      logger.error("Failed to fetch book settings", { bookId: input.bookId, userId: user.id }, new Error(settingsError.message))
      return errorResponse("Failed to fetch book settings", 500)
    }

    logger.debug("Book settings fetched", { bookId: input.bookId, userId: user.id })
    return successResponse(settings, 200)
  } catch (error) {
    logger.error("Unexpected error", {}, error as Error)
    return errorResponse("Internal server error", 500)
  }
})
