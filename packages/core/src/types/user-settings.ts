/**
 * User Settings Types
 * Type definitions for user-specific settings
 */

import type { GeminiTextModelConfig, GeminiTTSModelConfig } from "./vocabulary"

/**
 * LLM Provider types
 * Supports all major LLM providers including Gemini, OpenAI, Anthropic, and Azure OpenAI
 */
export type LLMProvider = "gemini" | "openai" | "anthropic" | "azure-openai" | "custom"

/**
 * Gemini model configuration stored in user settings
 */
export interface GeminiModelConfig {
  textModel: GeminiTextModelConfig
  ttsModel: GeminiTTSModelConfig
}

/**
 * User settings interface
 */
export interface UserSettings {
  id: string
  user_id: string
  llm_api_key_encrypted: string | null // Deprecated: kept for backward compatibility, not used
  llm_provider: LLMProvider
  gemini_model_config: GeminiModelConfig | null
  created_at: string
  updated_at: string
}

/**
 * Update user settings input
 */
export interface UpdateUserSettingsInput {
  llm_provider: LLMProvider
  gemini_model_config: GeminiModelConfig
}

