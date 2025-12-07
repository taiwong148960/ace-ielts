/**
 * Supabase Edge Function: Create User Settings
 * Creates default user settings for a new user
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("user-settings-create")

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

    // Check if settings already exist
    const { data: existing } = await supabaseAdmin
      .from("user_settings")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (existing) {
      return errorResponse("User settings already exist", 400)
    }

    // Create default settings
    const { data, error } = await supabaseAdmin
      .from("user_settings")
      .insert({
        user_id: user.id,
        llm_provider: "gemini"
      })
      .select()
      .single()

    if (error) {
      logger.error("Failed to create user settings", { userId: user.id }, new Error(error.message))
      return errorResponse("Failed to create user settings", 500)
    }
    
    logger.info("User settings created", { userId: user.id })
    return successResponse(data)
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
