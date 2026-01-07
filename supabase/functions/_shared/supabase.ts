/**
 * Supabase client utilities for Edge Functions
 */
import { createClient, SupabaseClient, User } from "supabase";

// Re-export for use in other Edge Functions
export { createClient, SupabaseClient };

// Declare Deno global for TypeScript
declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

export interface AuthResult {
  user: User;
  supabase: SupabaseClient;
  supabaseAdmin: SupabaseClient;
}

/**
 * Initialize Supabase client with user's auth token
 * Returns both user client (respects RLS) and admin client (bypasses RLS)
 */
export async function initSupabase(
  authHeader: string | null,
): Promise<AuthResult> {
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables not configured");
  }

  // User client (respects RLS)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  // Verify user session
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  // Admin client (bypasses RLS) - use service role key
  const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabase; // Fallback to user client if no service key

  return { user, supabase, supabaseAdmin };
}

/**
 * Get environment variable or throw error
 */
export function getEnvOrThrow(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Environment variable ${key} not configured`);
  }
  return value;
}
