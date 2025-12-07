/**
 * Supabase Edge Function: Update Import Status
 * Updates the import status for a book after processing words
 * Called by client after each word is enriched
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"

// Create logger for this function
const logger = createLogger("vocabulary-update-import-status")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface UpdateStatusRequest {
  bookId: string
  wordId: string
  success: boolean
  wordDetails?: Record<string, unknown>
  wordAudioUrl?: string
  exampleAudioUrls?: Array<{ sentence: string; audio_url: string }>
  error?: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: UpdateStatusRequest = await req.json()

    if (!input.bookId || !input.wordId) {
      return errorResponse("Book ID and Word ID are required", 400)
    }

    // Verify user owns this book
    const { data: book } = await supabaseAdmin
      .from("vocabulary_books")
      .select("id, user_id, import_progress, import_total")
      .eq("id", input.bookId)
      .single()

    if (!book) {
      return errorResponse("Book not found", 404)
    }

    if (book.user_id !== user.id) {
      return errorResponse("Unauthorized", 403)
    }

    if (input.success) {
      // Update word with enriched data
      const updateData: Record<string, unknown> = {
        import_status: "completed",
        import_error: null
      }

      if (input.wordDetails) {
        updateData.word_details = input.wordDetails
      }

      if (input.wordAudioUrl) {
        updateData.word_audio_url = input.wordAudioUrl
      }

      if (input.exampleAudioUrls) {
        updateData.example_audio_urls = input.exampleAudioUrls
      }

      await supabaseAdmin
        .from("vocabulary_words")
        .update(updateData)
        .eq("id", input.wordId)

      // Update book progress
      const newProgress = (book.import_progress || 0) + 1
      const isComplete = newProgress >= book.import_total

      await supabaseAdmin
        .from("vocabulary_books")
        .update({
          import_progress: newProgress,
          import_status: isComplete ? "completed" : "importing",
          import_completed_at: isComplete ? new Date().toISOString() : null,
          import_error: null
        })
        .eq("id", input.bookId)

      logger.info("Word import completed", { 
        bookId: input.bookId, 
        wordId: input.wordId, 
        progress: newProgress, 
        total: book.import_total,
        isComplete 
      })

      return successResponse({
        progress: newProgress,
        total: book.import_total,
        isComplete
      })
    } else {
      // Word failed
      await supabaseAdmin
        .from("vocabulary_words")
        .update({
          import_status: "failed",
          import_error: input.error || "Unknown error"
        })
        .eq("id", input.wordId)

      // Mark book as failed
      await supabaseAdmin
        .from("vocabulary_books")
        .update({
          import_status: "failed",
          import_completed_at: new Date().toISOString(),
          import_error: `Word import failed: ${input.error || "Unknown error"}`
        })
        .eq("id", input.bookId)

      logger.warn("Word import failed", { 
        bookId: input.bookId, 
        wordId: input.wordId, 
        error: input.error 
      })

      return successResponse({
        failed: true,
        error: input.error
      })
    }
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
