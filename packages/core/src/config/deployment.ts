/**
 * Deployment Configuration
 * Handles differences between SaaS and Self-Hosted deployment modes
 */

/// <reference types="vite/client" />

import type { LLMProvider } from "../types/user-settings"

/**
 * Deployment mode types
 * - saas: Cloud-hosted service with managed LLM API and subscription billing
 * - self-hosted: User deploys on their own infrastructure with their own LLM API key
 */
export type DeploymentMode = "saas" | "self-hosted"

// Re-export LLMProvider for convenience
export type { LLMProvider }

/**
 * LLM Configuration interface
 */
export interface LLMConfig {
  provider: LLMProvider
  apiKey?: string
  baseUrl?: string
  model?: string
}

/**
 * App configuration interface
 */
export interface AppConfig {
  deploymentMode: DeploymentMode
  llm: LLMConfig
  features: {
    billing: boolean
    analytics: boolean
    selfHostedApiKeyConfig: boolean
  }
}

/**
 * Get the current deployment mode from environment variables
 * Defaults to "self-hosted" if not specified
 */
export function getDeploymentMode(): DeploymentMode {
  const mode = import.meta.env.VITE_DEPLOYMENT_MODE as string | undefined
  if (mode === "saas" || mode === "self-hosted") {
    return mode
  }
  return "self-hosted"
}

/**
 * Check if the application is running in SaaS mode
 */
export function isSaaSMode(): boolean {
  return getDeploymentMode() === "saas"
}

/**
 * Check if the application is running in self-hosted mode
 */
export function isSelfHostedMode(): boolean {
  return getDeploymentMode() === "self-hosted"
}

/**
 * Get feature flags based on deployment mode
 */
export function getFeatureFlags() {
  const mode = getDeploymentMode()
  
  return {
    // Billing/subscription features only available in SaaS mode
    billing: mode === "saas",
    // Analytics enabled in SaaS mode by default
    analytics: mode === "saas",
    // API key configuration UI only in self-hosted mode
    selfHostedApiKeyConfig: mode === "self-hosted",
    // All core IELTS features available in both modes
    ieltsListening: true,
    ieltsReading: true,
    ieltsWriting: true,
    ieltsSpeaking: true,
    vocabulary: true,
  }
}

/**
 * Get the default LLM configuration based on deployment mode
 */
export function getDefaultLLMConfig(): LLMConfig {
  const mode = getDeploymentMode()
  
  if (mode === "saas") {
    // In SaaS mode, LLM config is managed server-side
    return {
      provider: "openai",
      // API key is managed by the platform, not exposed to frontend
    }
  }
  
  // In self-hosted mode, user provides their own config
  return {
    provider: "openai",
    baseUrl: import.meta.env.VITE_LLM_BASE_URL as string | undefined,
    model: import.meta.env.VITE_LLM_MODEL as string | undefined || "gpt-4o",
  }
}

/**
 * Environment URLs configuration
 */
export function getEnvironmentUrls() {
  const isDev = import.meta.env.DEV
  
  return {
    // Supabase
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    
    // App URLs
    appUrl: isDev 
      ? "http://localhost:3000" 
      : "https://www.ace-ielts.net",
    
    // API endpoints (for future use)
    apiUrl: isDev
      ? "http://localhost:3000/api"
      : "https://www.ace-ielts.net/api",
  }
}

