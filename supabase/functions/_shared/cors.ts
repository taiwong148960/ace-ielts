/**
 * CORS configuration for Edge Functions
 * 
 * Allowed origins:
 * - Production: https://www.ace-ielts.net
 * - Development: http://localhost:3000, http://localhost:5173
 * - Desktop (Tauri): tauri://localhost
 */

/**
 * Allowed origins for CORS
 * In production, this is restricted to specific domains
 * In development, localhost is allowed
 */
const ALLOWED_ORIGINS = [
  "https://www.ace-ielts.net",
  "https://ace-ielts.net",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "tauri://localhost"
]

/**
 * Check if an origin is allowed
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  return ALLOWED_ORIGINS.includes(origin)
}

/**
 * Get CORS headers based on request origin
 * Returns the specific origin if allowed, otherwise returns the first allowed origin
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && isAllowedOrigin(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0]
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true"
  }
}

/**
 * Legacy corsHeaders for backwards compatibility
 * Note: Prefer using getCorsHeaders(origin) for proper origin validation
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
}

/**
 * Handle CORS preflight request
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("Origin")
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(origin)
    })
  }
  return null
}

/**
 * Create JSON response with CORS headers
 */
export function jsonResponse(
  data: unknown,
  status: number = 200,
  origin?: string | null
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(origin ?? null)
    }
  })
}

/**
 * Create error response with CORS headers
 */
export function errorResponse(
  message: string,
  status: number = 400,
  origin?: string | null
): Response {
  return jsonResponse({ message }, status, origin)
}

/**
 * Create success response with CORS headers
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
  origin?: string | null
): Response {
  return jsonResponse(data, status, origin)
}
