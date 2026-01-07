import { errorResponse, handleCors, successResponse } from "../_shared/cors.ts";
import { initSupabase } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logger.ts";
import { Router } from "../_shared/router.ts";
import {
  DEFAULT_GEMINI_TEXT_MODEL_CONFIG,
  DEFAULT_GEMINI_TTS_MODEL_CONFIG,
} from "../_shared/types.ts";
import { createClient, SupabaseClient } from "../_shared/supabase.ts";

const logger = createLogger("vocabulary-words");

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
  audio_path?: string;
}

interface WordAnalysisResult {
  meta: {
    phonetic: string;
    frequency: string;
    topic: string;
    synonyms: string[];
    antonyms: string[];
    collocations: string[];
    word_family: string[];
  };
  forms: {
    base: string | null;
    past: string | null;
    past_participle: string | null;
    present_participle: string | null;
    plural: string | null;
    comparative: string | null;
    superlative: string | null;
    tenses: string[];
  };
  definitions: WordDefinition[];
  examples: ExampleSentence[];
  confused_words: { word: string; difference: string }[];
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    meta: {
      type: "OBJECT",
      properties: {
        phonetic: { type: "STRING" },
        frequency: { type: "STRING", enum: ["high", "medium", "low"] },
        topic: { type: "STRING" },
        synonyms: { type: "ARRAY", items: { type: "STRING" } },
        antonyms: { type: "ARRAY", items: { type: "STRING" } },
        collocations: { type: "ARRAY", items: { type: "STRING" } },
        word_family: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: [
        "phonetic",
        "frequency",
        "topic",
        "synonyms",
        "antonyms",
        "collocations",
        "word_family",
      ],
    },
    forms: {
      type: "OBJECT",
      properties: {
        base: { type: "STRING" },
        past: { type: "STRING" },
        past_participle: { type: "STRING" },
        present_participle: { type: "STRING" },
        plural: { type: "STRING" },
        comparative: { type: "STRING" },
        superlative: { type: "STRING" },
        tenses: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: ["tenses"],
    },
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
    examples: {
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
    confused_words: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          word: { type: "STRING" },
          difference: { type: "STRING" },
        },
        required: ["word", "difference"],
      },
    },
  },
  required: ["meta", "forms", "definitions", "examples", "confused_words"],
};

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

// Router Setup
const router = new Router();

router.get("/", handleGetWords);
router.post("/", handleAddWords);
router.delete("/:id", handleDeleteWord);
router.post("/process", handleProcessPendingWords);

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    return await router.handle(req);
  } catch (error) {
    logger.error("Router error", {}, error as Error);
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
});

// ============================================================================
// Handlers
// ============================================================================

async function handleGetWords(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(
    req.headers.get("Authorization"),
  );
  const url = new URL(req.url);
  const bookId = url.searchParams.get("bookId");

  logger.info("Fetching words", { userId: user.id, bookId });

  if (!bookId) return errorResponse("Book ID is required", 400);

  // Verify access
  const { data: book } = await supabaseAdmin
    .from("vocabulary_books")
    .select("user_id, is_system_book")
    .eq("id", bookId)
    .single();

  if (!book) return errorResponse("Book not found", 404);
  if (!book.is_system_book && book.user_id !== user.id) {
    return errorResponse("Forbidden", 403);
  }

  const { data: words, error } = await supabaseAdmin.rpc("get_book_words", {
    p_book_id: bookId,
  });

  if (error) {
    logger.error(
      "Failed to fetch words",
      { userId: user.id, bookId },
      new Error(error.message),
    );
    return errorResponse("Failed to fetch words", 500);
  }
  return successResponse(words || []);
}

async function handleAddWords(req: Request) {
  const { user, supabaseAdmin } = await initSupabase(
    req.headers.get("Authorization"),
  );
  const input = await req.json();
  const { bookId, words } = input;

  logger.info("Adding words", {
    userId: user.id,
    bookId,
    count: words?.length,
  });

  if (!bookId) return errorResponse("Book ID is required", 400);
  if (!words || !Array.isArray(words) || words.length === 0) {
    return errorResponse("Words array required", 400);
  }

  // Verify access
  const { data: book } = await supabaseAdmin
    .from("vocabulary_books")
    .select("user_id")
    .eq("id", bookId)
    .single();

  if (!book) return errorResponse("Book not found", 404);
  if (book.user_id !== user.id) return errorResponse("Forbidden", 403);

  const cleanedWords = words
    .map((w: unknown) => typeof w === "string" ? w.trim() : "")
    .filter((w: string) => w.length > 0);

  if (cleanedWords.length === 0) return errorResponse("No valid words", 400);

  const { error } = await supabaseAdmin.rpc("add_words_to_book", {
    p_book_id: bookId,
    p_words: cleanedWords,
  });

  if (error) return errorResponse("Failed to add words", 500);

  logger.info("Words added successfully", {
    userId: user.id,
    bookId,
    count: cleanedWords.length,
  });

  const { data: updatedBook } = await supabaseAdmin
    .from("vocabulary_books")
    .select("word_count")
    .eq("id", bookId)
    .single();

  return successResponse({
    words: [],
    wordCount: updatedBook?.word_count || 0,
  });
}

async function handleDeleteWord(req: Request, params: Record<string, string>) {
  const { user, supabaseAdmin } = await initSupabase(
    req.headers.get("Authorization"),
  );
  const wordId = params.id;
  const url = new URL(req.url);
  const bookId = url.searchParams.get("bookId");

  logger.info("Deleting word", { userId: user.id, bookId, wordId });

  if (!bookId) return errorResponse("Book ID is required (query param)", 400);

  // Verify access
  const { data: book } = await supabaseAdmin
    .from("vocabulary_books")
    .select("user_id")
    .eq("id", bookId)
    .single();

  if (!book) return errorResponse("Book not found", 404);
  if (book.user_id !== user.id) return errorResponse("Forbidden", 403);

  const { error } = await supabaseAdmin
    .from("vocabulary_book_words")
    .delete()
    .eq("word_id", wordId)
    .eq("book_id", bookId);

  if (error) return errorResponse("Failed to delete word", 500);

  const { data: updatedBook } = await supabaseAdmin
    .from("vocabulary_books")
    .select("word_count")
    .eq("id", bookId)
    .single();

  return successResponse({
    deleted: true,
    wordId,
    wordCount: updatedBook?.word_count || 0,
  });
}

// ============================================================================
// Process Pending Words Logic
// ============================================================================

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_VOICE = "Zephyr";
const GEMINI_VOICES = ["Puck", "Charon", "Kore", "Fenrir", "Aoede", "Zephyr"];
const MAX_EXECUTION_TIME_MS = 60000;

async function handleProcessPendingWords(_req: Request) {
  // Service Role Auth (Cron)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    return errorResponse("Server config error", 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Generate unique instance ID for this function execution
  const instanceId = `edge-function-${Date.now()}-${
    Math.random().toString(36).substring(2, 9)
  }`;

  const startTime = Date.now();
  let processedCount = 0;
  let failedCount = 0;
  let totalClaimed = 0;

  logger.info("Starting continuous word processing", { instanceId });

  // Continuous loop until timeout or no more pending words
  while (true) {
    // Check timeout before claiming next word
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs > MAX_EXECUTION_TIME_MS) {
      logger.info("Timeout reached, stopping processing", {
        instanceId,
        elapsedMs,
        processed: processedCount,
        failed: failedCount,
      });
      break;
    }

    // Atomically claim 1 pending word using database function
    // FOR UPDATE SKIP LOCKED ensures concurrent handlers won't get the same word
    const { data: words, error: wordsError } = await supabaseAdmin.rpc(
      "claim_pending_vocabulary_words",
      {
        batch_size: 1,
        instance_id: instanceId,
      },
    );

    if (wordsError) {
      logger.error("Failed to claim pending words", {}, wordsError as Error);
      break;
    }

    // No more pending words
    if (!words || words.length === 0) {
      logger.info("No more pending words, stopping", {
        instanceId,
        processed: processedCount,
        failed: failedCount,
      });
      break;
    }

    const wordRecord = words[0];
    totalClaimed++;

    try {
      const { data: bookWord } = await supabaseAdmin
        .from("vocabulary_book_words")
        .select("book_id, vocabulary_books!inner(id, user_id)")
        .eq("word_id", wordRecord.id)
        .limit(1)
        .single();

      if (!bookWord || !bookWord.vocabulary_books) {
        logger.warn("No book/user found for word - marking as failed", {
          wordId: wordRecord.id,
        });
        // Mark as failed if no book/user found
        await supabaseAdmin
          .from("vocabulary_words")
          .update({
            import_status: "failed",
            error_msg: "No book or user found for word",
            locked_by: null,
          })
          .eq("id", wordRecord.id);
        failedCount++;
        continue;
      }

      const userId = (bookWord.vocabulary_books as { user_id: string }).user_id;

      const { wordData, wordAudioPath, exampleAudioPaths } = await enrichWord(
        wordRecord.word,
        wordRecord.id,
        userId,
        supabaseAdmin,
      );

      // Merge audio urls into examples
      const examplesWithAudio = wordData.examples.map((ex: ExampleSentence) => {
        const audio = exampleAudioPaths?.find((
          a: { sentence: string; audio_path: string },
        ) => a.sentence === ex.sentence);
        return {
          ...ex,
          audio_path: audio?.audio_path || "",
        };
      });

      // Call RPC to update word details transactionally
      const { error: updateError } = await supabaseAdmin.rpc(
        "update_word_details",
        {
          p_word_id: wordRecord.id,
          p_phonetic: wordData.meta.phonetic,
          p_audio_path: wordAudioPath,
          p_meta: wordData.meta,
          p_forms: wordData.forms,
          p_definitions: wordData.definitions,
          p_examples: examplesWithAudio,
          p_confused_words: wordData.confused_words,
        },
      );

      if (updateError) throw updateError;

      // Update book status if needed
      const { data: importingBooks } = await supabaseAdmin
        .from("vocabulary_book_words")
        .select("book_id, vocabulary_books!inner(id, import_status)")
        .eq("word_id", wordRecord.id)
        .eq("vocabulary_books.import_status", "importing");

      if (importingBooks) {
        for (const b of importingBooks) {
          const book = b.vocabulary_books as {
            id: string;
            import_status: string;
          };
          const { count } = await supabaseAdmin
            .from("vocabulary_book_words")
            .select("word_id, vocabulary_words!inner(import_status)", {
              count: "exact",
              head: true,
            })
            .eq("book_id", book.id)
            .neq("vocabulary_words.import_status", "done");

          if (count === 0) {
            await supabaseAdmin.from("vocabulary_books").update({
              import_status: "done",
            }).eq("id", book.id);
          }
        }
      }

      processedCount++;
      logger.info("Word processed successfully", {
        wordId: wordRecord.id,
        word: wordRecord.word,
        instanceId,
        elapsedMs: Date.now() - startTime,
      });
    } catch (error) {
      logger.error("Failed to process word", {
        wordId: wordRecord.id,
        instanceId,
      }, error as Error);
      // Mark as failed on error
      try {
        await supabaseAdmin
          .from("vocabulary_words")
          .update({
            import_status: "failed",
            error_msg: error instanceof Error
              ? error.message
              : "Unknown error",
            locked_by: null,
          })
          .eq("id", wordRecord.id);
      } catch (updateError) {
        logger.error(
          "Failed to mark word as failed",
          { wordId: wordRecord.id },
          updateError as Error,
        );
      }
      failedCount++;
    }
  }

  const totalElapsedMs = Date.now() - startTime;
  logger.info("Processing session completed", {
    instanceId,
    processed: processedCount,
    failed: failedCount,
    totalClaimed,
    totalElapsedMs,
  });

  return successResponse({
    processed: processedCount,
    failed: failedCount,
    total: totalClaimed,
    instanceId,
    elapsedMs: totalElapsedMs,
  });
}

// Helper functions for Process
/**
 * Converts PCM audio data (24kHz, mono, 16-bit) to WAV format
 */
function pcmToWav(
  pcmData: Uint8Array,
  sampleRate: number = 24000,
  channels: number = 1,
  bitsPerSample: number = 16,
): Uint8Array {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  // RIFF header
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'
  view.setUint32(4, fileSize, true);
  view.setUint8(8, 0x57); // 'W'
  view.setUint8(9, 0x41); // 'A'
  view.setUint8(10, 0x56); // 'V'
  view.setUint8(11, 0x45); // 'E'

  // fmt chunk
  view.setUint8(12, 0x66); // 'f'
  view.setUint8(13, 0x6D); // 'm'
  view.setUint8(14, 0x74); // 't'
  view.setUint8(15, 0x20); // ' '
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  view.setUint8(36, 0x64); // 'd'
  view.setUint8(37, 0x61); // 'a'
  view.setUint8(38, 0x74); // 't'
  view.setUint8(39, 0x61); // 'a'
  view.setUint32(40, dataSize, true);

  // Combine header and PCM data
  const wavFile = new Uint8Array(44 + dataSize);
  wavFile.set(new Uint8Array(wavHeader), 0);
  wavFile.set(pcmData, 44);

  return wavFile;
}

/**
 * Generate audio using Gemini TTS API
 * Returns WAV audio as Uint8Array binary data
 */
async function generateAudio(
  text: string,
  apiKey: string,
  ttsModel: string,
  voice: string = DEFAULT_VOICE,
): Promise<Uint8Array> {
  const url = `${DEFAULT_BASE_URL}/models/${ttsModel}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("Gemini TTS API error", {
      status: response.status,
      error: errorText,
    });
    throw new Error(`Gemini TTS API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract audio data from response
  const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!inlineData || !inlineData.data) {
    throw new Error("No audio data in Gemini TTS response");
  }

  // Decode base64 PCM data
  const pcmBase64 = inlineData.data;
  const binaryString = atob(pcmBase64);
  const pcmBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pcmBytes[i] = binaryString.charCodeAt(i);
  }

  // Convert PCM to WAV and return binary data
  return pcmToWav(pcmBytes);
}

/**
 * Upload audio file to Supabase Storage
 * Returns relative path of the uploaded file (not full URL)
 */
async function uploadAudioToStorage(
  audioData: Uint8Array,
  filePath: string,
  supabaseAdmin: SupabaseClient,
): Promise<string> {
  const BUCKET_NAME = "vocabulary-audio";

  // Ensure bucket exists (idempotent)
  const { data: buckets, error: listError } = await supabaseAdmin.storage
    .listBuckets();
  if (listError) {
    logger.error("Failed to list buckets", {}, listError as Error);
    throw new Error("Failed to access storage");
  }

  const bucketExists = buckets?.some((b: { name: string }) =>
    b.name === BUCKET_NAME
  );
  if (!bucketExists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(
      BUCKET_NAME,
      {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ["audio/wav", "audio/wave"],
      },
    );
    if (createError) {
      logger.error("Failed to create bucket", {}, createError as Error);
      throw new Error("Failed to create storage bucket");
    }
    logger.info("Created storage bucket", { bucket: BUCKET_NAME });
  }

  // Upload file
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(filePath, audioData, {
      contentType: "audio/wav",
      upsert: true, // Overwrite if exists
    });

  if (uploadError) {
    logger.error("Failed to upload audio", { filePath }, uploadError as Error);
    throw new Error(`Failed to upload audio: ${uploadError.message}`);
  }

  // Return the relative path (frontend will generate full URL)
  logger.info("Audio uploaded successfully", { filePath });
  return filePath;
}

async function enrichWord(
  word: string,
  wordId: string,
  userId: string,
  supabaseAdmin: SupabaseClient,
): Promise<
  {
    wordData: WordAnalysisResult;
    wordAudioPath: string | null;
    exampleAudioPaths: { sentence: string; audio_path: string }[] | null;
  }
> {
  try {
    // API Key must be configured in Supabase environment variables
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error(
        "GEMINI_API_KEY not configured in Supabase environment variables",
      );
    }

    // Get user's model configuration, fallback to defaults if not found
    const { data: userSettings, error: settingsError } = await supabaseAdmin
      .from("user_settings")
      .select("gemini_model_config")
      .eq("user_id", userId)
      .single();

    if (settingsError && settingsError.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine (use defaults)
      logger.warn("Failed to fetch user settings", { userId, error: settingsError.message });
    }

    const textModelConfig = userSettings?.gemini_model_config?.textModel ||
      DEFAULT_GEMINI_TEXT_MODEL_CONFIG;
    const ttsModelConfig = userSettings?.gemini_model_config?.ttsModel ||
      DEFAULT_GEMINI_TTS_MODEL_CONFIG;
    const model = textModelConfig.model;
    const ttsModel = ttsModelConfig.model;

  const prompt = `
      Role: Expert IELTS vocabulary tutor with access to authentic IELTS exam materials.
      Task: Analyze the English word "${word}" for a student targeting IELTS Band 7+.

      Requirements:
      1. Target Language for translations: Chinese (Simplified).
      2. Provide IPA phonetic transcription (UK preference).
      3. Focus on Academic/General Training definitions suitable for IELTS.
      4. **Example Sentence Constraint**: 
         - Only use example sentences from authentic IELTS exam sources, including:
           • Cambridge IELTS Official Practice Tests (Books 1-20)
           • IELTS Reading passages (Academic & General Training)
           • IELTS Listening transcripts
           • Official British Council / IDP IELTS materials
         - Cite the source for each example (e.g., "Cambridge IELTS 15, Reading Test 3").
         - If no authentic IELTS example is available for this word, explicitly state: "No authentic IELTS example found" and provide a sentence modeled on IELTS style instead (clearly marked as "IELTS-style example").
      4. Each example must be a single sentence (may contain commas, but not excessively long).
      5. If the word serves multiple parts of speech, provide the 3 most common ones.
  `;

  const url = `${DEFAULT_BASE_URL}/models/${model}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": geminiApiKey,
    },
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

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content && data.candidates?.[0]?.finishReason) {
    throw new Error(
      `Gemini blocked content: ${data.candidates[0].finishReason}`,
    );
  }
  if (!content) throw new Error("No content from Gemini");

  let wordData: WordAnalysisResult;
  try {
    // Defensive cleanup: remove markdown code block wrappers if present
    // (shouldn't happen with responseMimeType: "application/json", but can occur occasionally)
    let cleanContent = content;
    if (content.startsWith("```") || content.includes("```json")) {
      cleanContent = content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
    }
    wordData = JSON.parse(cleanContent);
  } catch (parseError) {
    // Log detailed error information for debugging
    logger.error("JSON Parse Error", {
      error: (parseError as Error).message,
      contentPreview: content?.substring(0, 500),
      contentLength: content?.length,
      word,
    });
    throw new Error(
      `Failed to parse Gemini response: ${(parseError as Error).message}`,
    );
  }

  // Validate required fields in the parsed response
  if (
    !wordData.meta ||
    !wordData.definitions ||
    !Array.isArray(wordData.definitions)
  ) {
    logger.error("Invalid Gemini response structure", {
      hasMeta: !!wordData.meta,
      hasDefinitions: !!wordData.definitions,
      word,
    });
    throw new Error("Gemini response missing required fields");
  }

  // Generate and upload audio files to Storage
  let wordAudioPath: string | null = null;
  let exampleAudioPaths: { sentence: string; audio_path: string }[] | null =
    null;
  try {
    // Generate word audio with professional American English pronunciation
    const wordAudioData = await generateAudio(
      `Say in a professional American accent, loud and clear: "${word}"`,
      geminiApiKey,
      ttsModel,
      "Zephyr",
    );
    const wordStoragePath = `${userId}/${wordId}/word.wav`;
    wordAudioPath = await uploadAudioToStorage(
      wordAudioData,
      wordStoragePath,
      supabaseAdmin,
    );

    // Generate example sentence audios (serially to avoid rate limits)
    if (wordData.examples && wordData.examples.length > 0) {
      exampleAudioPaths = [];
      for (const [index, ex] of wordData.examples.entries()) {
        try {
          const randomVoice =
            GEMINI_VOICES[Math.floor(Math.random() * GEMINI_VOICES.length)];
          // Randomly choose American or British accent for IELTS listening exam simulation
          const accent = Math.random() < 0.5 ? "American" : "British";
          const exampleAudioData = await generateAudio(
            `Say in a professional ${accent} accent, loud and clear like IELTS listening: "${ex.sentence}"`,
            geminiApiKey,
            ttsModel,
            randomVoice,
          );
          const exampleStoragePath =
            `${userId}/${wordId}/example-${index}.wav`;
          const audioPath = await uploadAudioToStorage(
            exampleAudioData,
            exampleStoragePath,
            supabaseAdmin,
          );
          exampleAudioPaths.push({ sentence: ex.sentence, audio_path: audioPath });
        } catch (error) {
          logger.warn("Failed to generate/upload example audio", {
            index,
            sentence: ex.sentence,
          }, error as Error);
          exampleAudioPaths.push({ sentence: ex.sentence, audio_path: "" });
        }
      }
    }
  } catch (e) {
    logger.warn("Audio generation/upload failed", { wordId }, e as Error);
  }

    return { wordData, wordAudioPath, exampleAudioPaths };
  } catch (error) {
    // Log the error with context
    logger.error("enrichWord failed", {
      word,
      wordId,
      userId,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }, error as Error);

    // Rethrow with structured error information for the caller
    throw new Error(
      `Failed to enrich word "${word}": ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
