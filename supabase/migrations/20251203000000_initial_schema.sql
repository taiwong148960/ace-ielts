-- ============================================
-- 1. Extensions Setup
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- Try to enable optional extensions gracefully
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions";
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_cron could not be installed'; END $$;

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_net could not be installed'; END $$;

-- ============================================
-- 2. Enum Types
-- ============================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_status_enum') THEN
        CREATE TYPE public.import_status_enum AS ENUM ('pending', 'importing', 'completed', 'failed');
    END IF;
END $$;

-- ============================================
-- 3. Helper Functions (Generic)
-- ============================================
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================
-- 4. Tables Definition
-- ============================================

-- 4.1 Vocabulary Books
CREATE TABLE IF NOT EXISTS "public"."vocabulary_books" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "cover_color" VARCHAR(100) DEFAULT 'bg-gradient-to-br from-amber-500 to-orange-600',
    "cover_text" VARCHAR(100),
    "book_type" VARCHAR(20) DEFAULT 'custom' CHECK (book_type IN ('ielts', 'academic', 'business', 'custom')),
    "is_system_book" BOOLEAN DEFAULT false,
    "user_id" UUID REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "word_count" INTEGER DEFAULT 0,
    "import_status" public.import_status_enum DEFAULT 'pending',
    "import_progress" INTEGER DEFAULT 0,
    "import_total" INTEGER DEFAULT 0,
    "import_started_at" TIMESTAMPTZ,
    "import_completed_at" TIMESTAMPTZ,
    "import_error" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 4.2 Vocabulary Words
CREATE TABLE IF NOT EXISTS "public"."vocabulary_words" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "book_id" UUID NOT NULL REFERENCES "public"."vocabulary_books"("id") ON DELETE CASCADE,
    "word" VARCHAR(200) NOT NULL,
    "phonetic" VARCHAR(200),
    "definition" TEXT,
    "example_sentence" TEXT,
    "notes" TEXT,
    "word_details" JSONB,
    "import_status" public.import_status_enum DEFAULT 'pending',
    "import_error" TEXT,
    "word_audio_url" TEXT,
    "example_audio_urls" JSONB,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 4.3 User Book Progress
CREATE TABLE IF NOT EXISTS "public"."user_book_progress" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "book_id" UUID NOT NULL REFERENCES "public"."vocabulary_books"("id") ON DELETE CASCADE,
    "mastered_count" INTEGER DEFAULT 0,
    "learning_count" INTEGER DEFAULT 0,
    "new_count" INTEGER DEFAULT 0,
    "last_studied_at" TIMESTAMPTZ,
    "streak_days" INTEGER DEFAULT 0,
    "accuracy_percent" NUMERIC(5,2) DEFAULT 0,
    "total_reviews" INTEGER DEFAULT 0,
    "reviews_today" INTEGER DEFAULT 0,
    "new_words_today" INTEGER DEFAULT 0,
    "last_review_date" DATE,
    "daily_new_limit" INTEGER DEFAULT 20,
    "daily_review_limit" INTEGER DEFAULT 100,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "user_book_progress_user_id_book_id_key" UNIQUE ("user_id", "book_id")
);

-- 4.4 User Word Progress (FSRS)
CREATE TABLE IF NOT EXISTS "public"."user_word_progress" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "word_id" UUID NOT NULL REFERENCES "public"."vocabulary_words"("id") ON DELETE CASCADE,
    "book_id" UUID NOT NULL REFERENCES "public"."vocabulary_books"("id") ON DELETE CASCADE,
    -- Legacy / Compatibility columns
    "mastery_level" VARCHAR(20) DEFAULT 'new' CHECK (mastery_level IN ('new', 'learning', 'reviewing', 'mastered')),
    "review_count" INTEGER DEFAULT 0,
    "correct_count" INTEGER DEFAULT 0,
    "last_review_at" TIMESTAMPTZ,
    "next_review_at" TIMESTAMPTZ,
    "ease_factor" NUMERIC(4,2) DEFAULT 2.5,
    "interval_days" INTEGER DEFAULT 0,
    -- FSRS specific columns
    "state" TEXT NOT NULL DEFAULT 'new' CHECK (state IN ('new', 'learning', 'review', 'relearning')),
    "difficulty" FLOAT NOT NULL DEFAULT 0,
    "stability" FLOAT NOT NULL DEFAULT 0,
    "retrievability" FLOAT NOT NULL DEFAULT 1,
    "elapsed_days" INTEGER NOT NULL DEFAULT 0,
    "scheduled_days" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "learning_step" INTEGER NOT NULL DEFAULT 0,
    "is_learning_phase" BOOLEAN NOT NULL DEFAULT TRUE,
    "due_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "correct_reviews" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "user_word_progress_user_id_word_id_key" UNIQUE ("user_id", "word_id")
);

-- 4.5 Settings Tables
CREATE TABLE IF NOT EXISTS "public"."book_settings" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "book_id" UUID NOT NULL REFERENCES "public"."vocabulary_books"("id") ON DELETE CASCADE,
    "daily_new_limit" INTEGER NOT NULL DEFAULT 20,
    "daily_review_limit" INTEGER NOT NULL DEFAULT 60,
    "learning_mode" TEXT NOT NULL DEFAULT 'read_only' CHECK (learning_mode IN ('read_only', 'spelling')),
    "study_order" TEXT NOT NULL DEFAULT 'sequential' CHECK (study_order IN ('sequential', 'random')),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "book_settings_user_book_key" UNIQUE ("user_id", "book_id")
);

CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "llm_api_key_encrypted" TEXT,
    "llm_provider" TEXT DEFAULT 'gemini' CHECK (llm_provider IN ('gemini', 'openai', 'anthropic', 'custom')),
    "gemini_model_config" JSONB DEFAULT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id")
);

CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" TEXT PRIMARY KEY,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 4.6 Review Logs
CREATE TABLE IF NOT EXISTS "public"."review_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "word_id" UUID NOT NULL REFERENCES "public"."vocabulary_words"("id") ON DELETE CASCADE,
    "book_id" UUID NOT NULL REFERENCES "public"."vocabulary_books"("id") ON DELETE CASCADE,
    "progress_id" UUID NOT NULL REFERENCES "public"."user_word_progress"("id") ON DELETE CASCADE,
    "rating" INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 4),
    "state_before" TEXT NOT NULL,
    "state_after" TEXT NOT NULL,
    "difficulty_before" FLOAT NOT NULL,
    "stability_before" FLOAT NOT NULL,
    "difficulty_after" FLOAT NOT NULL,
    "stability_after" FLOAT NOT NULL,
    "scheduled_days" INTEGER NOT NULL,
    "elapsed_days" INTEGER NOT NULL,
    "review_time_ms" INTEGER,
    "reviewed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5. Indexes (Optimized)
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_vocab_books_user" ON "public"."vocabulary_books" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_vocab_books_sys" ON "public"."vocabulary_books" ("is_system_book");

CREATE INDEX IF NOT EXISTS "idx_vocab_words_book" ON "public"."vocabulary_words" ("book_id");
CREATE INDEX IF NOT EXISTS "idx_vocab_words_details" ON "public"."vocabulary_words" USING GIN ("word_details");

CREATE INDEX IF NOT EXISTS "idx_ubp_user_book" ON "public"."user_book_progress" ("user_id", "book_id");

-- Critical Index for FSRS Queries
CREATE INDEX IF NOT EXISTS "idx_uwp_user_book_state" ON "public"."user_word_progress" ("user_id", "book_id", "state");
CREATE INDEX IF NOT EXISTS "idx_uwp_due_query" ON "public"."user_word_progress" ("user_id", "book_id", "due_at");

CREATE INDEX IF NOT EXISTS "idx_review_logs_user" ON "public"."review_logs" ("user_id");

-- ============================================
-- 6. Row Level Security (RLS) - FIXED
-- ============================================

-- Enable RLS on all tables
ALTER TABLE "public"."vocabulary_books" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vocabulary_words" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_book_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_word_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."book_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."review_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;

-- 6.1 Vocabulary Books Policies
CREATE POLICY "Public read access for system books" ON "public"."vocabulary_books"
    FOR SELECT USING (is_system_book = true);

CREATE POLICY "Users can manage own books" ON "public"."vocabulary_books"
    USING (auth.uid() = user_id); -- Covers Select, Insert, Update, Delete

-- 6.2 Vocabulary Words Policies
-- Note: Simplified to avoid complex nested EXISTS calls where possible
CREATE POLICY "Read system words" ON "public"."vocabulary_words"
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM "public"."vocabulary_books" vb WHERE vb.id = book_id AND vb.is_system_book = true)
    );

CREATE POLICY "Manage own book words" ON "public"."vocabulary_words"
    USING (
        EXISTS (SELECT 1 FROM "public"."vocabulary_books" vb WHERE vb.id = book_id AND vb.user_id = auth.uid())
    );

-- 6.3 User Progress & Settings (Simple Ownership)
CREATE POLICY "Manage own book progress" ON "public"."user_book_progress" USING (auth.uid() = user_id);
CREATE POLICY "Manage own word progress" ON "public"."user_word_progress" USING (auth.uid() = user_id);
CREATE POLICY "Manage own book settings" ON "public"."book_settings" USING (auth.uid() = user_id);
CREATE POLICY "Manage own user settings" ON "public"."user_settings" USING (auth.uid() = user_id);
CREATE POLICY "Manage own review logs" ON "public"."review_logs" USING (auth.uid() = user_id);

-- 6.4 App Settings (SECURITY CRITICAL FIX)
-- Only service_role can read/write app_settings (contains API keys)
-- Regular users (anon/authenticated) get NO ACCESS.
CREATE POLICY "Service role full access" ON "public"."app_settings"
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 7. Logic Functions & Triggers
-- ============================================

-- 7.1 Auto-update updated_at
CREATE TRIGGER "update_vocabulary_books_timestamp" BEFORE UPDATE ON "public"."vocabulary_books" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE TRIGGER "update_vocabulary_words_timestamp" BEFORE UPDATE ON "public"."vocabulary_words" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE TRIGGER "update_user_book_progress_timestamp" BEFORE UPDATE ON "public"."user_book_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE TRIGGER "update_user_word_progress_timestamp" BEFORE UPDATE ON "public"."user_word_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE TRIGGER "update_book_settings_timestamp" BEFORE UPDATE ON "public"."book_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE TRIGGER "update_user_settings_timestamp" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE TRIGGER "update_app_settings_timestamp" BEFORE UPDATE ON "public"."app_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- 7.2 Efficient Book Stats Update (Refactored)
CREATE OR REPLACE FUNCTION "public"."update_book_progress_stats"()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_mastered INT;
    v_learning INT;
    v_new INT;
BEGIN
    -- Perform a single aggregate query instead of 3 separate COUNT(*)
    SELECT
        COUNT(*) FILTER (WHERE state = 'review' AND stability > 21),
        COUNT(*) FILTER (WHERE state IN ('learning', 'relearning') OR (state = 'review' AND stability <= 21)),
        COUNT(*) FILTER (WHERE state = 'new')
    INTO v_mastered, v_learning, v_new
    FROM user_word_progress
    WHERE user_id = NEW.user_id AND book_id = NEW.book_id;

    -- Upsert the stats
    INSERT INTO user_book_progress (user_id, book_id, mastered_count, learning_count, new_count, updated_at)
    VALUES (NEW.user_id, NEW.book_id, v_mastered, v_learning, v_new, NOW())
    ON CONFLICT (user_id, book_id)
    DO UPDATE SET
        mastered_count = EXCLUDED.mastered_count,
        learning_count = EXCLUDED.learning_count,
        new_count = EXCLUDED.new_count,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER "trg_update_book_stats"
    AFTER INSERT OR UPDATE OF state, stability ON "public"."user_word_progress"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_book_progress_stats"();

-- 7.3 Get Due Cards (FSRS Optimized)
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
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
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
        -- Prioritize learning phase, then shuffle slightly to prevent stuck cards
        uwp.is_learning_phase DESC,
        uwp.due_at + (random() * interval '5 minutes') ASC
    LIMIT p_limit;
END;
$$;

-- ============================================
-- 8. Background Jobs (pg_cron & pg_net)
-- ============================================

CREATE OR REPLACE FUNCTION "public"."process_pending_vocabulary_words"()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    supabase_url TEXT;
    service_role_key TEXT;
    function_url TEXT;
    request_id BIGINT;
BEGIN
    -- Check if pg_net exists to avoid runtime crash
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        RAISE WARNING 'pg_net extension not installed.';
        RETURN;
    END IF;

    -- Securely fetch credentials
    SELECT value INTO supabase_url FROM public.app_settings WHERE key = 'supabase_url';
    SELECT value INTO service_role_key FROM public.app_settings WHERE key = 'service_role_key';

    IF supabase_url IS NULL OR service_role_key IS NULL THEN
        RAISE WARNING 'Missing Supabase URL or Service Role Key in app_settings.';
        RETURN;
    END IF;

    function_url := supabase_url || '/functions/v1/vocabulary-process-pending-words';

    -- Call Edge Function
    SELECT net.http_post(
        url := function_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key
        ),
        body := '{}'::jsonb
    ) INTO request_id;
END;
$$;

-- Schedule Cron Job (Safe handling)
DO $$
BEGIN
    -- 检查 pg_cron 扩展是否安装
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- 先尝试取消旧任务，避免重复
        PERFORM cron.unschedule('process-pending-vocabulary-words');
        
        -- 重新调度任务
        PERFORM cron.schedule(
            'process-pending-vocabulary-words', -- 任务名称
            '*/1 * * * *',                      -- Cron 表达式 (每分钟)
            'SELECT public.process_pending_vocabulary_words()' -- 改为单引号
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- 捕获错误，防止因为 cron 权限问题导致整个脚本运行失败
    RAISE NOTICE 'Failed to schedule cron job: %', SQLERRM;
END $$;

-- ============================================
-- 9. Permissions
-- ============================================

GRANT USAGE ON SCHEMA "public" TO "anon", "authenticated", "service_role";

-- Default table access (Restricted by RLS)
GRANT ALL ON ALL TABLES IN SCHEMA "public" TO "authenticated", "service_role";

-- WARNING: Do not grant ALL to anon blindly.
-- Only grant access to specific functions or tables if absolutely necessary.
GRANT SELECT ON "public"."vocabulary_books" TO "anon"; -- Needed if you have public landing pages
GRANT SELECT ON "public"."vocabulary_words" TO "anon";

-- Function Permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "public" TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."get_due_cards_with_fuzz" TO "authenticated", "service_role";