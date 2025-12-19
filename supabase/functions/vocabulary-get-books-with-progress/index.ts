/**
 * Supabase Edge Function: Get Books With Progress
 * Returns user's books or system books with their progress
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("vocabulary-get-books-with-progress")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface GetBooksWithProgressRequest {
  type: "user" | "system"
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: GetBooksWithProgressRequest = await req.json()

    if (!input.type || !["user", "system"].includes(input.type)) {
      return errorResponse("Type must be 'user' or 'system'", 400)
    }

    const isSystemBook = input.type === "system"

    // Get books
    let booksQuery = supabaseAdmin
      .from("vocabulary_books")
      .select("*")

    if (isSystemBook) {
      booksQuery = booksQuery.eq("is_system_book", true).order("name")
    } else {
      booksQuery = booksQuery
        .eq("user_id", user.id)
        .eq("is_system_book", false)
        .order("updated_at", { ascending: false })
    }

    const { data: books, error: booksError } = await booksQuery

    if (booksError) {
      logger.error("Failed to fetch books", { userId: user.id, type: input.type }, new Error(booksError.message))
      return errorResponse("Failed to fetch books", 500)
    }

    if (!books || books.length === 0) {
      return successResponse([])
    }

    // Get progress for all books
    const bookIds = books.map(b => b.id)
    const { data: progressData, error: progressError } = await supabaseAdmin
      .from("vocabulary_user_book_progress")
      .select("*")
      .eq("user_id", user.id)
      .in("book_id", bookIds)

    if (progressError) {
      logger.warn("Failed to fetch book progress", { userId: user.id }, new Error(progressError.message))
      // Don't fail, just return books without progress
      return successResponse(books.map(book => ({ ...book, progress: undefined })))
    }

    // Merge books with progress
    const progressMap = new Map(progressData?.map(p => [p.book_id, p]) || [])
    
    const booksWithProgress = books.map(book => ({
      ...book,
      progress: progressMap.get(book.id) || undefined
    }))

    return successResponse(booksWithProgress)
  } catch (error) {
    logger.error("Edge function error", {}, error instanceof Error ? error : new Error(String(error)))
    
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
