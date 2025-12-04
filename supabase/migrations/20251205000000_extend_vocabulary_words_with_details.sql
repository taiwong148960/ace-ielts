-- ============================================
-- Extend vocabulary_words table with rich word data
-- Adds word_details JSONB and import tracking
-- ============================================

-- Add word_details JSONB column to store rich word data from Gemini API
ALTER TABLE "public"."vocabulary_words"
ADD COLUMN IF NOT EXISTS "word_details" JSONB;

-- Add import_status enum type if not exists
DO $$ BEGIN
  CREATE TYPE import_status_enum AS ENUM ('pending', 'importing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add import_status column
ALTER TABLE "public"."vocabulary_words"
ADD COLUMN IF NOT EXISTS "import_status" import_status_enum DEFAULT 'pending';

-- Add import_error column for error messages
ALTER TABLE "public"."vocabulary_words"
ADD COLUMN IF NOT EXISTS "import_error" TEXT;

-- Create index on word_details for JSONB queries (optional, for performance)
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_word_details" 
ON "public"."vocabulary_words" USING GIN ("word_details");

-- Create index on import_status for filtering
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_import_status" 
ON "public"."vocabulary_words" ("import_status");

