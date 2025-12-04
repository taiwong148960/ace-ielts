-- ============================================
-- Add import tracking to vocabulary_books table
-- Tracks import progress for vocabulary book enrichment
-- ============================================

-- Ensure import_status_enum exists
DO $$ BEGIN
  CREATE TYPE import_status_enum AS ENUM ('pending', 'importing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add import_status column
ALTER TABLE "public"."vocabulary_books"
ADD COLUMN IF NOT EXISTS "import_status" import_status_enum DEFAULT 'pending';

-- Add import_progress (current word index)
ALTER TABLE "public"."vocabulary_books"
ADD COLUMN IF NOT EXISTS "import_progress" INTEGER DEFAULT 0;

-- Add import_total (total words to import)
ALTER TABLE "public"."vocabulary_books"
ADD COLUMN IF NOT EXISTS "import_total" INTEGER DEFAULT 0;

-- Add import_started_at timestamp
ALTER TABLE "public"."vocabulary_books"
ADD COLUMN IF NOT EXISTS "import_started_at" TIMESTAMPTZ;

-- Add import_completed_at timestamp
ALTER TABLE "public"."vocabulary_books"
ADD COLUMN IF NOT EXISTS "import_completed_at" TIMESTAMPTZ;

-- Create index on import_status for filtering
CREATE INDEX IF NOT EXISTS "idx_vocabulary_books_import_status" 
ON "public"."vocabulary_books" ("import_status");

