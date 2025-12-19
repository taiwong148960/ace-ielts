/**
 * User Settings Service
 * Handles user-specific settings including encrypted LLM API keys
 */

import { isSupabaseInitialized } from "./supabase"
import type { UserSettings, UpdateUserSettingsInput } from "../types/user-settings"
import { createLogger } from "../utils/logger"
import { fetchEdge } from "../utils/edge-client"

// Create logger for this service
const logger = createLogger("UserSettingsService")

/**
 * Get user settings
 * Calls Edge Function: user-settings
 */
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  logger.debug("Fetching user settings via Edge Function", { userId })

  try {
    return await fetchEdge<UserSettings | null>("user-settings", "/")
  } catch (error) {
    logger.error("Failed to fetch user settings", { userId }, error as Error)
    throw new Error("Failed to fetch user settings")
  }
}

/**
 * Get or create user settings
 * Uses updateUserSettings which automatically creates if not exists
 */
export async function getOrCreateUserSettings(userId: string): Promise<UserSettings> {
  const existing = await getUserSettings(userId)
  if (existing) {
    return existing
  }

  // Create default settings using updateUserSettings (which supports create)
  return await updateUserSettings(userId, {
    llm_provider: "gemini"
  })
}

/**
 * Update user settings
 * Note: API keys are encrypted server-side in Edge Function
 * Calls Edge Function: user-settings
 */
export async function updateUserSettings(
  userId: string,
  input: UpdateUserSettingsInput
): Promise<UserSettings> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  logger.info("Updating user settings via Edge Function", { userId })

  try {
    const data = await fetchEdge<UserSettings>("user-settings", "/", {
      method: "PATCH",
      body: {
        llm_provider: input.llm_provider,
        llm_api_key: input.llm_api_key,
        gemini_model_config: input.gemini_model_config
      }
    })
    logger.info("User settings updated", { userId })
    return data
  } catch (error) {
    logger.error("Failed to update user settings", { userId }, error as Error)
    throw new Error((error as Error).message || "Failed to update user settings")
  }
}

/**
 * Get LLM API key (decrypted)
 * Only available in self-hosted mode
 * Calls Edge Function for secure server-side decryption
 */
export async function getLLMApiKey(userId: string): Promise<string | null> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  logger.debug("Fetching decrypted API key via Edge Function", { userId })

  try {
    const data = await fetchEdge<{ hasApiKey: boolean, apiKey: string | null }>("user-settings", "/api-key")
    
    if (!data?.hasApiKey) {
      return null
    }

    return data.apiKey
  } catch (error) {
    logger.error("Failed to get API key", { userId }, error as Error)
    return null
  }
}

/**
 * Check if user has API key configured
 * This checks the settings without decrypting the key
 */
export async function hasLLMApiKey(userId: string): Promise<boolean> {
  const settings = await getUserSettings(userId)
  return settings !== null && 
         settings.llm_api_key_encrypted !== null && 
         settings.llm_api_key_encrypted.length > 0
}
