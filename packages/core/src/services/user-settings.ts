/**
 * User Settings Service
 * Handles user-specific settings including encrypted LLM API keys
 */

import { getSupabase, isSupabaseInitialized } from "./supabase"
import type { UserSettings, UpdateUserSettingsInput } from "../types/user-settings"
import { createLogger } from "../utils/logger"

// Create logger for this service
const logger = createLogger("UserSettingsService")

/**
 * Get user settings
 */
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return null // Not found
    }
    logger.error("Failed to fetch user settings", { userId }, error)
    throw new Error("Failed to fetch user settings")
  }

  return data
}

/**
 * Get or create user settings
 */
export async function getOrCreateUserSettings(userId: string): Promise<UserSettings> {
  const existing = await getUserSettings(userId)
  if (existing) {
    return existing
  }

  // Create default settings
  return await createUserSettings(userId)
}

/**
 * Create default user settings
 */
async function createUserSettings(userId: string): Promise<UserSettings> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from("user_settings")
    .insert({
      user_id: userId,
      llm_provider: "gemini"
    })
    .select()
    .single()

  if (error) {
    logger.error("Failed to create user settings", { userId }, error)
    throw new Error("Failed to create user settings")
  }
  
  logger.info("User settings created", { userId })
  return data
}

/**
 * Update user settings
 * Note: API keys are encrypted server-side in Edge Function
 * Calls Edge Function: user-settings-update
 */
export async function updateUserSettings(
  userId: string,
  input: UpdateUserSettingsInput
): Promise<UserSettings> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  logger.info("Updating user settings via Edge Function", { userId })

  const { data, error } = await supabase.functions.invoke('user-settings-update', {
    body: {
      llm_provider: input.llm_provider,
      llm_api_key: input.llm_api_key,
      gemini_model_config: input.gemini_model_config
    }
  })

  if (error) {
    logger.error("Failed to update user settings via Edge Function", { userId }, error)
    throw new Error(error.message || "Failed to update user settings")
  }

  if (!data?.success) {
    throw new Error(data?.error || "Failed to update user settings")
  }
    
  logger.info("User settings updated", { userId })
  return data.data
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

  const supabase = getSupabase()
  
  logger.debug("Fetching decrypted API key via Edge Function", { userId })

  const { data, error } = await supabase.functions.invoke('user-settings-get-api-key', {})

  if (error) {
    logger.error("Failed to get API key via Edge Function", { userId }, error)
    return null
  }

  if (!data?.success || !data?.data?.hasApiKey) {
    return null
  }

  return data.data.apiKey
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

