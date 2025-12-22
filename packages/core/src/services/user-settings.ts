/**
 * User Settings Service
 * Handles user-specific settings
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

  // Import default configs
  const { DEFAULT_GEMINI_TEXT_MODEL_CONFIG, DEFAULT_GEMINI_TTS_MODEL_CONFIG } = await import("../types/vocabulary")
  
  // Create default settings using updateUserSettings (which supports create)
  return await updateUserSettings(userId, {
    llm_provider: "gemini",
    gemini_model_config: {
      textModel: DEFAULT_GEMINI_TEXT_MODEL_CONFIG,
      ttsModel: DEFAULT_GEMINI_TTS_MODEL_CONFIG
    }
  })
}

/**
 * Update user settings
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
      body: input
    })
    logger.info("User settings updated", { userId })
    return data
  } catch (error) {
    logger.error("Failed to update user settings", { userId }, error as Error)
    throw new Error((error as Error).message || "Failed to update user settings")
  }
}

