/**
 * Supabase Edge Function: Gemini Enrich Word
 * Server-side proxy for Gemini API calls
 * Supports both SaaS mode (platform-managed API key) and self-hosted mode (user API key)
 */

import { handleCors, errorResponse, successResponse } from "../_shared/cors.ts"
import { initSupabase } from "../_shared/supabase.ts"
import { safeDecrypt } from "../_shared/crypto.ts"

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
const DEFAULT_VOICE = "en-US-Neural2-F" // Professional female voice

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

  // Return data URL (base64 encoded MP3)
  return `data:audio/mp3;base64,${data.audioContent}`
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin")
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Initialize Supabase and verify authentication
    const { user, supabaseAdmin } = await initSupabase(
      req.headers.get("Authorization")
    )

    // Get request body
    const body = await req.json()
    const { word } = body
    if (!word || typeof word !== "string") {
      return errorResponse("Word parameter is required", 400, origin)
    }

    // Get user settings to retrieve model configuration and API key
    const { data: userSettings, error: settingsError } = await supabaseAdmin
      .from("user_settings")
      .select("gemini_model_config, llm_api_key_encrypted, llm_provider")
      .eq("user_id", user.id)
      .single()

    // Extract model config from user settings (if available)
    const textModelConfig = userSettings?.gemini_model_config?.textModel || {}
    const ttsModelConfig = userSettings?.gemini_model_config?.ttsModel || {}

    // Use user's model config or defaults
    const model = textModelConfig.model || DEFAULT_MODEL
    const temperature = textModelConfig.temperature ?? 0.7
    const topK = textModelConfig.topK ?? 40
    const topP = textModelConfig.topP ?? 0.95
    const maxOutputTokens = textModelConfig.maxOutputTokens ?? 2048

    // Determine API key source: SaaS mode (platform-managed) or self-hosted mode (user-provided)
    // Priority: 1. Platform API key (SaaS mode), 2. User API key (self-hosted mode)
    let geminiApiKey: string | null = null

    // Try platform-managed API key first (SaaS mode)
    const platformApiKey = Deno.env.get("GEMINI_API_KEY")
    if (platformApiKey) {
      geminiApiKey = platformApiKey
      // Using platform-managed API key (SaaS mode)
    } else {
      // Fall back to user's API key (self-hosted mode)
      if (!userSettings?.llm_api_key_encrypted) {
        return errorResponse(
          "LLM API key not configured. Please set your API key in settings.",
          400,
          origin
        )
      }

      // Decrypt the user's API key
      geminiApiKey = await safeDecrypt(userSettings.llm_api_key_encrypted)
      if (!geminiApiKey) {
        return errorResponse("Failed to decrypt API key", 500, origin)
      }

      // Verify the provider is compatible (should be "gemini" or similar)
      if (userSettings.llm_provider && userSettings.llm_provider !== "gemini") {
        return errorResponse(
          `Unsupported LLM provider: ${userSettings.llm_provider}. This function requires Gemini API.`,
          400,
          origin
        )
      }
      // Using user API key (self-hosted mode)
    }

    if (!geminiApiKey) {
      return errorResponse("Gemini API key not available", 500, origin)
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

    // Call Gemini API with user's model configuration
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
      console.error("Gemini API error:", errorText)
      
      return errorResponse(
        `Gemini API error: ${response.status}`,
        response.status,
        origin
      )
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      return errorResponse("No content returned from Gemini API", 500, origin)
    }

    // Parse JSON response
    let wordData: WordDetailData
    try {
      const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      wordData = JSON.parse(cleanedContent)
    } catch (parseError) {
      return errorResponse("Invalid JSON response from Gemini API", 500, origin)
    }

    // Generate audio for word and example sentences
    // Note: Google Cloud TTS API uses voice parameter (not model)
    // User's TTS model config is for Gemini TTS, not Google Cloud TTS
    // So we continue using DEFAULT_VOICE for Google Cloud TTS
    let wordAudioUrl: string | null = null
    let exampleAudioUrls: ExampleAudioData[] | null = null

    try {
      // Generate word pronunciation audio
      wordAudioUrl = await generateAudio(word, geminiApiKey, DEFAULT_VOICE)

      // Generate audio for example sentences
      if (wordData.exampleSentences && wordData.exampleSentences.length > 0) {
        const audioPromises = wordData.exampleSentences.map(async (ex) => {
          try {
            const audioUrl = await generateAudio(ex.sentence, geminiApiKey, DEFAULT_VOICE)
            return {
              sentence: ex.sentence,
              audio_url: audioUrl
            }
          } catch (error) {
            console.error(`Failed to generate audio for sentence: "${ex.sentence}"`, error)
            return {
              sentence: ex.sentence,
              audio_url: ""
            }
          }
        })

        exampleAudioUrls = await Promise.all(audioPromises)
      }
    } catch (audioError) {
      // Don't fail the entire request if audio generation fails
      console.warn(`Audio generation failed for word "${word}":`, audioError)
    }

    // Return enriched word data with audio URLs
    const responseData = {
      ...wordData,
      _audio: {
        word_audio_url: wordAudioUrl,
        example_audio_urls: exampleAudioUrls
      }
    }

    return successResponse(responseData, 200, origin)
  } catch (error) {
    console.error("Edge function error:", error)
    
    if (error instanceof Error) {
      if (error.message === "Unauthorized" || error.message === "Missing authorization header") {
        return errorResponse(error.message, 401, origin)
      }
      if (error.message.includes("API key")) {
        return errorResponse(error.message, 400, origin)
      }
    }
    
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
      origin
    )
  }
})

