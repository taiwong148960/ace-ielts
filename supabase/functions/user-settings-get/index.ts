/**
 * Supabase Edge Function: Get User Settings
 * Returns user settings (without decrypted API key)
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("user-settings-get")

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

    // Get user settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (settingsError) {
      if (settingsError.code === "PGRST116") {
        // Not found - return null (not an error)
        return successResponse(null, 200)
      }
      logger.error("Failed to fetch user settings", { userId: user.id }, new Error(settingsError.message))
      return errorResponse("Failed to fetch user settings", 500)
    }

    logger.debug("User settings fetched", { userId: user.id })
    return successResponse(settings, 200)
  } catch (error) {
    logger.error("Unexpected error", {}, error as Error)
    return errorResponse("Internal server error", 500)
  }
})
