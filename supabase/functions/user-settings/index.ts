
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"
import { Router } from "../_shared/router.ts"
import { DEFAULT_GEMINI_MODEL_CONFIG } from "../_shared/types.ts"

const logger = createLogger("user-settings")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

const router = new Router()

router.get("/", handleGetSettings)
router.patch("/", handleUpdateSettings)

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

async function handleGetSettings(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))

  logger.info("Fetching user settings", { userId: user.id })

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (settingsError) {
    if (settingsError.code === "PGRST116") {
      // No settings found - return default settings with placeholder id
      // The id will be generated when settings are first saved
      const defaultSettings = {
        id: "", // Placeholder - will be set when saved
        user_id: user.id,
        llm_api_key_encrypted: null,
        llm_provider: "gemini" as const,
        gemini_model_config: DEFAULT_GEMINI_MODEL_CONFIG,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      return successResponse(defaultSettings, 200)
    }
    return errorResponse("Failed to fetch user settings", 500)
  }

  // Return user settings as-is, even if gemini_model_config is null
  // Only use defaults when user has never set settings (handled above)
  return successResponse(settings, 200)
}

async function handleUpdateSettings(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const input = await req.json()

  // Validate that all required fields are provided (full configuration required)
  if (!input.llm_provider || !input.gemini_model_config) {
    return errorResponse("llm_provider and gemini_model_config are required", 400)
  }

  logger.info("Updating user settings with full configuration", { userId: user.id, llm_provider: input.llm_provider })

  const { data: existing } = await supabaseAdmin
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single()

  let settings

  if (existing) {
    // User has settings - replace with full configuration
    const { data, error } = await supabaseAdmin
      .from("user_settings")
      .update({
        llm_provider: input.llm_provider,
        gemini_model_config: input.gemini_model_config
      })
      .eq("id", existing.id)
      .select().single()
    if (error) return errorResponse("Failed to update user settings", 500)
    settings = data
  } else {
    // User has never set settings - create with full configuration
    const { data, error } = await supabaseAdmin
      .from("user_settings")
      .insert({
        user_id: user.id,
        llm_provider: input.llm_provider,
        gemini_model_config: input.gemini_model_config
      })
      .select().single()
    if (error) return errorResponse("Failed to create user settings", 500)
    settings = data
  }

  logger.info("User settings updated successfully", { userId: user.id })

  return successResponse(settings)
}
