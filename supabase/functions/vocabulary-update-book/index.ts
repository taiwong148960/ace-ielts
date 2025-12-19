/**
 * Supabase Edge Function: Update Vocabulary Book
 * Updates an existing vocabulary book
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { type UpdateBookInput } from "../_shared/types.ts"
import { createLogger } from "../_shared/logger.ts"

const logger = createLogger("vocabulary-update-book")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface UpdateBookRequest extends UpdateBookInput {
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: UpdateBookRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // Verify user owns this book
    const { data: existingBook } = await supabaseAdmin
      .from("vocabulary_books")
      .select("id, user_id")
      .eq("id", input.bookId)
      .single()

    if (!existingBook) {
      return errorResponse("Book not found", 404)
    }

    if (existingBook.user_id !== user.id) {
      return errorResponse("You don't have permission to update this book", 403)
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (input.name !== undefined) updateData.name = input.name.trim()
    if (input.description !== undefined) updateData.description = input.description?.trim() || null
    if (input.cover_color !== undefined) updateData.cover_color = input.cover_color
    if (input.cover_text !== undefined) updateData.cover_text = input.cover_text?.trim() || null

    if (Object.keys(updateData).length === 0) {
      return errorResponse("No fields to update", 400)
    }

    const { data: book, error } = await supabaseAdmin
      .from("vocabulary_books")
      .update(updateData)
      .eq("id", input.bookId)
      .select()
      .single()

    if (error) {
      logger.error("Failed to update book", { bookId: input.bookId, userId: user.id }, new Error(error.message))
      return errorResponse("Failed to update vocabulary book", 500)
    }

    return successResponse(book)
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
