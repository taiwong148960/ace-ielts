/**
 * Supabase Edge Function: Get Import Progress
 * Returns import progress and status for a vocabulary book
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("vocabulary-get-import-progress")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetImportProgressRequest {
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetImportProgressRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // Get book with import status
    const { data: book, error: bookError } = await supabaseAdmin
      .from("vocabulary_books")
      .select("import_status, import_progress, import_total, import_started_at, import_completed_at, word_count, is_system_book, user_id")
      .eq("id", input.bookId)
      .single()

    if (bookError || !book) {
      return errorResponse("Book not found", 404)
    }

    // Verify user owns this book (unless it's a system book)
    if (!book.is_system_book && book.user_id !== user.id) {
      return errorResponse("You don't have permission to view this book", 403)
    }

    const status = book.import_status || null
    const progress = book.import_progress || 0
    const total = book.import_total || 0

    return successResponse({
      status,
      current: progress,
      total,
      startedAt: book.import_started_at || undefined,
      completedAt: book.import_completed_at || undefined
    })
  } catch (error) {
    logger.error("Edge function error", {}, error as Error)
    
    if (error instanceof Error) {
      if (error.message === "Unauthorized" || error.message === "Missing authorization header") {
        return errorResponse(error.message, 401)
      }
    }
    
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500
    )
  }
})
