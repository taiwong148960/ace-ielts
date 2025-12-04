/**
 * Supabase Edge Function: Gemini Enrich Word
 * Server-side proxy for Gemini API calls (SaaS mode)
 */

// @ts-ignore - Deno is available at runtime in Supabase Edge Functions
// @deno-types="https://deno.land/x/types/index.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Declare Deno global for TypeScript
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get: (key: string) => string | undefined
  }
}

const DEFAULT_MODEL = "gemini-1.5-pro"
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

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

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
      }
    })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    // Verify user session
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      )
    }

    // Get request body
    const { word } = await req.json()
    if (!word || typeof word !== "string") {
      return new Response(
        JSON.stringify({ error: "Word parameter is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      )
    }

    // Get Gemini API key from environment
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      )
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
    const url = `${DEFAULT_BASE_URL}/models/${DEFAULT_MODEL}:generateContent?key=${geminiApiKey}`

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
      
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${response.status}` }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      )
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No content returned from Gemini API" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      )
    }

    // Parse JSON response
    let wordData: WordDetailData
    try {
      const cleanedContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      wordData = JSON.parse(cleanedContent)
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON response from Gemini API" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      )
    }

    // Return enriched word data
    return new Response(
      JSON.stringify(wordData),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    )
  } catch (error) {
    console.error("Edge function error:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      }
    )
  }
})

