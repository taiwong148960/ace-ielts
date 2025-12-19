
import { getSupabase } from "../services/supabase"
import { createLogger } from "./logger"

const logger = createLogger("EdgeClient")

interface FetchEdgeOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
}

/**
 * Helper to call Supabase Edge Functions with RESTful routing
 * Uses _path query parameter to support sub-paths reliably
 */
export async function fetchEdge<T>(
  resource: string,
  path: string = "/",
  options: FetchEdgeOptions = {}
): Promise<T> {
  const supabase = getSupabase()
  
  const queryParams = new URLSearchParams()
  
  // Use _path to simulate path routing
  if (path !== "/") {
    queryParams.set("_path", path)
  }
  
  // Add other query params
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.set(key, String(value))
      }
    })
  }
  
  const queryString = queryParams.toString()
  const functionName = queryString ? `${resource}?${queryString}` : resource
  const method = options.method || "GET"
  
  logger.debug(`Invoking Edge Function: ${resource}`, { path, method, query: options.query })

  const invokeOptions: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any
  } = {
    method,
  }

  if (options.body && method !== "GET") {
    invokeOptions.body = options.body
  }

  const { data, error } = await supabase.functions.invoke(functionName, invokeOptions)

  if (error) {
    logger.error(`Edge Function ${resource} failed`, { path, method }, error)
    throw new Error(error.message || "Edge Function call failed")
  }

  return data as T
}
