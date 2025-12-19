/**
 * Supabase Edge Function: Get Decrypted API Key
 * Returns the decrypted LLM API key for the authenticated user
 * Used in self-hosted mode for client-side API calls
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { safeDecrypt } from "../_shared/crypto.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("user-settings-get-api-key")

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
    const { data: settings, error } = await supabaseAdmin
      .from("user_settings")
      .select("llm_api_key_encrypted, llm_provider")
      .eq("user_id", user.id)
      .single()

    if (error || !settings) {
      return successResponse({
        hasApiKey: false,
        apiKey: null,
        provider: null
      })
    }

    if (!settings.llm_api_key_encrypted) {
      return successResponse({
        hasApiKey: false,
        apiKey: null,
        provider: settings.llm_provider
      })
    }

    // Decrypt the API key
    const decryptedKey = await safeDecrypt(settings.llm_api_key_encrypted)

    if (!decryptedKey) {
      logger.error("Failed to decrypt API key for user", { userId: user.id })
      return errorResponse("Failed to decrypt API key", 500)
    }

    return successResponse({
      hasApiKey: true,
      apiKey: decryptedKey,
      provider: settings.llm_provider
    })
  } catch (error) {
    logger.error("Edge function error", {}, error as Error)
    
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
