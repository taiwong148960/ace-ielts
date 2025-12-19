
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"
import { Router } from "../_shared/router.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { safeDecrypt } from "../_shared/crypto.ts"

const logger = createLogger("vocabulary-words")

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

// Router Setup
const router = new Router()

router.get("/", handleGetWords)
router.post("/", handleAddWords)
router.delete("/:id", handleDeleteWord)
router.post("/process", handleProcessPendingWords)

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

async function handleGetWords(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const url = new URL(req.url)
  const bookId = url.searchParams.get("bookId")

  if (!bookId) return errorResponse("Book ID is required", 400)

  // Verify access
  const { data: book } = await supabaseAdmin
    .from("vocabulary_books")
    .select("user_id, is_system_book")
    .eq("id", bookId)
    .single()

  if (!book) return errorResponse("Book not found", 404)
  if (!book.is_system_book && book.user_id !== user.id) return errorResponse("Forbidden", 403)

  const { data: words, error } = await supabaseAdmin.rpc("get_book_words", { p_book_id: bookId })

  if (error) return errorResponse("Failed to fetch words", 500)
  return successResponse(words || [])
}

async function handleAddWords(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const input = await req.json()
  const { bookId, words } = input

  if (!bookId) return errorResponse("Book ID is required", 400)
  if (!words || !Array.isArray(words) || words.length === 0) return errorResponse("Words array required", 400)

  // Verify access
  const { data: book } = await supabaseAdmin
    .from("vocabulary_books")
    .select("user_id")
    .eq("id", bookId)
    .single()

  if (!book) return errorResponse("Book not found", 404)
  if (book.user_id !== user.id) return errorResponse("Forbidden", 403)

  const cleanedWords = words
    .map((w: unknown) => typeof w === "string" ? w.trim() : "")
    .filter((w: string) => w.length > 0)

  if (cleanedWords.length === 0) return errorResponse("No valid words", 400)

  const { error } = await supabaseAdmin.rpc("add_words_to_book", {
    p_book_id: bookId,
    p_words: cleanedWords
  })

  if (error) return errorResponse("Failed to add words", 500)

  const { data: updatedBook } = await supabaseAdmin
    .from("vocabulary_books")
    .select("word_count")
    .eq("id", bookId)
    .single()

  return successResponse({ words: [], wordCount: updatedBook?.word_count || 0 })
}

async function handleDeleteWord(req: Request, params: Record<string, string>) {
  const { user, supabaseAdmin } = await initSupabase(req.headers.get("Authorization"))
  const wordId = params.id
  const url = new URL(req.url)
  const bookId = url.searchParams.get("bookId")

  if (!bookId) return errorResponse("Book ID is required (query param)", 400)

  // Verify access
  const { data: book } = await supabaseAdmin
    .from("vocabulary_books")
    .select("user_id")
    .eq("id", bookId)
    .single()

  if (!book) return errorResponse("Book not found", 404)
  if (book.user_id !== user.id) return errorResponse("Forbidden", 403)

  const { error } = await supabaseAdmin
    .from("vocabulary_book_words")
    .delete()
    .eq("word_id", wordId)
    .eq("book_id", bookId)

  if (error) return errorResponse("Failed to delete word", 500)

  const { data: updatedBook } = await supabaseAdmin
    .from("vocabulary_books")
    .select("word_count")
    .eq("id", bookId)
    .single()

  return successResponse({ deleted: true, wordId, wordCount: updatedBook?.word_count || 0 })
}

// ============================================================================
// Process Pending Words Logic
// ============================================================================

const DEFAULT_MODEL = "gemini-1.5-pro"
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
const TTS_BASE_URL = "https://texttospeech.googleapis.com/v1"
const DEFAULT_VOICE = "en-US-Neural2-F"
const BATCH_SIZE = 5

async function handleProcessPendingWords(req: Request) {
  // Service Role Auth (Cron)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseServiceKey) return errorResponse("Server config error", 500)

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  const { data: words, error: wordsError } = await supabaseAdmin
    .from("vocabulary_words")
    .select("id, word, import_status")
    .in("import_status", ["pending", "importing"])
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE)

  if (wordsError) return errorResponse(wordsError.message, 500)
  if (!words || words.length === 0) return successResponse({ processed: 0, message: "No pending words" })

  let processedCount = 0

  for (const wordRecord of words) {
    try {
      const { data: bookWord } = await supabaseAdmin
        .from("vocabulary_book_words")
        .select("book_id, vocabulary_books!inner(id, user_id)")
        .eq("word_id", wordRecord.id)
        .limit(1)
        .single()

      if (!bookWord || !bookWord.vocabulary_books) {
        logger.warn("No book/user found for word - skipping", { wordId: wordRecord.id })
        continue
      }

      const userId = (bookWord.vocabulary_books as any).user_id
      
      const { wordData, wordAudioUrl, exampleAudioUrls } = await enrichWord(
        wordRecord.word,
        userId,
        supabaseAdmin
      )

      await supabaseAdmin
        .from("vocabulary_words")
        .update({
          import_status: "done",
          word_details: wordData,
          word_audio_url: wordAudioUrl,
          example_audio_urls: exampleAudioUrls
        })
        .eq("id", wordRecord.id)

      // Update book status if needed
      const { data: importingBooks } = await supabaseAdmin
          .from("vocabulary_book_words")
          .select("book_id, vocabulary_books!inner(id, import_status)")
          .eq("word_id", wordRecord.id)
          .eq("vocabulary_books.import_status", "importing")
      
      if (importingBooks) {
          for (const b of importingBooks) {
              const book = b.vocabulary_books as any
              const { count } = await supabaseAdmin
                  .from("vocabulary_book_words")
                  .select("word_id, vocabulary_words!inner(import_status)", { count: "exact", head: true })
                  .eq("book_id", book.id)
                  .neq("vocabulary_words.import_status", "done")
              
              if (count === 0) {
                  await supabaseAdmin.from("vocabulary_books").update({ import_status: "done" }).eq("id", book.id)
              }
          }
      }

      processedCount++
    } catch (error) {
      logger.error("Failed to process word", { wordId: wordRecord.id }, error as Error)
    }
  }

  return successResponse({ processed: processedCount, total: words.length })
}

// Helper functions for Process
async function generateAudio(text: string, apiKey: string, voice: string = DEFAULT_VOICE): Promise<string> {
  const url = `${TTS_BASE_URL}/text:synthesize?key=${apiKey}`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: "en-US",
        name: voice,
        ssmlGender: voice.includes("Neural2-F") ? "FEMALE" : "MALE"
      },
      audioConfig: { audioEncoding: "MP3" }
    })
  })

  if (!response.ok) throw new Error(`TTS API error: ${response.status}`)
  const data = await response.json()
  return `data:audio/mp3;base64,${data.audioContent}`
}

async function enrichWord(word: string, userId: string, supabaseAdmin: any): Promise<any> {
  const { data: userSettings } = await supabaseAdmin
    .from("user_settings")
    .select("gemini_model_config, llm_api_key_encrypted, llm_provider")
    .eq("user_id", userId)
    .single()

  if (!userSettings) throw new Error("User settings not found")

  let geminiApiKey = Deno.env.get("GEMINI_API_KEY")
  if (!geminiApiKey) {
    if (!userSettings.llm_api_key_encrypted) throw new Error("LLM API key not configured")
    geminiApiKey = await safeDecrypt(userSettings.llm_api_key_encrypted)
  }
  if (!geminiApiKey) throw new Error("Gemini API key not available")

  const textModelConfig = userSettings.gemini_model_config?.textModel || {}
  const model = textModelConfig.model || DEFAULT_MODEL
  
  const prompt = `Analyze "${word}" for IELTS. Return valid JSON: {
    "definitions": [{"partOfSpeech": "...", "meaning": "..."}],
    "exampleSentences": [{"sentence": "...", "source": "ielts|daily|movie", "translation": "..."}],
    "synonyms": [], "antonyms": [], "relatedWords": {}, "easilyConfused": [], "usageFrequency": "...", "tenses": []
  }. No markdown.`

  const url = `${DEFAULT_BASE_URL}/models/${model}:generateContent?key=${geminiApiKey}`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
  })

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)
  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) throw new Error("No content from Gemini")
  
  const wordData = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim())

  // Audio
  let wordAudioUrl = null
  let exampleAudioUrls = null
  try {
    wordAudioUrl = await generateAudio(word, geminiApiKey)
    if (wordData.exampleSentences) {
      exampleAudioUrls = await Promise.all(wordData.exampleSentences.map(async (ex: any) => {
        try {
          return { sentence: ex.sentence, audio_url: await generateAudio(ex.sentence, geminiApiKey) }
        } catch {
          return { sentence: ex.sentence, audio_url: "" }
        }
      }))
    }
  } catch (e) {
    logger.warn("Audio failed", {}, e as Error)
  }

  return { wordData, wordAudioUrl, exampleAudioUrls }
}
