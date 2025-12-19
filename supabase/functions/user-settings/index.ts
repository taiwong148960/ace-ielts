
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"
import { Router } from "../_shared/router.ts"
import { encrypt, safeDecrypt } from "../_shared/crypto.ts"

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
router.get("/api-key", handleGetApiKey)

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

  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (settingsError) {
    if (settingsError.code === "PGRST116") {
      return successResponse(null, 200)
    }
    return errorResponse("Failed to fetch user settings", 500)
  }

  return successResponse(settings, 200)
}

async function handleUpdateSettings(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const input = await req.json()

  const updateData: Record<string, unknown> = {}
  
  if (input.llm_provider !== undefined) updateData.llm_provider = input.llm_provider
  if (input.llm_api_key !== undefined) updateData.llm_api_key_encrypted = await encrypt(input.llm_api_key)
  if (input.gemini_model_config !== undefined) updateData.gemini_model_config = input.gemini_model_config

  if (Object.keys(updateData).length === 0) return errorResponse("No settings to update", 400)

  const { data: existing } = await supabaseAdmin
    .from("user_settings")
    .select("id")
    .eq("user_id", user.id)
    .single()

  let settings

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("user_settings")
      .update(updateData)
      .eq("id", existing.id)
      .select().single()
    if (error) return errorResponse("Failed to update user settings", 500)
    settings = data
  } else {
    const { data, error } = await supabaseAdmin
      .from("user_settings")
      .insert({
        user_id: user.id,
        llm_provider: input.llm_provider || "gemini",
        ...updateData
      })
      .select().single()
    if (error) return errorResponse("Failed to create user settings", 500)
    settings = data
  }

  const safeSettings = {
    ...settings,
    llm_api_key_encrypted: settings.llm_api_key_encrypted ? "[ENCRYPTED]" : null
  }

  return successResponse(safeSettings)
}

async function handleGetApiKey(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))

  const { data: settings, error } = await supabaseAdmin
    .from("user_settings")
    .select("llm_api_key_encrypted, llm_provider")
    .eq("user_id", user.id)
    .single()

  if (error || !settings) {
    return successResponse({ hasApiKey: false, apiKey: null, provider: null })
  }

  if (!settings.llm_api_key_encrypted) {
    return successResponse({ hasApiKey: false, apiKey: null, provider: settings.llm_provider })
  }

  const decryptedKey = await safeDecrypt(settings.llm_api_key_encrypted)
  if (!decryptedKey) return errorResponse("Failed to decrypt API key", 500)

  return successResponse({
    hasApiKey: true,
    apiKey: decryptedKey,
    provider: settings.llm_provider
  })
}
