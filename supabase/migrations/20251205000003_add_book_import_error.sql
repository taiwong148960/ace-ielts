-- ============================================
-- Add import_error column to vocabulary_books table
-- Stores error messages when import fails
-- ============================================

-- Add import_error column for error messages
ALTER TABLE "public"."vocabulary_books"
ADD COLUMN IF NOT EXISTS "import_error" TEXT;

