-- ============================================
-- Add audio URLs to vocabulary_words table
-- Stores audio URLs for word pronunciation and example sentences
-- ============================================

-- Add word_audio_url column for word pronunciation audio
ALTER TABLE "public"."vocabulary_words"
ADD COLUMN IF NOT EXISTS "word_audio_url" TEXT;

-- Add example_audio_urls JSONB column to store audio URLs for example sentences
-- Structure: [{"sentence": "example sentence", "audio_url": "https://..."}, ...]
ALTER TABLE "public"."vocabulary_words"
ADD COLUMN IF NOT EXISTS "example_audio_urls" JSONB;

-- Create index on example_audio_urls for JSONB queries (optional, for performance)
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_example_audio_urls" 
ON "public"."vocabulary_words" USING GIN ("example_audio_urls");

