
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"
import { Router } from "../_shared/router.ts"
import { BOOK_COVER_COLORS, DEFAULT_BOOK_SETTINGS, type CreateBookInput } from "../_shared/types.ts"

interface VocabularyBook {
  id: string
  name: string
  description: string | null
  cover_color: string
  cover_text: string | null
  book_type: string
  is_system_book: boolean
  user_id: string
  word_count: number
  import_status: string
  created_at?: string
  updated_at?: string
  progress?: UserBookProgress
}

interface UserBookProgress {
  user_id: string
  book_id: string
  mastered_count: number
  learning_count: number
  new_count: number
  streak_days: number
  accuracy_percent: number
  last_studied_at?: string
}

const logger = createLogger("vocabulary-books")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

// Router Setup
const router = new Router()

router.get("/", handleListBooks)
router.post("/", handleCreateBook)
router.get("/:id", handleGetBook)
router.patch("/:id", handleUpdateBook)
router.delete("/:id", handleDeleteBook)
router.get("/:id/settings", handleGetSettings)
router.patch("/:id/settings", handleUpdateSettings)
router.get("/:id/import-progress", handleGetImportProgress)

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  
  try {
    return await router.handle(req)
  } catch (error) {
    logger.error("Router error", {}, error as Error)
    return errorResponse(error instanceof Error ? error.message : "Internal server error", 500)
  }
})

// ============================================================================
// Handlers
// ============================================================================

async function handleListBooks(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const url = new URL(req.url)
  const type = url.searchParams.get("type") || "user"

  logger.info("Fetching books", { userId: user.id, type })

  if (!["user", "system"].includes(type)) {
    return errorResponse("Type must be 'user' or 'system'", 400)
  }

  const isSystemBook = type === "system"

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

  const { data: books, error: booksError } = await booksQuery.returns<VocabularyBook[]>()

  if (booksError) {
    logger.error("Failed to fetch books", { userId: user.id, type }, new Error(booksError.message))
    return errorResponse("Failed to fetch books", 500)
  }

  if (!books || books.length === 0) {
    return successResponse([])
  }

  // Get progress for all books
  const bookIds = books.map((b: VocabularyBook) => b.id)
  const { data: progressData, error: progressError } = await supabaseAdmin
    .from("vocabulary_user_book_progress")
    .select("*")
    .eq("user_id", user.id)
    .in("book_id", bookIds)
    .returns<UserBookProgress[]>()

  if (progressError) {
    logger.warn("Failed to fetch book progress", { userId: user.id }, new Error(progressError.message))
    return successResponse(books.map((book: VocabularyBook) => ({ ...book, progress: undefined })))
  }

  const progressMap = new Map(progressData?.map((p: UserBookProgress) => [p.book_id, p]) || [])
  const booksWithProgress = books.map((book: VocabularyBook) => ({
    ...book,
    progress: progressMap.get(book.id) || undefined
  }))

  return successResponse(booksWithProgress)
}

async function handleCreateBook(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const input: CreateBookInput = await req.json()

  logger.info("Creating book", { userId: user.id, name: input.name })

  if (!input.name || typeof input.name !== "string" || input.name.trim().length === 0) {
    return errorResponse("Book name is required", 400)
  }

  if (!input.words || !Array.isArray(input.words)) {
    return errorResponse("Words array is required", 400)
  }

  const cleanedWords = input.words
    .map(word => typeof word === "string" ? word.trim() : "")
    .filter(word => word.length > 0)

  const bookData = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    cover_color: input.cover_color || BOOK_COVER_COLORS[Math.floor(Math.random() * BOOK_COVER_COLORS.length)],
    cover_text: input.cover_text?.trim() || null,
    book_type: input.book_type || "custom",
    is_system_book: false,
    user_id: user.id,
    word_count: cleanedWords.length,
    import_status: cleanedWords.length > 0 ? "importing" : "done"
  }

  const { data: book, error: bookError } = await supabaseAdmin
    .from("vocabulary_books")
    .insert(bookData)
    .select()
    .single()

  if (bookError) {
    logger.error("Failed to create book", { userId: user.id, bookName: input.name }, new Error(bookError.message))
    return errorResponse("Failed to create vocabulary book", 500)
  }

  if (cleanedWords.length > 0) {
    const { error: wordsError } = await supabaseAdmin.rpc("add_words_to_book", {
      p_book_id: book.id,
      p_words: cleanedWords
    })
    if (wordsError) {
      logger.warn("Failed to add words to book", { bookId: book.id }, new Error(wordsError.message))
    }
  }

  await supabaseAdmin.from("vocabulary_user_book_progress").insert({
    user_id: user.id,
    book_id: book.id,
    mastered_count: 0,
    learning_count: 0,
    new_count: cleanedWords.length,
    streak_days: 0,
    accuracy_percent: 0
  })

  logger.info("Book created successfully", { bookId: book.id, wordCount: cleanedWords.length })

  return successResponse(book)
}

async function handleGetBook(req: Request, params: Record<string, string>) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const bookId = params.id

  logger.info("Fetching book details", { userId: user.id, bookId })

  const { data: book, error } = await supabaseAdmin
    .from("vocabulary_books")
    .select("*")
    .eq("id", bookId)
    .single()

  if (error || !book) {
    return errorResponse("Book not found", 404)
  }

  // Get progress
  const { data: progress } = await supabaseAdmin
    .from("vocabulary_user_book_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .single()

  return successResponse({ ...book, progress })
}

async function handleUpdateBook(req: Request, params: Record<string, string>) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const bookId = params.id
  const input = await req.json()

  logger.info("Updating book", { userId: user.id, bookId })

  // Check ownership
  const { data: existingBook } = await supabaseAdmin
    .from("vocabulary_books")
    .select("user_id")
    .eq("id", bookId)
    .single()

  if (!existingBook) return errorResponse("Book not found", 404)
  if (existingBook.user_id !== user.id) return errorResponse("Forbidden", 403)

  const updateData: Record<string, unknown> = {}
  if (input.name !== undefined) updateData.name = input.name.trim()
  if (input.description !== undefined) updateData.description = input.description?.trim() || null
  if (input.cover_color !== undefined) updateData.cover_color = input.cover_color
  if (input.cover_text !== undefined) updateData.cover_text = input.cover_text?.trim() || null

  const { data: book, error } = await supabaseAdmin
    .from("vocabulary_books")
    .update(updateData)
    .eq("id", bookId)
    .select()
    .single()

  if (error) {
    logger.error("Failed to update book", { userId: user.id, bookId }, new Error(error.message))
    return errorResponse("Failed to update book", 500)
  }
  
  logger.info("Book updated successfully", { bookId })
  return successResponse(book)
}

async function handleDeleteBook(req: Request, params: Record<string, string>) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const bookId = params.id

  logger.info("Deleting book", { userId: user.id, bookId })

  const { data: existingBook } = await supabaseAdmin
    .from("vocabulary_books")
    .select("user_id, is_system_book")
    .eq("id", bookId)
    .single()

  if (!existingBook) return errorResponse("Book not found", 404)
  if (existingBook.is_system_book) return errorResponse("Cannot delete system books", 403)
  if (existingBook.user_id !== user.id) return errorResponse("Forbidden", 403)

  const { error } = await supabaseAdmin
    .from("vocabulary_books")
    .delete()
    .eq("id", bookId)

  if (error) return errorResponse("Failed to delete book", 500)
  
  logger.info("Book deleted successfully", { bookId })
  return successResponse({ deleted: true, bookId })
}

async function handleGetSettings(req: Request, params: Record<string, string>) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const bookId = params.id

  logger.info("Fetching book settings", { userId: user.id, bookId })

  const { data: settings, error } = await supabaseAdmin
    .from("vocabulary_book_settings")
    .select("*")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return successResponse({
        user_id: user.id,
        book_id: bookId,
        ...DEFAULT_BOOK_SETTINGS
      })
    }
    return errorResponse("Failed to fetch settings", 500)
  }

  return successResponse(settings)
}

async function handleUpdateSettings(req: Request, params: Record<string, string>) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const bookId = params.id
  const input = await req.json()

  // Validate that all required fields are provided (full configuration required)
  if (
    input.daily_new_limit === undefined ||
    input.daily_review_limit === undefined ||
    input.learning_mode === undefined ||
    input.study_order === undefined
  ) {
    return errorResponse("daily_new_limit, daily_review_limit, learning_mode, and study_order are required", 400)
  }

  logger.info("Updating book settings with full configuration", { userId: user.id, bookId })

  // Upsert logic
  const { data: existing } = await supabaseAdmin
    .from("vocabulary_book_settings")
    .select("id")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .single()

  let result
  if (existing) {
    // User has settings - replace with full configuration
    const { data, error } = await supabaseAdmin
      .from("vocabulary_book_settings")
      .update({
        daily_new_limit: input.daily_new_limit,
        daily_review_limit: input.daily_review_limit,
        learning_mode: input.learning_mode,
        study_order: input.study_order
      })
      .eq("id", existing.id)
      .select().single()
    if (error) {
      logger.error("Failed to update book settings", { userId: user.id, bookId }, new Error(error.message))
      return errorResponse("Failed to update settings", 500)
    }
    result = data
  } else {
    // User has never set settings - create with full configuration
    const { data, error } = await supabaseAdmin
      .from("vocabulary_book_settings")
      .insert({
        user_id: user.id,
        book_id: bookId,
        daily_new_limit: input.daily_new_limit,
        daily_review_limit: input.daily_review_limit,
        learning_mode: input.learning_mode,
        study_order: input.study_order
      })
      .select().single()
    if (error) {
      logger.error("Failed to create book settings", { userId: user.id, bookId }, new Error(error.message))
      return errorResponse("Failed to create settings", 500)
    }
    result = data
  }

  return successResponse(result)
}

  async function handleGetImportProgress(req: Request, params: Record<string, string>) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const bookId = params.id

  logger.info("Checking import progress", { userId: user.id, bookId })

  const { data: book } = await supabaseAdmin
    .from("vocabulary_books")
    .select("import_status, import_progress, import_total, import_started_at, import_completed_at, user_id, is_system_book")
    .eq("id", bookId)
    .single()

  if (!book) return errorResponse("Book not found", 404)
  if (!book.is_system_book && book.user_id !== user.id) return errorResponse("Forbidden", 403)

  return successResponse({
    status: book.import_status,
    current: book.import_progress || 0,
    total: book.import_total || 0,
    startedAt: book.import_started_at,
    completedAt: book.import_completed_at
  })
}
