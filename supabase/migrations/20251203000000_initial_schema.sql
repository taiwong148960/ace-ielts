-- ============================================
-- 1. Extensions Setup
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions";
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'pg_cron could not be installed'; END $$;

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'pg_net could not be installed'; END $$;

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'supabase_vault could not be installed'; END $$;

-- ============================================
-- 2. Enum Types
-- ============================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_status_enum') THEN
        CREATE TYPE public.import_status_enum AS ENUM ('pending', 'importing', 'done', 'failed');
    END IF;
END $$;

-- ============================================
-- 3. Helper Functions
-- ============================================
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================
-- 4. Tables Definition
-- ============================================

-- 4.1 Global Vocabulary Words (Shared across all books)
CREATE TABLE IF NOT EXISTS "public"."vocabulary_words" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "word" VARCHAR(200) NOT NULL UNIQUE,
    "phonetic" VARCHAR(200),
    "audio_path" TEXT,
    "meta" JSONB DEFAULT '{}',
    "forms" JSONB DEFAULT '{}',
    "definitions" JSONB DEFAULT '[]',
    "examples" JSONB DEFAULT '[]',
    "confused_words" JSONB DEFAULT '[]',
    "import_status" public.import_status_enum DEFAULT 'pending',
    "error_msg" TEXT,
    "locked_by" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 4.2 Vocabulary Books
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
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 4.3 Book-Word Junction Table (Links books to global words)
CREATE TABLE IF NOT EXISTS "public"."vocabulary_book_words" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "book_id" UUID NOT NULL REFERENCES "public"."vocabulary_books"("id") ON DELETE CASCADE,
    "word_id" UUID NOT NULL REFERENCES "public"."vocabulary_words"("id") ON DELETE CASCADE,
    "sort_order" INTEGER DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "vocabulary_book_words_book_word_unique" UNIQUE ("book_id", "word_id")
);

-- 4.4 User Book Progress
CREATE TABLE IF NOT EXISTS "public"."vocabulary_user_book_progress" (
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
    CONSTRAINT "vocabulary_user_book_progress_user_id_book_id_key" UNIQUE ("user_id", "book_id")
);

-- 4.5 User Word Progress (FSRS) - Per user per word per book
CREATE TABLE IF NOT EXISTS "public"."vocabulary_user_word_progress" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "word_id" UUID NOT NULL REFERENCES "public"."vocabulary_words"("id") ON DELETE CASCADE,
    "book_id" UUID NOT NULL REFERENCES "public"."vocabulary_books"("id") ON DELETE CASCADE,
    "mastery_level" VARCHAR(20) DEFAULT 'new' CHECK (mastery_level IN ('new', 'learning', 'reviewing', 'mastered')),
    "review_count" INTEGER DEFAULT 0,
    "correct_count" INTEGER DEFAULT 0,
    "last_review_at" TIMESTAMPTZ,
    "next_review_at" TIMESTAMPTZ,
    "ease_factor" NUMERIC(4,2) DEFAULT 2.5,
    "interval_days" INTEGER DEFAULT 0,
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
    CONSTRAINT "vocabulary_user_word_progress_user_word_book_key" UNIQUE ("user_id", "word_id", "book_id")
);

-- 4.6 Settings Tables
CREATE TABLE IF NOT EXISTS "public"."vocabulary_book_settings" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "book_id" UUID NOT NULL REFERENCES "public"."vocabulary_books"("id") ON DELETE CASCADE,
    "daily_new_limit" INTEGER NOT NULL DEFAULT 20,
    "daily_review_limit" INTEGER NOT NULL DEFAULT 60,
    "learning_mode" TEXT NOT NULL DEFAULT 'read_only' CHECK (learning_mode IN ('read_only', 'spelling')),
    "study_order" TEXT NOT NULL DEFAULT 'sequential' CHECK (study_order IN ('sequential', 'random')),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "vocabulary_book_settings_user_book_key" UNIQUE ("user_id", "book_id")
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
    "key" VARCHAR(100) PRIMARY KEY,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.7 Review Logs
CREATE TABLE IF NOT EXISTS "public"."vocabulary_review_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "word_id" UUID NOT NULL REFERENCES "public"."vocabulary_words"("id") ON DELETE CASCADE,
    "book_id" UUID NOT NULL REFERENCES "public"."vocabulary_books"("id") ON DELETE CASCADE,
    "progress_id" UUID NOT NULL REFERENCES "public"."vocabulary_user_word_progress"("id") ON DELETE CASCADE,
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
-- 5. Indexes
-- ============================================

-- Vocabulary Words (Global)
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_word" ON "public"."vocabulary_words" ("word");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_pending_by_created" ON "public"."vocabulary_words" ("created_at") WHERE import_status = 'pending';
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_importing_by_updated" ON "public"."vocabulary_words" ("updated_at") WHERE import_status = 'importing';
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_meta" ON "public"."vocabulary_words" USING GIN ("meta");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_forms" ON "public"."vocabulary_words" USING GIN ("forms");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_definitions" ON "public"."vocabulary_words" USING GIN ("definitions");

-- Vocabulary Books
CREATE INDEX IF NOT EXISTS "idx_vocabulary_books_user_id" ON "public"."vocabulary_books" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_books_is_system_book" ON "public"."vocabulary_books" ("is_system_book");

-- Book Words Junction
CREATE INDEX IF NOT EXISTS "idx_vocabulary_book_words_book_id" ON "public"."vocabulary_book_words" ("book_id");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_book_words_word_id" ON "public"."vocabulary_book_words" ("word_id");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_book_words_book_sort" ON "public"."vocabulary_book_words" ("book_id", "sort_order");

-- User Progress
CREATE INDEX IF NOT EXISTS "idx_vocabulary_user_book_progress_user_book" ON "public"."vocabulary_user_book_progress" ("user_id", "book_id");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_user_word_progress_user_book_state" ON "public"."vocabulary_user_word_progress" ("user_id", "book_id", "state");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_user_word_progress_due_query" ON "public"."vocabulary_user_word_progress" ("user_id", "book_id", "due_at");

-- Review Logs
CREATE INDEX IF NOT EXISTS "idx_vocabulary_review_logs_user_id" ON "public"."vocabulary_review_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_review_logs_user_book_reviewed" ON "public"."vocabulary_review_logs" ("user_id", "book_id", "reviewed_at" DESC);

-- ============================================
-- 6. Row Level Security (RLS)
-- ============================================

ALTER TABLE "public"."vocabulary_words" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vocabulary_books" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vocabulary_book_words" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vocabulary_user_book_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vocabulary_user_word_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vocabulary_book_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vocabulary_review_logs" ENABLE ROW LEVEL SECURITY;

-- 6.1 Vocabulary Words (Global - readable by all authenticated users)
CREATE POLICY "Allow read all words" ON "public"."vocabulary_words"
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow anon read completed words" ON "public"."vocabulary_words"
    FOR SELECT TO anon USING (import_status = 'done');

CREATE POLICY "Allow service role manage words" ON "public"."vocabulary_words"
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6.2 Vocabulary Books
CREATE POLICY "Allow read system books" ON "public"."vocabulary_books"
    FOR SELECT TO authenticated, anon USING (is_system_book = true);

CREATE POLICY "Allow manage own books" ON "public"."vocabulary_books"
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6.3 Book Words Junction
CREATE POLICY "Allow read book words" ON "public"."vocabulary_book_words"
    FOR SELECT TO authenticated, anon USING (
        EXISTS (
            SELECT 1 FROM "public"."vocabulary_books" vb 
            WHERE vb.id = book_id 
            AND (vb.is_system_book = true OR vb.user_id = auth.uid())
        )
    );

CREATE POLICY "Allow manage own book words" ON "public"."vocabulary_book_words"
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM "public"."vocabulary_books" vb 
            WHERE vb.id = book_id 
            AND vb.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM "public"."vocabulary_books" vb 
            WHERE vb.id = book_id 
            AND vb.user_id = auth.uid()
        )
    );

-- 6.4 User Progress & Settings
CREATE POLICY "Allow manage own book progress" ON "public"."vocabulary_user_book_progress"
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow manage own word progress" ON "public"."vocabulary_user_word_progress"
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow manage own book settings" ON "public"."vocabulary_book_settings"
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow manage own user settings" ON "public"."user_settings"
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow manage own review logs" ON "public"."vocabulary_review_logs"
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6.5 App Settings
CREATE POLICY "Allow read app settings" ON "public"."app_settings"
    FOR SELECT TO authenticated, anon, service_role USING (true);

CREATE POLICY "Allow service role manage app settings" ON "public"."app_settings"
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 7. Triggers
-- ============================================

DROP TRIGGER IF EXISTS "update_vocabulary_words_timestamp" ON "public"."vocabulary_words";
CREATE TRIGGER "update_vocabulary_words_timestamp" BEFORE UPDATE ON "public"."vocabulary_words" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_vocabulary_books_timestamp" ON "public"."vocabulary_books";
CREATE TRIGGER "update_vocabulary_books_timestamp" BEFORE UPDATE ON "public"."vocabulary_books" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_vocabulary_user_book_progress_timestamp" ON "public"."vocabulary_user_book_progress";
CREATE TRIGGER "update_vocabulary_user_book_progress_timestamp" BEFORE UPDATE ON "public"."vocabulary_user_book_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_vocabulary_user_word_progress_timestamp" ON "public"."vocabulary_user_word_progress";
CREATE TRIGGER "update_vocabulary_user_word_progress_timestamp" BEFORE UPDATE ON "public"."vocabulary_user_word_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_vocabulary_book_settings_timestamp" ON "public"."vocabulary_book_settings";
CREATE TRIGGER "update_vocabulary_book_settings_timestamp" BEFORE UPDATE ON "public"."vocabulary_book_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_user_settings_timestamp" ON "public"."user_settings";
CREATE TRIGGER "update_user_settings_timestamp" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

DROP TRIGGER IF EXISTS "update_app_settings_timestamp" ON "public"."app_settings";
CREATE TRIGGER "update_app_settings_timestamp" BEFORE UPDATE ON "public"."app_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- ============================================
-- 8. Business Logic Functions
-- ============================================

-- 8.1 Add Word to Book (Creates global word if not exists, links to book)
CREATE OR REPLACE FUNCTION "public"."add_word_to_book"(
    p_book_id UUID,
    p_word VARCHAR(200),
    p_sort_order INTEGER DEFAULT 0,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_word_id UUID;
BEGIN
    INSERT INTO vocabulary_words (word)
    VALUES (LOWER(TRIM(p_word)))
    ON CONFLICT (word) DO UPDATE SET word = EXCLUDED.word
    RETURNING id INTO v_word_id;

    INSERT INTO vocabulary_book_words (book_id, word_id, sort_order, notes)
    VALUES (p_book_id, v_word_id, p_sort_order, p_notes)
    ON CONFLICT (book_id, word_id) DO UPDATE SET
        sort_order = EXCLUDED.sort_order,
        notes = COALESCE(EXCLUDED.notes, vocabulary_book_words.notes);

    RETURN v_word_id;
END;
$$;

-- 8.2 Bulk Add Words to Book
CREATE OR REPLACE FUNCTION "public"."add_words_to_book"(
    p_book_id UUID,
    p_words TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER := 0;
    v_word TEXT;
    v_sort INTEGER := 0;
BEGIN
    FOREACH v_word IN ARRAY p_words
    LOOP
        PERFORM add_word_to_book(p_book_id, v_word, v_sort);
        v_sort := v_sort + 1;
        v_count := v_count + 1;
    END LOOP;
    
    UPDATE vocabulary_books SET word_count = (
        SELECT COUNT(*) FROM vocabulary_book_words WHERE book_id = p_book_id
    ) WHERE id = p_book_id;
    
    RETURN v_count;
END;
$$;

-- 8.3 Update Book Word Count Trigger
CREATE OR REPLACE FUNCTION "public"."update_book_word_count"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_book_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_book_id := OLD.book_id;
    ELSE
        v_book_id := NEW.book_id;
    END IF;

    UPDATE vocabulary_books SET word_count = (
        SELECT COUNT(*) FROM vocabulary_book_words WHERE book_id = v_book_id
    ) WHERE id = v_book_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS "trg_update_book_word_count" ON "public"."vocabulary_book_words";
CREATE TRIGGER "trg_update_book_word_count"
    AFTER INSERT OR DELETE ON "public"."vocabulary_book_words"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_book_word_count"();

-- 8.4 Book Progress Stats Update
CREATE OR REPLACE FUNCTION "public"."update_book_progress_stats"()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_mastered INT;
    v_learning INT;
    v_new INT;
    v_user_id UUID;
    v_book_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
        v_book_id := OLD.book_id;
    ELSE
        v_user_id := NEW.user_id;
        v_book_id := NEW.book_id;
    END IF;

    SELECT
        COUNT(*) FILTER (WHERE state = 'review' AND stability > 21),
        COUNT(*) FILTER (WHERE state IN ('learning', 'relearning') OR (state = 'review' AND stability <= 21)),
        COUNT(*) FILTER (WHERE state = 'new')
    INTO v_mastered, v_learning, v_new
    FROM vocabulary_user_word_progress
    WHERE user_id = v_user_id AND book_id = v_book_id;

    INSERT INTO vocabulary_user_book_progress (user_id, book_id, mastered_count, learning_count, new_count, updated_at)
    VALUES (v_user_id, v_book_id, v_mastered, v_learning, v_new, NOW())
    ON CONFLICT (user_id, book_id)
    DO UPDATE SET
        mastered_count = EXCLUDED.mastered_count,
        learning_count = EXCLUDED.learning_count,
        new_count = EXCLUDED.new_count,
        updated_at = NOW();

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS "trg_update_book_stats" ON "public"."vocabulary_user_word_progress";
CREATE TRIGGER "trg_update_book_stats"
    AFTER INSERT OR UPDATE OF state, stability OR DELETE ON "public"."vocabulary_user_word_progress"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_book_progress_stats"();

-- 8.5 Get Due Cards (FSRS)
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
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        uwp.id,
        uwp.word_id,
        uwp.state,
        uwp.due_at,
        uwp.is_learning_phase
    FROM vocabulary_user_word_progress uwp
    WHERE uwp.user_id = p_user_id
        AND uwp.book_id = p_book_id
        AND uwp.due_at <= NOW()
    ORDER BY
        uwp.is_learning_phase DESC,
        uwp.due_at + (random() * interval '5 minutes') ASC
    LIMIT p_limit;
END;
$$;

-- 8.6 Get Book Words with Details
CREATE OR REPLACE FUNCTION "public"."get_book_words"(
    p_book_id UUID,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    word_id UUID,
    word VARCHAR(200),
    phonetic VARCHAR(200),
    audio_path TEXT,
    meta JSONB,
    forms JSONB,
    definitions JSONB,
    examples JSONB,
    confused_words JSONB,
    import_status public.import_status_enum,
    sort_order INTEGER,
    notes TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        vw.id AS word_id,
        vw.word,
        vw.phonetic,
        vw.audio_path,
        vw.meta,
        vw.forms,
        vw.definitions,
        vw.examples,
        vw.confused_words,
        vw.import_status,
        bw.sort_order,
        bw.notes
    FROM vocabulary_book_words bw
    JOIN vocabulary_words vw ON vw.id = bw.word_id
    WHERE bw.book_id = p_book_id
    ORDER BY bw.sort_order
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 8.7 Update Word Details (Transactional)
CREATE OR REPLACE FUNCTION "public"."update_word_details"(
    p_word_id UUID,
    p_phonetic VARCHAR(200),
    p_audio_path TEXT,
    p_meta JSONB,
    p_forms JSONB,
    p_definitions JSONB,
    p_examples JSONB,
    p_confused_words JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE vocabulary_words SET
        phonetic = p_phonetic,
        audio_path = p_audio_path,
        meta = p_meta,
        forms = p_forms,
        definitions = p_definitions,
        examples = p_examples,
        confused_words = p_confused_words,
        import_status = 'done',
        updated_at = NOW()
    WHERE id = p_word_id;
END;
$$;

-- ============================================
-- 9. Task Scheduling System
-- ============================================

-- 9.1 Atomic Task Claiming Function
CREATE OR REPLACE FUNCTION "public"."claim_pending_vocabulary_words"(
    batch_size INT,
    instance_id TEXT
)
RETURNS SETOF "public"."vocabulary_words"
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE "public"."vocabulary_words"
    SET 
        import_status = 'importing',
        locked_by = instance_id,
        updated_at = NOW()
    WHERE id IN (
        SELECT id FROM "public"."vocabulary_words"
        WHERE import_status = 'pending'
        ORDER BY created_at
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
$$;

-- 9.2 Edge Function Trigger
CREATE OR REPLACE FUNCTION "public"."trigger_vocabulary_process"()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    pending_exists BOOLEAN;
    v_secret TEXT;
    v_origin TEXT;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM "public"."vocabulary_words" 
        WHERE import_status = 'pending' 
        LIMIT 1
    ) INTO pending_exists;

    IF NOT pending_exists THEN
        RETURN NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        RAISE EXCEPTION 'pg_net not available, skipping trigger';
        RETURN NULL;
    END IF;

    -- Retrieve secret from Vault
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'supabase_secret';

    -- Retrieve origin from App Settings
    SELECT value #>> '{}' INTO v_origin FROM app_settings WHERE key = 'supabase_origin';

    IF v_origin IS NULL THEN
        v_origin := 'http://host.docker.internal:54321';
    END IF;

    -- Fallback if secret is missing (log warning and exit)
    IF v_secret IS NULL THEN
        RAISE EXCEPTION 'supabase_secret not found in vault';
        RETURN NULL;
    END IF;

    PERFORM net.http_post(
        url := v_origin || '/functions/v1/vocabulary-words/process',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_secret
        ),
        body := jsonb_build_object('source', 'trigger')
    );

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "on_vocabulary_words_pending_insert" ON "public"."vocabulary_words";
CREATE TRIGGER "on_vocabulary_words_pending_insert"
    AFTER INSERT ON "public"."vocabulary_words"
    FOR EACH STATEMENT
    EXECUTE FUNCTION "public"."trigger_vocabulary_process"();

-- 9.3 Cron Failsafe Function
CREATE OR REPLACE FUNCTION "public"."process_pending_vocabulary_words"()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    pending_exists BOOLEAN;
    v_secret TEXT;
    v_origin TEXT;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM "public"."vocabulary_words" 
        WHERE import_status = 'pending' 
        LIMIT 1
    ) INTO pending_exists;

    IF NOT pending_exists THEN
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        RAISE EXCEPTION 'pg_net extension not installed.';
        RETURN;
    END IF;

    -- Retrieve secret from Vault
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'supabase_secret';

    -- Retrieve origin from App Settings
    SELECT value #>> '{}' INTO v_origin FROM app_settings WHERE key = 'supabase_origin';

    IF v_origin IS NULL THEN
        v_origin := 'http://host.docker.internal:54321';
    END IF;

    -- Fallback if secret is missing
    IF v_secret IS NULL THEN
        RAISE EXCEPTION 'supabase_secret not found in vault';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url := v_origin || '/functions/v1/vocabulary-words/process',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_secret
        ),
        body := jsonb_build_object('source', 'cron_failsafe')
    );
END;
$$;

-- 9.4 Stuck Task Recovery Function
CREATE OR REPLACE FUNCTION "public"."recover_stuck_vocabulary_words"()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    recovered_count INT;
BEGIN
    WITH recovered AS (
        UPDATE "public"."vocabulary_words"
        SET 
            import_status = 'pending',
            locked_by = NULL
        WHERE import_status = 'importing'
        AND updated_at < NOW() - INTERVAL '3 minutes'
        RETURNING id
    )
    SELECT COUNT(*) INTO recovered_count FROM recovered;

    IF recovered_count > 0 THEN
        RAISE NOTICE 'Recovered % stuck tasks', recovered_count;
    END IF;
END;
$$;

-- 9.5 Check Book Completion Failsafe
CREATE OR REPLACE FUNCTION "public"."check_and_complete_books"()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_count INT;
BEGIN
    WITH updated AS (
        UPDATE vocabulary_books vb
        SET 
            import_status = 'done',
            updated_at = NOW()
        WHERE vb.import_status != 'done'
        AND EXISTS (
            SELECT 1 FROM vocabulary_book_words vbw WHERE vbw.book_id = vb.id
        )
        AND NOT EXISTS (
            SELECT 1
            FROM vocabulary_book_words vbw
            JOIN vocabulary_words vw ON vbw.word_id = vw.id
            WHERE vbw.book_id = vb.id
            AND vw.import_status != 'done'
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO updated_count FROM updated;

    IF updated_count > 0 THEN
        RAISE NOTICE 'Completed % books via failsafe', updated_count;
    END IF;
END;
$$;

-- ============================================
-- 10. Cron Jobs (pg_cron)
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        BEGIN PERFORM cron.unschedule('process-pending-vocabulary-words'); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN PERFORM cron.unschedule('recover-stuck-vocabulary-words'); EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN PERFORM cron.unschedule('check-and-complete-books'); EXCEPTION WHEN OTHERS THEN NULL; END;

        PERFORM cron.schedule(
            'process-pending-vocabulary-words',
            '*/1 * * * *',
            'SELECT public.process_pending_vocabulary_words()'
        );

        PERFORM cron.schedule(
            'recover-stuck-vocabulary-words',
            '*/1 * * * *',
            'SELECT public.recover_stuck_vocabulary_words()'
        );

        PERFORM cron.schedule(
            'check-and-complete-books',
            '*/5 * * * *',
            'SELECT public.check_and_complete_books()'
        );

        RAISE NOTICE 'Cron jobs scheduled successfully';
    ELSE
        RAISE EXCEPTION 'pg_cron not available, skipping cron job setup';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to schedule cron jobs: %', SQLERRM;
END $$;

-- ============================================
-- 11. Permissions
-- ============================================

GRANT USAGE ON SCHEMA "public" TO "anon", "authenticated", "service_role";

GRANT ALL ON ALL TABLES IN SCHEMA "public" TO "authenticated", "service_role";

GRANT SELECT ON "public"."vocabulary_books" TO "anon";
GRANT SELECT ON "public"."vocabulary_words" TO "anon";
GRANT SELECT ON "public"."vocabulary_book_words" TO "anon";
GRANT SELECT ON "public"."app_settings" TO "anon";

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA "public" TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."add_word_to_book" TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."add_words_to_book" TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_book_words" TO "authenticated", "anon";
GRANT EXECUTE ON FUNCTION "public"."get_due_cards_with_fuzz" TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."claim_pending_vocabulary_words" TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."process_pending_vocabulary_words" TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."recover_stuck_vocabulary_words" TO "service_role";
GRANT EXECUTE ON FUNCTION "public"."check_and_complete_books" TO "service_role";
