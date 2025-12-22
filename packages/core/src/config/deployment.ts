/**
 * Environment Configuration
 * Handles environment variables and URLs
 */

/// <reference types="vite/client" />

import type { LLMProvider } from "../types/user-settings"

// Re-export LLMProvider for convenience
export type { LLMProvider }

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

