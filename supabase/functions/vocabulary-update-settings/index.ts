/**
 * Supabase Edge Function: Update Book Settings
 * Updates learning settings for a vocabulary book
 */
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { DEFAULT_BOOK_SETTINGS, type UpdateBookSettingsInput } from "../_shared/types.ts"

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

interface UpdateSettingsRequest extends UpdateBookSettingsInput {
  bookId: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    const input: UpdateSettingsRequest = await req.json()

    if (!input.bookId) {
      return errorResponse("Book ID is required", 400)
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    
    if (input.daily_new_limit !== undefined) {
      updateData.daily_new_limit = input.daily_new_limit
      // Auto-update review limit if not explicitly set (3x of new limit)
      if (input.daily_review_limit === undefined) {
        updateData.daily_review_limit = input.daily_new_limit * 3
      }
    }
    
    if (input.daily_review_limit !== undefined) {
      updateData.daily_review_limit = input.daily_review_limit
    }
    
    if (input.learning_mode !== undefined) {
      updateData.learning_mode = input.learning_mode
    }
    
    if (input.study_order !== undefined) {
      updateData.study_order = input.study_order
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse("No settings to update", 400)
    }

    // Check if settings exist
    const { data: existing } = await supabaseAdmin
      .from("book_settings")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", input.bookId)
      .single()

    let settings
    
    if (existing) {
      // Update existing settings
      const { data, error } = await supabaseAdmin
        .from("book_settings")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single()

      if (error) {
        console.error("Failed to update settings:", error)
        return errorResponse("Failed to update book settings", 500)
      }
      settings = data
    } else {
      // Create new settings
      const { data, error } = await supabaseAdmin
        .from("book_settings")
        .insert({
          user_id: user.id,
          book_id: input.bookId,
          ...DEFAULT_BOOK_SETTINGS,
          ...updateData
        })
        .select()
        .single()

      if (error) {
        console.error("Failed to create settings:", error)
        return errorResponse("Failed to create book settings", 500)
      }
      settings = data
    }

    return successResponse(settings)
  } catch (error) {
    console.error("Edge function error:", error)
    
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
