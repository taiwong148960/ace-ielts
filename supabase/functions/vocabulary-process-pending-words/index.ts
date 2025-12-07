/**
 * Supabase Edge Function: Process Pending Words
 * Called by pg_cron to process words that need enrichment
 * This function:
 * 1. Fetches words with import_status = 'pending' or 'importing'
 * 2. Enriches each word using Gemini API directly (not via Edge Function)
 * 3. Updates word status and book progress
 * 
 * This function is called internally by pg_cron, so it uses service role key
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createLogger } from "@supabase/functions/_shared/logger.ts"
import { safeDecrypt } from "../_shared/crypto.ts"

const logger = createLogger("vocabulary-process-pending-words")

// Declare Deno global for TypeScript
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

const DEFAULT_MODEL = "gemini-1.5-pro"
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
const TTS_BASE_URL = "https://texttospeech.googleapis.com/v1"
const DEFAULT_VOICE = "en-US-Neural2-F"
const BATCH_SIZE = 5 // Process 5 words per call to avoid timeout

interface WordDetailData {
  definitions: Array<{
    partOfSpeech: string
    meaning: string
  }>
  exampleSentences: Array<{
    sentence: string
    source: "ielts" | "daily" | "movie" | "tv"
    translation?: string
  }>
  synonyms?: string[]
  antonyms?: string[]
  relatedWords?: {
    baseForm?: string
    comparative?: string
    superlative?: string
    pastTense?: string
    pastParticiple?: string
    presentParticiple?: string
    plural?: string
  }
  easilyConfused?: string[]
  usageFrequency?: "common" | "uncommon" | "rare"
  tenses?: string[]
}

interface ExampleAudioData {
  sentence: string
  audio_url: string
}

/**
 * Generate audio using Google Cloud Text-to-Speech API
 */
async function generateAudio(
  text: string,
  apiKey: string,
  voice: string = DEFAULT_VOICE
): Promise<string> {
  const url = `${TTS_BASE_URL}/text:synthesize?key=${apiKey}`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: {
        text: text
      },
      voice: {
        languageCode: "en-US",
        name: voice,
        ssmlGender: voice.includes("Neural2-A") || 
                   voice.includes("Neural2-B") || 
                   voice.includes("Neural2-E") || 
                   voice.includes("Neural2-F") || 
                   voice.includes("Neural2-G") 
          ? "FEMALE" : "MALE"
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0
      }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`TTS API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  if (!data.audioContent) {
    throw new Error("No audio content returned from TTS API")
  }

  return `data:audio/mp3;base64,${data.audioContent}`
}

/**
 * Enrich a word using Gemini API
 */
async function enrichWord(
  word: string,
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<{
  wordData: WordDetailData
  wordAudioUrl: string | null
  exampleAudioUrls: ExampleAudioData[] | null
}> {
  // Get user settings to retrieve model configuration and API key
  const { data: userSettings, error: settingsError } = await supabaseAdmin
    .from("user_settings")
    .select("gemini_model_config, llm_api_key_encrypted, llm_provider")
    .eq("user_id", userId)
    .single()

  if (settingsError || !userSettings) {
    throw new Error("User settings not found")
  }

  // Extract model config from user settings
  const textModelConfig = userSettings?.gemini_model_config?.textModel || {}
  const model = textModelConfig.model || DEFAULT_MODEL
  const temperature = textModelConfig.temperature ?? 0.7
  const topK = textModelConfig.topK ?? 40
  const topP = textModelConfig.topP ?? 0.95
  const maxOutputTokens = textModelConfig.maxOutputTokens ?? 2048

  // Determine API key source: SaaS mode (platform-managed) or self-hosted mode (user-provided)
  let geminiApiKey: string | null = null

  // Try platform-managed API key first (SaaS mode)
  const platformApiKey = Deno.env.get("GEMINI_API_KEY")
  if (platformApiKey) {
    geminiApiKey = platformApiKey
  } else {
    // Fall back to user's API key (self-hosted mode)
    if (!userSettings?.llm_api_key_encrypted) {
      throw new Error("LLM API key not configured")
    }

    geminiApiKey = await safeDecrypt(userSettings.llm_api_key_encrypted)
    if (!geminiApiKey) {
      throw new Error("Failed to decrypt API key")
    }

    if (userSettings.llm_provider && userSettings.llm_provider !== "gemini") {
      throw new Error(`Unsupported LLM provider: ${userSettings.llm_provider}`)
    }
  }

  if (!geminiApiKey) {
    throw new Error("Gemini API key not available")
  }

  // Construct prompt
  const prompt = `You are an expert English vocabulary teacher specializing in IELTS preparation. 

Analyze the word "${word}" and provide comprehensive information in JSON format. The response must be valid JSON only, no additional text.

Required structure:
{
  "definitions": [
    {
      "partOfSpeech": "noun|verb|adjective|adverb|preposition|conjunction|pronoun|interjection",
      "meaning": "Clear, concise definition"
    }
  ],
  "exampleSentences": [
    {
      "sentence": "Example sentence using the word",
      "source": "ielts|daily|movie|tv",
      "translation": "Chinese translation (optional)"
    }
  ],
  "synonyms": ["word1", "word2"],
  "antonyms": ["word1", "word2"],
  "relatedWords": {
    "baseForm": "base form if applicable",
    "comparative": "comparative form if adjective/adverb",
    "superlative": "superlative form if adjective/adverb",
    "pastTense": "past tense if verb",
    "pastParticiple": "past participle if verb",
    "presentParticiple": "present participle if verb",
    "plural": "plural form if noun"
  },
  "easilyConfused": ["word1", "word2"],
  "usageFrequency": "common|uncommon|rare",
  "tenses": ["tense1", "tense2"] // Only for verbs
}

Requirements:
1. Provide ALL definitions with their parts of speech
2. Provide EXACTLY 10 example sentences:
   - 3-4 from IELTS exam contexts (academic, formal)
   - 3-4 from daily life contexts (casual, conversational)
   - 2-3 from movies or TV shows (with source name if possible)
   - Each sentence must clearly show the word's usage
   - Mark the source for each sentence
3. Include synonyms and antonyms if available
4. Include all related word forms (inflections, tenses, etc.)
5. List easily confused words (words that are commonly mistaken for this word)
6. Indicate usage frequency
7. For verbs, list all applicable tenses

Word to analyze: "${word}"

Return ONLY valid JSON, no markdown formatting, no code blocks.`

  // Call Gemini API
  const url = `${DEFAULT_BASE_URL}/models/${model}:generateContent?key=${geminiApiKey}`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature,
        topK,
        topP,
        maxOutputTokens,
        responseMimeType: "application/json"
      }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!content) {
    throw new Error("No content returned from Gemini API")
  }

  // Parse JSON response
  let wordData: WordDetailData
  try {
    const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    wordData = JSON.parse(cleanedContent)
  } catch (parseError) {
    throw new Error("Invalid JSON response from Gemini API")
  }

  // Generate audio for word and example sentences
  let wordAudioUrl: string | null = null
  let exampleAudioUrls: ExampleAudioData[] | null = null

  try {
    wordAudioUrl = await generateAudio(word, geminiApiKey, DEFAULT_VOICE)

    if (wordData.exampleSentences && wordData.exampleSentences.length > 0) {
      const audioPromises = wordData.exampleSentences.map(async (ex) => {
        try {
          const audioUrl = await generateAudio(ex.sentence, geminiApiKey, DEFAULT_VOICE)
          return {
            sentence: ex.sentence,
            audio_url: audioUrl
          }
        } catch (error) {
          logger.error("Failed to generate audio for sentence", { sentence: ex.sentence, word }, error as Error)
          return {
            sentence: ex.sentence,
            audio_url: ""
          }
        }
      })

      exampleAudioUrls = await Promise.all(audioPromises)
    }
  } catch (audioError) {
    logger.warn("Audio generation failed for word", { word }, audioError as Error)
  }

  return {
    wordData,
    wordAudioUrl,
    exampleAudioUrls
  }
}

Deno.serve(async (req) => {
  try {
    // This function is called by pg_cron, so we use service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables not configured")
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get pending or importing words (limit to batch size)
    const { data: words, error: wordsError } = await supabaseAdmin
      .from("vocabulary_words")
      .select("id, word, book_id, import_status")
      .in("import_status", ["pending", "importing"])
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE)

    if (wordsError) {
      logger.error("Failed to fetch pending words", {}, new Error(wordsError.message))
      return new Response(JSON.stringify({ success: false, error: wordsError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    }

    if (!words || words.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No pending words" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    }

    logger.info("Processing pending words", { count: words.length })

    let processedCount = 0

    // Process each word
    for (const wordRecord of words) {
      try {
        // Get book to find user_id
        const { data: book, error: bookError } = await supabaseAdmin
          .from("vocabulary_books")
          .select("id, user_id, import_progress, import_total, import_status")
          .eq("id", wordRecord.book_id)
          .single()

        if (bookError || !book) {
          logger.error("Failed to fetch book", { bookId: wordRecord.book_id }, new Error(bookError?.message || "Book not found"))
          // Skip this word if book not found
          continue
        }

        // Skip if book is not in importing state
        if (book.import_status !== "importing") {
          logger.debug("Skipping word - book not importing", { bookId: book.id, wordId: wordRecord.id })
          continue
        }

        // Enrich word
        const { wordData, wordAudioUrl, exampleAudioUrls } = await enrichWord(
          wordRecord.word,
          book.user_id!,
          supabaseAdmin
        )

        // Update word with enriched data
        await supabaseAdmin
          .from("vocabulary_words")
          .update({
            import_status: "completed",
            word_details: wordData,
            word_audio_url: wordAudioUrl,
            example_audio_urls: exampleAudioUrls
          })
          .eq("id", wordRecord.id)

        // Update book progress
        const newProgress = (book.import_progress || 0) + 1
        const isComplete = newProgress >= (book.import_total || 0)

        await supabaseAdmin
          .from("vocabulary_books")
          .update({
            import_progress: newProgress,
            import_status: isComplete ? "completed" : "importing",
            import_completed_at: isComplete ? new Date().toISOString() : null
          })
          .eq("id", book.id)

        processedCount++
        logger.info("Word processed successfully", { 
          wordId: wordRecord.id, 
          word: wordRecord.word,
          bookId: book.id,
          progress: newProgress,
          total: book.import_total
        })

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        logger.error("Failed to process word - will retry later", { 
          wordId: wordRecord.id, 
          word: wordRecord.word 
        }, error instanceof Error ? error : new Error(errorMessage))

        // Don't mark as failed - keep as pending/importing so it can be retried
        // The word will be processed again in the next cron run
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: processedCount,
      total: words.length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })

  } catch (error) {
    logger.error("Edge function error", {}, error as Error)
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Internal server error" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
