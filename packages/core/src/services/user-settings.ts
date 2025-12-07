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
 * Note: API keys should be encrypted before storage
 * For now, we'll store them encrypted using Supabase RPC functions
 */
export async function updateUserSettings(
  userId: string,
  input: UpdateUserSettingsInput
): Promise<UserSettings> {
  if (!isSupabaseInitialized()) {
    throw new Error("Supabase not initialized")
  }

  const supabase = getSupabase()
  
  // Get encryption key from environment (should be set in Supabase)
  // For self-hosted, users manage their own encryption
  // In production, use Supabase Vault for better security
  
  const updateData: Record<string, unknown> = {}
  
  if (input.llm_provider !== undefined) {
    updateData.llm_provider = input.llm_provider
  }
  
  // If API key is provided, encrypt it
  // Note: In production, use Supabase Vault or a secure encryption method
  // For now, we'll store it encrypted using a simple approach
  // TODO: Implement proper encryption using Supabase Vault
  if (input.llm_api_key !== undefined) {
    // For now, we'll use a simple base64 encoding
    // In production, use proper encryption (Supabase Vault recommended)
    updateData.llm_api_key_encrypted = btoa(input.llm_api_key) // Temporary: use proper encryption
  }

  // Update Gemini model configuration if provided
  if (input.gemini_model_config !== undefined) {
    updateData.gemini_model_config = input.gemini_model_config
  }

  // Check if settings exist
  const existing = await getUserSettings(userId)
  
  if (existing) {
    // Update existing settings
    const { data, error } = await supabase
      .from("user_settings")
      .update(updateData)
      .eq("id", existing.id)
      .select()
      .single()

    if (error) {
      logger.error("Failed to update user settings", { userId }, error)
      throw new Error("Failed to update user settings")
    }
    
    logger.info("User settings updated", { userId })
    return data
  } else {
    // Create new settings
    const { data, error } = await supabase
      .from("user_settings")
      .insert({
        user_id: userId,
        llm_provider: input.llm_provider || "gemini",
        ...updateData
      })
      .select()
      .single()

    if (error) {
      logger.error("Failed to create user settings on update", { userId }, error)
      throw new Error("Failed to create user settings")
    }
    
    logger.info("User settings created", { userId })
    return data
  }
}

/**
 * Get LLM API key (decrypted)
 * Only available in self-hosted mode
 */
export async function getLLMApiKey(userId: string): Promise<string | null> {
  const settings = await getUserSettings(userId)
  if (!settings || !settings.llm_api_key_encrypted) {
    return null
  }

  // Decrypt the API key
  // TODO: Use proper decryption (currently using base64)
  try {
    return atob(settings.llm_api_key_encrypted) // Temporary: use proper decryption
  } catch (error) {
    logger.error("Failed to decrypt API key", { userId }, error instanceof Error ? error : new Error("Decryption failed"))
    return null
  }
}

/**
 * Check if user has API key configured
 */
export async function hasLLMApiKey(userId: string): Promise<boolean> {
  const apiKey = await getLLMApiKey(userId)
  return apiKey !== null && apiKey.length > 0
}

