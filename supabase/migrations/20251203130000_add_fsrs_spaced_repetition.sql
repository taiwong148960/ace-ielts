-- ============================================
-- FSRS (Free Spaced Repetition Scheduler) Migration
-- Upgrades the spaced repetition system to FSRS-4.5
-- ============================================

-- ============================================
-- 1. Alter user_word_progress table for FSRS
-- ============================================

-- Drop old constraint
ALTER TABLE "public"."user_word_progress" DROP CONSTRAINT IF EXISTS "user_word_progress_mastery_level_check";

-- Add new FSRS columns
ALTER TABLE "public"."user_word_progress"
ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT 'new',
ADD COLUMN IF NOT EXISTS "difficulty" FLOAT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "stability" FLOAT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "retrievability" FLOAT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "elapsed_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "scheduled_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "reps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lapses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "learning_step" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "is_learning_phase" BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS "total_reviews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "correct_reviews" INTEGER NOT NULL DEFAULT 0;

-- Rename old columns (keep for migration, can drop later)
ALTER TABLE "public"."user_word_progress" 
RENAME COLUMN "last_reviewed_at" TO "last_review_at";

-- Add constraint for state
ALTER TABLE "public"."user_word_progress"
ADD CONSTRAINT "user_word_progress_state_check" 
CHECK (state IN ('new', 'learning', 'review', 'relearning'));

-- Migrate existing data from old fields to new FSRS fields
UPDATE "public"."user_word_progress"
SET 
  state = CASE 
    WHEN mastery_level = 'new' THEN 'new'
    WHEN mastery_level = 'learning' THEN 'learning'
    WHEN mastery_level = 'reviewing' THEN 'review'
    WHEN mastery_level = 'mastered' THEN 'review'
    ELSE 'new'
  END,
  stability = CASE 
    WHEN mastery_level = 'mastered' THEN GREATEST(interval_days * 1.0, 21)
    WHEN mastery_level = 'reviewing' THEN GREATEST(interval_days * 0.7, 7)
    WHEN mastery_level = 'learning' THEN 3
    ELSE 0
  END,
  difficulty = CASE
    WHEN ease_factor IS NOT NULL THEN (2.5 - ease_factor + 2.5) * 2  -- Convert from SM-2 to FSRS
    ELSE 5
  END,
  reps = review_count,
  total_reviews = review_count,
  correct_reviews = correct_count,
  is_learning_phase = CASE
    WHEN mastery_level IN ('new', 'learning') THEN TRUE
    ELSE FALSE
  END,
  due_at = COALESCE(next_review_at, NOW()),
  scheduled_days = COALESCE(interval_days, 0)
WHERE state = 'new' AND mastery_level IS NOT NULL AND mastery_level != 'new';

-- Create new indexes for FSRS queries
CREATE INDEX IF NOT EXISTS "idx_uwp_due_at" ON "public"."user_word_progress" ("user_id", "due_at");
CREATE INDEX IF NOT EXISTS "idx_uwp_state" ON "public"."user_word_progress" ("user_id", "book_id", "state");
CREATE INDEX IF NOT EXISTS "idx_uwp_learning_phase" ON "public"."user_word_progress" ("user_id", "book_id", "is_learning_phase");

-- ============================================
-- 2. Alter user_book_progress table
-- ============================================

ALTER TABLE "public"."user_book_progress"
ADD COLUMN IF NOT EXISTS "total_reviews" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "reviews_today" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "new_words_today" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "last_review_date" DATE,
ADD COLUMN IF NOT EXISTS "daily_new_limit" INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS "daily_review_limit" INTEGER DEFAULT 100;

-- ============================================
-- 3. Create review_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS "public"."review_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "word_id" UUID NOT NULL REFERENCES vocabulary_words(id) ON DELETE CASCADE,
  "book_id" UUID NOT NULL REFERENCES vocabulary_books(id) ON DELETE CASCADE,
  "progress_id" UUID NOT NULL REFERENCES user_word_progress(id) ON DELETE CASCADE,
  
  -- Review Details
  "rating" INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 4),
  "state_before" TEXT NOT NULL,
  "state_after" TEXT NOT NULL,
  
  -- FSRS Metrics at review time
  "difficulty_before" FLOAT NOT NULL,
  "stability_before" FLOAT NOT NULL,
  "difficulty_after" FLOAT NOT NULL,
  "stability_after" FLOAT NOT NULL,
  
  -- Scheduling info
  "scheduled_days" INTEGER NOT NULL,
  "elapsed_days" INTEGER NOT NULL,
  
  -- Timing
  "review_time_ms" INTEGER,
  "reviewed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for review_logs
CREATE INDEX IF NOT EXISTS "idx_rl_user_book" ON "public"."review_logs" ("user_id", "book_id");
CREATE INDEX IF NOT EXISTS "idx_rl_reviewed_at" ON "public"."review_logs" ("reviewed_at");
CREATE INDEX IF NOT EXISTS "idx_rl_progress" ON "public"."review_logs" ("progress_id");

-- ============================================
-- 4. Create helper function for updating book stats
-- ============================================

CREATE OR REPLACE FUNCTION "public"."update_book_progress_stats"()
RETURNS TRIGGER AS $$
BEGIN
  -- Update aggregated stats in user_book_progress
  WITH stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE state = 'review' AND stability > 21) as mastered,
      COUNT(*) FILTER (WHERE state IN ('learning', 'relearning') OR (state = 'review' AND stability <= 21)) as learning,
      COUNT(*) FILTER (WHERE state = 'new') as new_words
    FROM user_word_progress
    WHERE user_id = NEW.user_id AND book_id = NEW.book_id
  )
  UPDATE user_book_progress
  SET 
    mastered_count = COALESCE(stats.mastered, 0),
    learning_count = COALESCE(stats.learning, 0),
    new_count = COALESCE(stats.new_words, 0),
    updated_at = NOW()
  FROM stats
  WHERE user_book_progress.user_id = NEW.user_id 
    AND user_book_progress.book_id = NEW.book_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update stats
DROP TRIGGER IF EXISTS "trg_update_book_stats" ON "public"."user_word_progress";
CREATE TRIGGER "trg_update_book_stats"
AFTER INSERT OR UPDATE ON "public"."user_word_progress"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_book_progress_stats"();

-- ============================================
-- 5. Create function to get due cards with fuzz
-- ============================================

CREATE OR REPLACE FUNCTION "public"."get_due_cards_with_fuzz"(
  p_user_id UUID,
  p_book_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  word_id UUID,
  state TEXT,
  due_at TIMESTAMPTZ,
  is_learning_phase BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uwp.id,
    uwp.word_id,
    uwp.state,
    uwp.due_at,
    uwp.is_learning_phase
  FROM user_word_progress uwp
  WHERE uwp.user_id = p_user_id
    AND uwp.book_id = p_book_id
    AND uwp.due_at <= NOW()
  ORDER BY 
    -- Prioritize learning phase cards, then by due time with small random fuzz
    uwp.is_learning_phase DESC,
    uwp.due_at + (random() * interval '5 minutes')
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 6. RLS Policies for review_logs
-- ============================================

ALTER TABLE "public"."review_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own review logs" ON "public"."review_logs"
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own review logs" ON "public"."review_logs"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 7. Grant permissions
-- ============================================

GRANT ALL ON TABLE "public"."review_logs" TO "anon";
GRANT ALL ON TABLE "public"."review_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."review_logs" TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_book_progress_stats"() TO "anon";
GRANT EXECUTE ON FUNCTION "public"."update_book_progress_stats"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."update_book_progress_stats"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_due_cards_with_fuzz"(UUID, UUID, INTEGER) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."get_due_cards_with_fuzz"(UUID, UUID, INTEGER) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_due_cards_with_fuzz"(UUID, UUID, INTEGER) TO "service_role";







