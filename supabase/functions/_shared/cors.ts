/**
 * CORS headers for Edge Functions
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
}

/**
 * Handle CORS preflight request
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    })
  }
  return null
}

/**
 * Create JSON response with CORS headers
 */
export function jsonResponse(
  data: unknown,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  })
}

/**
 * Create error response with CORS headers
 */
export function errorResponse(
  message: string,
  status: number = 400
): Response {
  return jsonResponse({ error: message, success: false }, status)
}

/**
 * Create success response with CORS headers
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): Response {
  return jsonResponse({ success: true, data }, status)
}
