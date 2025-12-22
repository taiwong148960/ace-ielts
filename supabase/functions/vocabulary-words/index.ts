
import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { createLogger } from "../_shared/logger.ts"
import { Router } from "../_shared/router.ts"
import { DEFAULT_GEMINI_TEXT_MODEL_CONFIG, DEFAULT_GEMINI_TTS_MODEL_CONFIG } from "../_shared/types.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const logger = createLogger("vocabulary-words")

interface WordDefinition {
  partOfSpeech: string;
  meaning: string;
  translation: string;
  context: string;
}

interface ExampleSentence {
  sentence: string;
  source: string;
  translation: string;
  audio_url?: string;
}

interface WordAnalysisResult {
  definitions: WordDefinition[];
  exampleSentences: ExampleSentence[];
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  relatedWords: {
    wordFamily: string[];
    topic: string;
  };
  easilyConfused: { word: string; difference: string }[];
  usageFrequency: string;
  tenses: string[];
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    definitions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          partOfSpeech: { type: "STRING" },
          meaning: { type: "STRING" },
          translation: { type: "STRING" },
          context: { type: "STRING" },
        },
        required: ["partOfSpeech", "meaning", "translation", "context"],
      },
    },
    exampleSentences: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          sentence: { type: "STRING" },
          source: { type: "STRING" },
          translation: { type: "STRING" },
        },
        required: ["sentence", "source", "translation"],
      },
    },
    synonyms: { type: "ARRAY", items: { type: "STRING" } },
    antonyms: { type: "ARRAY", items: { type: "STRING" } },
    collocations: { type: "ARRAY", items: { type: "STRING" } },
    relatedWords: {
      type: "OBJECT",
      properties: {
        wordFamily: { type: "ARRAY", items: { type: "STRING" } },
        topic: { type: "STRING" },
      },
    },
    easilyConfused: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          word: { type: "STRING" },
          difference: { type: "STRING" },
        },
      },
    },
    usageFrequency: { type: "STRING", enum: ["High", "Medium", "Low"] },
    tenses: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["definitions", "exampleSentences", "synonyms", "relatedWords"],
};

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

  logger.info("Fetching words", { userId: user.id, bookId })

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

  logger.info("Adding words", { userId: user.id, bookId, count: words?.length })

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

  logger.info("Words added successfully", { userId: user.id, bookId, count: cleanedWords.length })

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

  logger.info("Deleting word", { userId: user.id, bookId, wordId })

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

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
const DEFAULT_VOICE = "Kore" // Prebuilt voice from Gemini TTS
const BATCH_SIZE = 5

async function handleProcessPendingWords(req: Request) {
  // Service Role Auth (Cron)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !supabaseServiceKey) return errorResponse("Server config error", 500)

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  // Generate unique instance ID for this function execution
  const instanceId = `edge-function-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

  // Atomically claim pending words using database function
  // This ensures no conflicts when multiple functions run concurrently
  const { data: words, error: wordsError } = await supabaseAdmin.rpc("claim_pending_vocabulary_words", {
    batch_size: BATCH_SIZE,
    instance_id: instanceId
  })

  if (wordsError) {
    logger.error("Failed to claim pending words", {}, wordsError as Error)
    return errorResponse(wordsError.message, 500)
  }

  if (!words || words.length === 0) {
    return successResponse({ 
      processed: 0, 
      failed: 0,
      total: 0,
      instanceId 
    })
  }

  logger.info("Claimed words for processing", { instanceId, count: words.length })

  let processedCount = 0
  let failedCount = 0

  for (const wordRecord of words) {
    try {
      const { data: bookWord } = await supabaseAdmin
        .from("vocabulary_book_words")
        .select("book_id, vocabulary_books!inner(id, user_id)")
        .eq("word_id", wordRecord.id)
        .limit(1)
        .single()

      if (!bookWord || !bookWord.vocabulary_books) {
        logger.warn("No book/user found for word - marking as failed", { wordId: wordRecord.id })
        // Mark as failed if no book/user found
        await supabaseAdmin
          .from("vocabulary_words")
          .update({
            import_status: "failed",
            import_error: "No book or user found for word",
            locked_by: null
          })
          .eq("id", wordRecord.id)
        failedCount++
        continue
      }

      const userId = (bookWord.vocabulary_books as any).user_id
      
      const { wordData, wordAudioUrl, exampleAudioUrls } = await enrichWord(
        wordRecord.word,
        wordRecord.id,
        userId,
        supabaseAdmin
      )

      await supabaseAdmin
        .from("vocabulary_words")
        .update({
          import_status: "done",
          word_details: wordData,
          word_audio_url: wordAudioUrl,
          example_audio_urls: exampleAudioUrls,
          locked_by: null
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
      logger.error("Failed to process word", { wordId: wordRecord.id, instanceId }, error as Error)
      // Mark as failed on error
      try {
        await supabaseAdmin
          .from("vocabulary_words")
          .update({
            import_status: "failed",
            import_error: error instanceof Error ? error.message : "Unknown error",
            locked_by: null
          })
          .eq("id", wordRecord.id)
      } catch (updateError) {
        logger.error("Failed to mark word as failed", { wordId: wordRecord.id }, updateError as Error)
      }
      failedCount++
    }
  }

  logger.info("Batch processing completed", { 
    instanceId, 
    processed: processedCount, 
    failed: failedCount,
    total: words.length 
  })

  return successResponse({ 
    processed: processedCount, 
    failed: failedCount,
    total: words.length,
    instanceId 
  })
}

// Helper functions for Process
/**
 * Converts PCM audio data (24kHz, mono, 16-bit) to WAV format
 */
function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000, channels: number = 1, bitsPerSample: number = 16): Uint8Array {
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const dataSize = pcmData.length
  const fileSize = 36 + dataSize

  const wavHeader = new ArrayBuffer(44)
  const view = new DataView(wavHeader)

  // RIFF header
  view.setUint8(0, 0x52) // 'R'
  view.setUint8(1, 0x49) // 'I'
  view.setUint8(2, 0x46) // 'F'
  view.setUint8(3, 0x46) // 'F'
  view.setUint32(4, fileSize, true)
  view.setUint8(8, 0x57)  // 'W'
  view.setUint8(9, 0x41)  // 'A'
  view.setUint8(10, 0x56) // 'V'
  view.setUint8(11, 0x45) // 'E'

  // fmt chunk
  view.setUint8(12, 0x66) // 'f'
  view.setUint8(13, 0x6D) // 'm'
  view.setUint8(14, 0x74) // 't'
  view.setUint8(15, 0x20) // ' '
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // audio format (PCM)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  view.setUint8(36, 0x64) // 'd'
  view.setUint8(37, 0x61) // 'a'
  view.setUint8(38, 0x74) // 't'
  view.setUint8(39, 0x61) // 'a'
  view.setUint32(40, dataSize, true)

  // Combine header and PCM data
  const wavFile = new Uint8Array(44 + dataSize)
  wavFile.set(new Uint8Array(wavHeader), 0)
  wavFile.set(pcmData, 44)

  return wavFile
}

/**
 * Generate audio using Gemini TTS API
 * Returns WAV audio as Uint8Array binary data
 */
async function generateAudio(text: string, apiKey: string, ttsModel: string, voice: string = DEFAULT_VOICE): Promise<Uint8Array> {
  const url = `${DEFAULT_BASE_URL}/models/${ttsModel}:generateContent?key=${apiKey}`
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice
            }
          }
        }
      }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error("Gemini TTS API error", { status: response.status, error: errorText })
    throw new Error(`Gemini TTS API error: ${response.status}`)
  }

  const data = await response.json()
  
  // Extract audio data from response
  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData
  if (!inlineData || !inlineData.data) {
    throw new Error("No audio data in Gemini TTS response")
  }

  // Decode base64 PCM data
  const pcmBase64 = inlineData.data
  const binaryString = atob(pcmBase64)
  const pcmBytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    pcmBytes[i] = binaryString.charCodeAt(i)
  }

  // Convert PCM to WAV and return binary data
  return pcmToWav(pcmBytes)
}

/**
 * Upload audio file to Supabase Storage
 * Returns public URL of the uploaded file
 */
async function uploadAudioToStorage(
  audioData: Uint8Array,
  filePath: string,
  supabaseAdmin: any
): Promise<string> {
  const BUCKET_NAME = "vocabulary-audio"
  
  // Ensure bucket exists (idempotent)
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
  if (listError) {
    logger.error("Failed to list buckets", {}, listError as Error)
    throw new Error("Failed to access storage")
  }
  
  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME)
  if (!bucketExists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ["audio/wav", "audio/wave"]
    })
    if (createError) {
      logger.error("Failed to create bucket", {}, createError as Error)
      throw new Error("Failed to create storage bucket")
    }
    logger.info("Created storage bucket", { bucket: BUCKET_NAME })
  }

  // Upload file
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(filePath, audioData, {
      contentType: "audio/wav",
      upsert: true // Overwrite if exists
    })

  if (uploadError) {
    logger.error("Failed to upload audio", { filePath }, uploadError as Error)
    throw new Error(`Failed to upload audio: ${uploadError.message}`)
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath)

  if (!urlData?.publicUrl) {
    throw new Error("Failed to get public URL for uploaded audio")
  }

  logger.info("Audio uploaded successfully", { filePath, url: urlData.publicUrl })
  return urlData.publicUrl
}

async function enrichWord(word: string, wordId: string, userId: string, supabaseAdmin: any): Promise<any> {
  // API Key must be configured in Supabase environment variables
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY")
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY not configured in Supabase environment variables")
  }

  // Get user's model configuration, fallback to defaults if not found
  const { data: userSettings } = await supabaseAdmin
    .from("user_settings")
    .select("gemini_model_config")
    .eq("user_id", userId)
    .single()
  
  const textModelConfig = userSettings?.gemini_model_config?.textModel || DEFAULT_GEMINI_TEXT_MODEL_CONFIG
  const ttsModelConfig = userSettings?.gemini_model_config?.ttsModel || DEFAULT_GEMINI_TTS_MODEL_CONFIG
  const model = textModelConfig.model
  const ttsModel = ttsModelConfig.model

  const prompt = `
    Role: Expert IELTS vocabulary tutor.
    Task: Analyze the English word "${word}" for a student targeting IELTS Band 7+.
    Requirements:
    1. Target Language for translations: Chinese (Simplified).
    2. Focus on Academic/General training definitions suitable for IELTS.
    3. Ensure example sentences demonstrate Band 7+ complexity and vocabulary usage.
    4. If the word serves multiple parts of speech, provide the 2 most common ones.
  `;

  const url = `${DEFAULT_BASE_URL}/models/${model}:generateContent?key=${geminiApiKey}`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: textModelConfig.temperature,
        topK: textModelConfig.topK,
        topP: textModelConfig.topP,
        maxOutputTokens: textModelConfig.maxOutputTokens,
      },
    }),
  });

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)
  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content && data.candidates?.[0]?.finishReason) {
    throw new Error(`Gemini blocked content: ${data.candidates[0].finishReason}`);
  }
  if (!content) throw new Error("No content from Gemini")
  
  let wordData: WordAnalysisResult;
  try {
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    wordData = JSON.parse(cleanContent);
  } catch (e) {
    logger.warn("JSON Parse Error:", content);
    throw new Error("Failed to parse Gemini response");
  }

  // Generate and upload audio files to Storage
  let wordAudioUrl = null
  let exampleAudioUrls = null
  try {
    // Generate word audio
    const wordAudioData = await generateAudio(word, geminiApiKey, ttsModel)
    const wordStoragePath = `${userId}/${wordId}/word.wav`
    wordAudioUrl = await uploadAudioToStorage(wordAudioData, wordStoragePath, supabaseAdmin)
    
    // Generate example sentence audios
    if (wordData.exampleSentences && wordData.exampleSentences.length > 0) {
      exampleAudioUrls = await Promise.all(
        wordData.exampleSentences.map(async (ex: any, index: number) => {
          try {
            const exampleAudioData = await generateAudio(ex.sentence, geminiApiKey, ttsModel)
            const exampleStoragePath = `${userId}/${wordId}/example-${index}.wav`
            const audioUrl = await uploadAudioToStorage(exampleAudioData, exampleStoragePath, supabaseAdmin)
            return { sentence: ex.sentence, audio_url: audioUrl }
          } catch (error) {
            logger.warn("Failed to generate/upload example audio", { index, sentence: ex.sentence }, error as Error)
            return { sentence: ex.sentence, audio_url: "" }
          }
        })
      )
    }
  } catch (e) {
    logger.warn("Audio generation/upload failed", { wordId }, e as Error)
  }

  return { wordData, wordAudioUrl, exampleAudioUrls }
}
