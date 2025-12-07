-- ============================================
-- Add Gemini Model Configuration to User Settings
-- Stores user's preferred Gemini text and TTS model configurations
-- ============================================

-- Add JSONB column for Gemini model configurations
ALTER TABLE "public"."user_settings"
ADD COLUMN IF NOT EXISTS "gemini_model_config" JSONB DEFAULT NULL;

-- Add comment to explain the structure
COMMENT ON COLUMN "public"."user_settings"."gemini_model_config" IS 
'JSONB object storing Gemini model configurations:
{
  "textModel": {
    "model": "gemini-3-pro-preview",
    "temperature": 0.7,
    "topK": 40,
    "topP": 0.95,
    "maxOutputTokens": 2048
  },
  "ttsModel": {
    "model": "gemini-2.5-flash-preview-tts"
  }
}';

-- Create index for JSONB queries (optional, for performance)
CREATE INDEX IF NOT EXISTS "idx_user_settings_gemini_model_config" 
ON "public"."user_settings" USING GIN ("gemini_model_config");
