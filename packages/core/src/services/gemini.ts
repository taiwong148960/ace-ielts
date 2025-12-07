/**
 * Gemini API Service
 * Handles word enrichment using Google Gemini API via @google/genai SDK
 * Also handles audio generation using Gemini TTS models
 */

import { GoogleGenAI } from "@google/genai"
import type { 
  WordDetailData, 
  ExampleAudioData,
  GeminiTextModelConfig,
  GeminiTTSModelConfig
} from "../types/vocabulary"
import {
  DEFAULT_GEMINI_TEXT_MODEL_CONFIG,
  DEFAULT_GEMINI_TTS_MODEL_CONFIG
} from "../types/vocabulary"
import { createLogger } from "../utils/logger"

// Create logger for this service
const logger = createLogger("GeminiService")

/**
 * Gemini API configuration
 */
export interface GeminiConfig {
  apiKey: string
  textModelConfig?: Partial<GeminiTextModelConfig>
  ttsModelConfig?: Partial<GeminiTTSModelConfig>
}

/**
 * Enrich a word using Gemini API
 * Returns structured word data including definitions, examples, synonyms, etc.
 */
export async function enrichWord(
  word: string,
  config: GeminiConfig
): Promise<WordDetailData> {
  const apiKey = config.apiKey
  const modelConfig = {
    ...DEFAULT_GEMINI_TEXT_MODEL_CONFIG,
    ...config.textModelConfig
  }

  if (!apiKey) {
    throw new Error("Gemini API key is required")
  }

  // Initialize GoogleGenAI client
  const ai = new GoogleGenAI({ apiKey })

  // Construct the prompt for structured JSON output
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

  try {
    logger.info("Enriching word with Gemini", { 
      word, 
      model: modelConfig.model 
    })

    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: prompt,
      config: {
        temperature: modelConfig.temperature,
        topK: modelConfig.topK,
        topP: modelConfig.topP,
        maxOutputTokens: modelConfig.maxOutputTokens,
        responseMimeType: "application/json"
      }
    })

    // Extract the text content from response
    const content = response.text
    if (!content) {
      throw new Error("No content returned from Gemini API")
    }

    // Parse the JSON response
    let wordData: WordDetailData
    try {
      // Remove any markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      wordData = JSON.parse(cleanedContent)
    } catch (parseError) {
      logger.error("Failed to parse Gemini response", {
        word,
        responsePreview: content.substring(0, 200) // Truncate for logging
      }, parseError instanceof Error ? parseError : new Error(String(parseError)))
      throw new Error("Invalid JSON response from Gemini API")
    }

    // Validate the structure
    if (!wordData.definitions || !Array.isArray(wordData.definitions)) {
      throw new Error("Invalid response structure: missing definitions")
    }

    if (!wordData.exampleSentences || !Array.isArray(wordData.exampleSentences)) {
      throw new Error("Invalid response structure: missing example sentences")
    }

    logger.info("Word enriched successfully", { word, definitionCount: wordData.definitions.length })
    return wordData
  } catch (error) {
    if (error instanceof Error) {
      // Check for specific error types from @google/genai
      if (error.message.includes("API key") || error.message.includes("401") || error.message.includes("403")) {
        logger.error("Gemini API authentication failed", { word }, error)
        throw new Error("Invalid API key. Please check your Gemini API key.")
      }
      if (error.message.includes("429") || error.message.includes("rate limit")) {
        logger.error("Gemini API rate limit exceeded", { word }, error)
        throw new Error("API rate limit exceeded. Please try again later.")
      }
      logger.error("Gemini API request failed", { word }, error)
      throw error
    }
    throw new Error(`Failed to enrich word: ${String(error)}`)
  }
}

/**
 * Retry wrapper for API calls with exponential backoff
 */
export async function enrichWordWithRetry(
  word: string,
  config: GeminiConfig,
  maxRetries: number = 3
): Promise<WordDetailData> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add delay for retries (exponential backoff)
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Max 10 seconds
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      return await enrichWord(word, config)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry on authentication errors
      if (lastError.message.includes("Invalid API key")) {
        throw lastError
      }
      
      // Don't retry on rate limit (should wait longer)
      if (lastError.message.includes("rate limit")) {
        throw lastError
      }

      logger.warn("Word enrichment attempt failed", {
        word,
        attempt: attempt + 1,
        maxAttempts: maxRetries
      }, lastError)
    }
  }

  throw lastError || new Error("Failed to enrich word after retries")
}

/**
 * Generate audio for a word or sentence using Gemini TTS models
 * Returns a data URL (base64 encoded audio)
 */
export async function generateAudio(
  text: string,
  apiKey: string,
  ttsModelConfig?: Partial<GeminiTTSModelConfig>
): Promise<string> {
  if (!apiKey) {
    throw new Error("API key is required for audio generation")
  }

  const modelConfig = {
    ...DEFAULT_GEMINI_TTS_MODEL_CONFIG,
    ...ttsModelConfig
  }

  // Initialize GoogleGenAI client
  const ai = new GoogleGenAI({ apiKey })

  try {
    logger.info("Generating audio with Gemini TTS", { 
      textPreview: text.substring(0, 50),
      model: modelConfig.model 
    })

    // Use Gemini TTS model to generate audio
    const response = await ai.models.generateContent({
      model: modelConfig.model,
      contents: text
    })

    // Extract audio content from response
    // Gemini TTS returns audio data in inlineData format
    const candidates = response.candidates
    if (!candidates || candidates.length === 0) {
      throw new Error("No candidates returned from Gemini TTS API")
    }

    const parts = candidates[0].content?.parts
    if (!parts || parts.length === 0) {
      throw new Error("No parts returned from Gemini TTS API")
    }

    // Find the audio part (inlineData)
    const audioPart = parts.find((part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData)
    if (!audioPart || !audioPart.inlineData) {
      throw new Error("No audio data found in Gemini TTS response")
    }

    const audioData = audioPart.inlineData.data
    const mimeType = audioPart.inlineData.mimeType || "audio/mp3"

    if (!audioData) {
      throw new Error("No audio content returned from Gemini TTS API")
    }

    // Return data URL (base64 encoded audio)
    return `data:${mimeType};base64,${audioData}`
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("API key") || error.message.includes("401") || error.message.includes("403")) {
        logger.error("Gemini TTS API authentication failed", {
          textPreview: text.substring(0, 50)
        }, error)
        throw new Error("Invalid API key for Text-to-Speech. Please check your Gemini API key.")
      }
      if (error.message.includes("429") || error.message.includes("rate limit")) {
        logger.error("Gemini TTS API rate limit exceeded", {
          textPreview: text.substring(0, 50)
        }, error)
        throw new Error("TTS API rate limit exceeded. Please try again later.")
      }
      logger.error("Gemini TTS API request failed", {
        textPreview: text.substring(0, 50)
      }, error)
      throw error
    }
    throw new Error(`Failed to generate audio: ${String(error)}`)
  }
}

/**
 * Generate audio for a word
 */
export async function generateWordAudio(
  word: string,
  apiKey: string,
  ttsModelConfig?: Partial<GeminiTTSModelConfig>
): Promise<string> {
  return generateAudio(word, apiKey, ttsModelConfig)
}

/**
 * Generate audio for multiple example sentences
 * Returns array of audio data with sentence text
 */
export async function generateExampleAudios(
  sentences: string[],
  apiKey: string,
  ttsModelConfig?: Partial<GeminiTTSModelConfig>
): Promise<ExampleAudioData[]> {
  const audioPromises = sentences.map(async (sentence) => {
    try {
      const audioUrl = await generateAudio(sentence, apiKey, ttsModelConfig)
      return {
        sentence,
        audio_url: audioUrl
      }
    } catch (error) {
      logger.warn("Failed to generate audio for sentence", {
        sentencePreview: sentence.substring(0, 50)
      }, error instanceof Error ? error : new Error(String(error)))
      // Return empty audio URL on failure (don't fail entire operation)
      return {
        sentence,
        audio_url: ""
      }
    }
  })

  return Promise.all(audioPromises)
}
