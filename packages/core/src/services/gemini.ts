/**
 * Gemini API Service
 * Handles word enrichment using Google Gemini API
 */

import type { WordDetailData } from "../types/vocabulary"

/**
 * Gemini API configuration
 */
interface GeminiConfig {
  apiKey: string
  model?: string
  baseUrl?: string
}

/**
 * Default Gemini model
 */
const DEFAULT_MODEL = "gemini-1.5-pro"

/**
 * Default Gemini API base URL
 */
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

/**
 * Enrich a word using Gemini API
 * Returns structured word data including definitions, examples, synonyms, etc.
 */
export async function enrichWord(
  word: string,
  config: GeminiConfig
): Promise<WordDetailData> {
  const apiKey = config.apiKey
  const model = config.model || DEFAULT_MODEL
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL

  if (!apiKey) {
    throw new Error("Gemini API key is required")
  }

  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`

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
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Gemini API error:", errorText)
      
      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid API key. Please check your Gemini API key.")
      }
      if (response.status === 429) {
        throw new Error("API rate limit exceeded. Please try again later.")
      }
      
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // Extract the JSON content from Gemini response
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) {
      throw new Error("No content returned from Gemini API")
    }

    // Parse the JSON response
    let wordData: WordDetailData
    try {
      // Remove any markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      wordData = JSON.parse(cleanedContent)
    } catch {
      console.error("Failed to parse Gemini response:", content)
      throw new Error("Invalid JSON response from Gemini API")
    }

    // Validate the structure
    if (!wordData.definitions || !Array.isArray(wordData.definitions)) {
      throw new Error("Invalid response structure: missing definitions")
    }

    if (!wordData.exampleSentences || !Array.isArray(wordData.exampleSentences)) {
      throw new Error("Invalid response structure: missing example sentences")
    }

    return wordData
  } catch (error) {
    if (error instanceof Error) {
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

      console.warn(`Attempt ${attempt + 1} failed for word "${word}":`, lastError.message)
    }
  }

  throw lastError || new Error("Failed to enrich word after retries")
}

