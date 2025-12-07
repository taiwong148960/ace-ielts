/**
 * Supabase Edge Function: Get Vocabulary Books
 * Returns vocabulary books list (system or user books, without progress)
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("vocabulary-get-books")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetBooksRequest {
  type: "system" | "user"
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetBooksRequest = await req.json()

    if (!input.type || (input.type !== "system" && input.type !== "user")) {
      return errorResponse("Type must be 'system' or 'user'", 400)
    }

    let query = supabaseAdmin
      .from("vocabulary_books")
      .select("*")

    if (input.type === "system") {
      query = query.eq("is_system_book", true).order("name")
    } else {
      query = query
        .eq("user_id", user.id)
        .eq("is_system_book", false)
        .order("updated_at", { ascending: false })
    }

    const { data: books, error: booksError } = await query

    if (booksError) {
      logger.error("Failed to fetch books", { type: input.type, userId: user.id }, new Error(booksError.message))
      return errorResponse("Failed to fetch vocabulary books", 500)
    }

    logger.debug("Books fetched", { type: input.type, userId: user.id, count: books?.length || 0 })
    return successResponse(books || [], 200)
  } catch (error) {
    logger.error("Unexpected error", {}, error as Error)
    return errorResponse("Internal server error", 500)
  }
})
