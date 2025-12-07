/**
 * Supabase Edge Function: Update User Settings
 * Updates user settings including encrypted LLM API keys
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface UpdateSettingsInput {
  llm_provider?: string
  llm_api_key?: string
  gemini_model_config?: {
    model?: string
    temperature?: number
    topK?: number
    topP?: number
    maxOutputTokens?: number
  }
}

/**
 * Simple encryption for API keys
 * In production, use Supabase Vault or proper encryption
 */
function encryptApiKey(apiKey: string): string {
  // Base64 encoding as a simple obfuscation
  // TODO: Use proper encryption (Supabase Vault recommended)
  return btoa(apiKey)
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: UpdateSettingsInput = await req.json()

    // Build update data
    const updateData: Record<string, unknown> = {}
    
    if (input.llm_provider !== undefined) {
      updateData.llm_provider = input.llm_provider
    }
    
    // Encrypt API key before storage
    if (input.llm_api_key !== undefined) {
      updateData.llm_api_key_encrypted = encryptApiKey(input.llm_api_key)
    }

    // Update Gemini model configuration
    if (input.gemini_model_config !== undefined) {
      updateData.gemini_model_config = input.gemini_model_config
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse("No settings to update", 400)
    }

    // Check if settings exist
    const { data: existing } = await supabaseAdmin
      .from("user_settings")
      .select("id")
      .eq("user_id", user.id)
      .single()

    let settings

    if (existing) {
      // Update existing settings
      const { data, error } = await supabaseAdmin
        .from("user_settings")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single()

      if (error) {
        console.error("Failed to update user settings:", error)
        return errorResponse("Failed to update user settings", 500)
      }
      settings = data
    } else {
      // Create new settings
      const { data, error } = await supabaseAdmin
        .from("user_settings")
        .insert({
          user_id: user.id,
          llm_provider: input.llm_provider || "gemini",
          ...updateData
        })
        .select()
        .single()

      if (error) {
        console.error("Failed to create user settings:", error)
        return errorResponse("Failed to create user settings", 500)
      }
      settings = data
    }

    // Don't return the encrypted key
    const safeSettings = {
      ...settings,
      llm_api_key_encrypted: settings.llm_api_key_encrypted ? "[ENCRYPTED]" : null
    }

    return successResponse(safeSettings)
  } catch (error) {
    console.error("Edge function error:", error)
    
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
