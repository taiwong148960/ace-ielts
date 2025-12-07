-- ============================================
-- Initial Schema Migration (Merged)
-- This migration combines all schema changes into a single initial migration
-- ============================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

-- ============================================
-- Extensions
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests (if available)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_net extension not available, will use alternative method';
END $$;

-- ============================================
-- Helper Functions
-- ============================================

CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';
SET default_table_access_method = "heap";

-- ============================================
-- Enum Types
-- ============================================

-- Import status enum
DO $$ BEGIN
  CREATE TYPE import_status_enum AS ENUM ('pending', 'importing', 'completed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- Core Tables
-- ============================================

-- Vocabulary Books Table
CREATE TABLE IF NOT EXISTS "public"."vocabulary_books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "cover_color" character varying(100) DEFAULT 'bg-gradient-to-br from-amber-500 to-orange-600'::character varying,
    "cover_text" character varying(100),
    "book_type" character varying(20) DEFAULT 'custom'::character varying,
    "is_system_book" boolean DEFAULT false,
    "user_id" "uuid",
    "word_count" integer DEFAULT 0,
    -- Import tracking columns
    "import_status" import_status_enum DEFAULT 'pending',
    "import_progress" INTEGER DEFAULT 0,
    "import_total" INTEGER DEFAULT 0,
    "import_started_at" TIMESTAMPTZ,
    "import_completed_at" TIMESTAMPTZ,
    "import_error" TEXT,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vocabulary_books_book_type_check" CHECK ((("book_type")::"text" = ANY ((ARRAY['ielts'::character varying, 'academic'::character varying, 'business'::character varying, 'custom'::character varying])::"text"[])))
);

ALTER TABLE "public"."vocabulary_books" OWNER TO "postgres";

-- Vocabulary Words Table
CREATE TABLE IF NOT EXISTS "public"."vocabulary_words" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "book_id" "uuid" NOT NULL,
    "word" character varying(200) NOT NULL,
    "phonetic" character varying(200),
    "definition" "text",
    "example_sentence" "text",
    "notes" "text",
    -- Rich word data from Gemini API
    "word_details" JSONB,
    -- Import tracking
    "import_status" import_status_enum DEFAULT 'pending',
    "import_error" TEXT,
    -- Audio URLs
    "word_audio_url" TEXT,
    "example_audio_urls" JSONB,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."vocabulary_words" OWNER TO "postgres";

-- User Book Progress Table
CREATE TABLE IF NOT EXISTS "public"."user_book_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "book_id" "uuid" NOT NULL,
    "mastered_count" integer DEFAULT 0,
    "learning_count" integer DEFAULT 0,
    "new_count" integer DEFAULT 0,
    "last_studied_at" timestamp with time zone,
    "streak_days" integer DEFAULT 0,
    "accuracy_percent" numeric(5,2) DEFAULT 0,
    -- FSRS additional columns
    "total_reviews" INTEGER DEFAULT 0,
    "reviews_today" INTEGER DEFAULT 0,
    "new_words_today" INTEGER DEFAULT 0,
    "last_review_date" DATE,
    "daily_new_limit" INTEGER DEFAULT 20,
    "daily_review_limit" INTEGER DEFAULT 100,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."user_book_progress" OWNER TO "postgres";

-- User Word Progress Table (with FSRS columns)
CREATE TABLE IF NOT EXISTS "public"."user_word_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "word_id" "uuid" NOT NULL,
    "book_id" "uuid" NOT NULL,
    -- Legacy columns (kept for compatibility)
    "mastery_level" character varying(20) DEFAULT 'new'::character varying,
    "review_count" integer DEFAULT 0,
    "correct_count" integer DEFAULT 0,
    "last_review_at" timestamp with time zone,
    "next_review_at" timestamp with time zone,
    "ease_factor" numeric(4,2) DEFAULT 2.5,
    "interval_days" integer DEFAULT 0,
    -- FSRS columns
    "state" TEXT NOT NULL DEFAULT 'new',
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
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_word_progress_mastery_level_check" CHECK ((("mastery_level")::"text" = ANY ((ARRAY['new'::character varying, 'learning'::character varying, 'reviewing'::character varying, 'mastered'::character varying])::"text"[]))),
    CONSTRAINT "user_word_progress_state_check" CHECK (state IN ('new', 'learning', 'review', 'relearning'))
);

ALTER TABLE "public"."user_word_progress" OWNER TO "postgres";

-- Book Settings Table
CREATE TABLE IF NOT EXISTS "public"."book_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "book_id" UUID NOT NULL REFERENCES vocabulary_books(id) ON DELETE CASCADE,
  -- Daily limits
  "daily_new_limit" INTEGER NOT NULL DEFAULT 20,
  "daily_review_limit" INTEGER NOT NULL DEFAULT 60,
  -- Learning mode (migrated from require_spelling)
  "learning_mode" TEXT NOT NULL DEFAULT 'read_only' CHECK (learning_mode IN ('read_only', 'spelling')),
  "study_order" TEXT NOT NULL DEFAULT 'sequential' CHECK (study_order IN ('sequential', 'random')),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint: one setting per user per book
  CONSTRAINT "book_settings_user_book_key" UNIQUE ("user_id", "book_id")
);

-- User Settings Table
CREATE TABLE IF NOT EXISTS "public"."user_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- LLM API Configuration (for self-hosted mode)
  "llm_api_key_encrypted" TEXT,
  "llm_provider" TEXT DEFAULT 'gemini' CHECK (llm_provider IN ('gemini', 'openai', 'anthropic', 'custom')),
  -- Gemini Model Configuration
  "gemini_model_config" JSONB DEFAULT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint: one setting per user
  CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id")
);

-- Review Logs Table (for FSRS)
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

-- App Settings Table (for pg_cron configuration)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE app_settings IS 'Application settings for pg_cron jobs and other background tasks';

-- ============================================
-- Primary Keys
-- ============================================

ALTER TABLE ONLY "public"."user_book_progress"
    ADD CONSTRAINT "user_book_progress_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_word_progress"
    ADD CONSTRAINT "user_word_progress_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."vocabulary_books"
    ADD CONSTRAINT "vocabulary_books_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."vocabulary_words"
    ADD CONSTRAINT "vocabulary_words_pkey" PRIMARY KEY ("id");

-- ============================================
-- Unique Constraints
-- ============================================

ALTER TABLE ONLY "public"."user_book_progress"
    ADD CONSTRAINT "user_book_progress_user_id_book_id_key" UNIQUE ("user_id", "book_id");

ALTER TABLE ONLY "public"."user_word_progress"
    ADD CONSTRAINT "user_word_progress_user_id_word_id_key" UNIQUE ("user_id", "word_id");

-- ============================================
-- Indexes
-- ============================================

-- User Book Progress Indexes
CREATE INDEX IF NOT EXISTS "idx_user_book_progress_book_id" ON "public"."user_book_progress" USING "btree" ("book_id");
CREATE INDEX IF NOT EXISTS "idx_user_book_progress_user_id" ON "public"."user_book_progress" USING "btree" ("user_id");

-- User Word Progress Indexes
CREATE INDEX IF NOT EXISTS "idx_user_word_progress_book_id" ON "public"."user_word_progress" USING "btree" ("book_id");
CREATE INDEX IF NOT EXISTS "idx_user_word_progress_next_review" ON "public"."user_word_progress" USING "btree" ("next_review_at");
CREATE INDEX IF NOT EXISTS "idx_user_word_progress_user_id" ON "public"."user_word_progress" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_word_progress_word_id" ON "public"."user_word_progress" USING "btree" ("word_id");
-- FSRS indexes
CREATE INDEX IF NOT EXISTS "idx_uwp_due_at" ON "public"."user_word_progress" ("user_id", "due_at");
CREATE INDEX IF NOT EXISTS "idx_uwp_state" ON "public"."user_word_progress" ("user_id", "book_id", "state");
CREATE INDEX IF NOT EXISTS "idx_uwp_learning_phase" ON "public"."user_word_progress" ("user_id", "book_id", "is_learning_phase");

-- Vocabulary Books Indexes
CREATE INDEX IF NOT EXISTS "idx_vocabulary_books_is_system" ON "public"."vocabulary_books" USING "btree" ("is_system_book");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_books_user_id" ON "public"."vocabulary_books" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_books_import_status" ON "public"."vocabulary_books" ("import_status");

-- Vocabulary Words Indexes
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_book_id" ON "public"."vocabulary_words" USING "btree" ("book_id");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_word_details" ON "public"."vocabulary_words" USING GIN ("word_details");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_import_status" ON "public"."vocabulary_words" ("import_status");
CREATE INDEX IF NOT EXISTS "idx_vocabulary_words_example_audio_urls" ON "public"."vocabulary_words" USING GIN ("example_audio_urls");

-- Book Settings Indexes
CREATE INDEX IF NOT EXISTS "idx_book_settings_user_id" ON "public"."book_settings" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_book_settings_book_id" ON "public"."book_settings" ("book_id");

-- User Settings Indexes
CREATE INDEX IF NOT EXISTS "idx_user_settings_user_id" ON "public"."user_settings" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_settings_gemini_model_config" ON "public"."user_settings" USING GIN ("gemini_model_config");

-- Review Logs Indexes
CREATE INDEX IF NOT EXISTS "idx_rl_user_book" ON "public"."review_logs" ("user_id", "book_id");
CREATE INDEX IF NOT EXISTS "idx_rl_reviewed_at" ON "public"."review_logs" ("reviewed_at");
CREATE INDEX IF NOT EXISTS "idx_rl_progress" ON "public"."review_logs" ("progress_id");

-- ============================================
-- Triggers
-- ============================================

CREATE OR REPLACE TRIGGER "update_user_book_progress_updated_at" BEFORE UPDATE ON "public"."user_book_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_user_word_progress_updated_at" BEFORE UPDATE ON "public"."user_word_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_vocabulary_books_updated_at" BEFORE UPDATE ON "public"."vocabulary_books" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_vocabulary_words_updated_at" BEFORE UPDATE ON "public"."vocabulary_words" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Book Settings trigger
CREATE OR REPLACE FUNCTION "public"."update_book_settings_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "update_book_settings_updated_at"
BEFORE UPDATE ON "public"."book_settings"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_book_settings_updated_at"();

-- User Settings trigger
CREATE OR REPLACE FUNCTION "public"."update_user_settings_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "update_user_settings_updated_at"
BEFORE UPDATE ON "public"."user_settings"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_user_settings_updated_at"();

-- Book Progress Stats Update Trigger
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

CREATE TRIGGER "trg_update_book_stats"
AFTER INSERT OR UPDATE ON "public"."user_word_progress"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_book_progress_stats"();

-- ============================================
-- Helper Functions
-- ============================================

-- Get due cards with fuzz (for FSRS)
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

-- Encrypt API key (using pgcrypto)
CREATE OR REPLACE FUNCTION "public"."encrypt_api_key"(api_key TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    pgp_sym_encrypt(api_key, encryption_key),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrypt API key
CREATE OR REPLACE FUNCTION "public"."decrypt_api_key"(encrypted_key TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(encrypted_key, 'base64'),
    encryption_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process pending vocabulary words (for pg_cron)
CREATE OR REPLACE FUNCTION process_pending_vocabulary_words()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
  function_url TEXT;
  request_id BIGINT;
BEGIN
  -- Get configuration from app_settings table
  SELECT value INTO supabase_url
  FROM app_settings
  WHERE key = 'supabase_url'
  LIMIT 1;
  
  SELECT value INTO service_role_key
  FROM app_settings
  WHERE key = 'service_role_key'
  LIMIT 1;
  
  -- If not found, try to get from current database URL (for Supabase)
  IF supabase_url IS NULL THEN
    RAISE WARNING 'Supabase URL not configured in app_settings. Please set it manually.';
    RETURN;
  END IF;
  
  IF service_role_key IS NULL THEN
    RAISE WARNING 'Service role key not configured in app_settings. Please set it manually.';
    RETURN;
  END IF;
  
  -- Construct Edge Function URL
  function_url := supabase_url || '/functions/v1/vocabulary-process-pending-words';
  
  -- Use pg_net to make HTTP request
  BEGIN
    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key,
        'apikey', service_role_key
      ),
      body := '{}'::jsonb
    ) INTO request_id;
    
    RAISE NOTICE 'HTTP request sent to Edge Function with ID: %', request_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to send HTTP request (pg_net may not be available): %', SQLERRM;
  END;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in process_pending_vocabulary_words: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION process_pending_vocabulary_words() IS 
  'Processes pending vocabulary words by calling the vocabulary-process-pending-words Edge Function. 
   Requires app_settings table to be configured with supabase_url and service_role_key.
   This function is called by pg_cron every minute.';

-- ============================================
-- Foreign Keys
-- ============================================

ALTER TABLE ONLY "public"."user_book_progress"
    ADD CONSTRAINT "user_book_progress_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."vocabulary_books"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_book_progress"
    ADD CONSTRAINT "user_book_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_word_progress"
    ADD CONSTRAINT "user_word_progress_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."vocabulary_books"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_word_progress"
    ADD CONSTRAINT "user_word_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_word_progress"
    ADD CONSTRAINT "user_word_progress_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "public"."vocabulary_words"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."vocabulary_books"
    ADD CONSTRAINT "vocabulary_books_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."vocabulary_words"
    ADD CONSTRAINT "vocabulary_words_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."vocabulary_books"("id") ON DELETE CASCADE;

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE "public"."user_book_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_word_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vocabulary_books" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."vocabulary_words" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."book_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."review_logs" ENABLE ROW LEVEL SECURITY;

-- Vocabulary Books Policies
CREATE POLICY "System books are viewable by everyone" ON "public"."vocabulary_books" FOR SELECT USING (("is_system_book" = true));
CREATE POLICY "Users can create their own books" ON "public"."vocabulary_books" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ("is_system_book" = false)));
CREATE POLICY "Users can delete their own books" ON "public"."vocabulary_books" FOR DELETE USING ((("auth"."uid"() = "user_id") AND ("is_system_book" = false)));
CREATE POLICY "Users can update their own books" ON "public"."vocabulary_books" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND ("is_system_book" = false)));
CREATE POLICY "Users can view their own books" ON "public"."vocabulary_books" FOR SELECT USING (("auth"."uid"() = "user_id"));

-- Vocabulary Words Policies
CREATE POLICY "Users can delete words from their own books" ON "public"."vocabulary_words" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."vocabulary_books"
  WHERE (("vocabulary_books"."id" = "vocabulary_words"."book_id") AND ("vocabulary_books"."user_id" = "auth"."uid"()) AND ("vocabulary_books"."is_system_book" = false)))));
CREATE POLICY "Users can insert words into their own books" ON "public"."vocabulary_words" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vocabulary_books"
  WHERE (("vocabulary_books"."id" = "vocabulary_words"."book_id") AND ("vocabulary_books"."user_id" = "auth"."uid"()) AND ("vocabulary_books"."is_system_book" = false)))));
CREATE POLICY "Users can update words in their own books" ON "public"."vocabulary_words" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."vocabulary_books"
  WHERE (("vocabulary_books"."id" = "vocabulary_words"."book_id") AND ("vocabulary_books"."user_id" = "auth"."uid"()) AND ("vocabulary_books"."is_system_book" = false)))));
CREATE POLICY "Users can view words in their own books" ON "public"."vocabulary_words" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."vocabulary_books"
  WHERE (("vocabulary_books"."id" = "vocabulary_words"."book_id") AND ("vocabulary_books"."user_id" = "auth"."uid"())))));
CREATE POLICY "Words in system books are viewable by everyone" ON "public"."vocabulary_words" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."vocabulary_books"
  WHERE (("vocabulary_books"."id" = "vocabulary_words"."book_id") AND ("vocabulary_books"."is_system_book" = true)))));

-- User Book Progress Policies
CREATE POLICY "Users can create their own progress" ON "public"."user_book_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can delete their own progress" ON "public"."user_book_progress" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own progress" ON "public"."user_book_progress" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view their own progress" ON "public"."user_book_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));

-- User Word Progress Policies
CREATE POLICY "Users can create their own word progress" ON "public"."user_word_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can delete their own word progress" ON "public"."user_word_progress" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own word progress" ON "public"."user_word_progress" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view their own word progress" ON "public"."user_word_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));

-- Book Settings Policies
CREATE POLICY "Users can view own book settings" ON "public"."book_settings"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own book settings" ON "public"."book_settings"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own book settings" ON "public"."book_settings"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own book settings" ON "public"."book_settings"
  FOR DELETE USING (auth.uid() = user_id);

-- User Settings Policies
CREATE POLICY "Users can view own settings" ON "public"."user_settings"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON "public"."user_settings"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON "public"."user_settings"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings" ON "public"."user_settings"
  FOR DELETE USING (auth.uid() = user_id);

-- Review Logs Policies
CREATE POLICY "Users can view own review logs" ON "public"."review_logs"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own review logs" ON "public"."review_logs"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Grants
-- ============================================

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";

GRANT ALL ON TABLE "public"."user_book_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_book_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_book_progress" TO "service_role";

GRANT ALL ON TABLE "public"."user_word_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_word_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_word_progress" TO "service_role";

GRANT ALL ON TABLE "public"."vocabulary_books" TO "anon";
GRANT ALL ON TABLE "public"."vocabulary_books" TO "authenticated";
GRANT ALL ON TABLE "public"."vocabulary_books" TO "service_role";

GRANT ALL ON TABLE "public"."vocabulary_words" TO "anon";
GRANT ALL ON TABLE "public"."vocabulary_words" TO "authenticated";
GRANT ALL ON TABLE "public"."vocabulary_words" TO "service_role";

GRANT ALL ON TABLE "public"."book_settings" TO "anon";
GRANT ALL ON TABLE "public"."book_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."book_settings" TO "service_role";

GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";

GRANT ALL ON TABLE "public"."review_logs" TO "anon";
GRANT ALL ON TABLE "public"."review_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."review_logs" TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."update_book_progress_stats"() TO "anon";
GRANT EXECUTE ON FUNCTION "public"."update_book_progress_stats"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."update_book_progress_stats"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_due_cards_with_fuzz"(UUID, UUID, INTEGER) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."get_due_cards_with_fuzz"(UUID, UUID, INTEGER) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_due_cards_with_fuzz"(UUID, UUID, INTEGER) TO "service_role";

-- ============================================
-- Default Privileges
-- ============================================

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

-- ============================================
-- pg_cron Job
-- ============================================

-- Schedule the cron job to run every minute
-- Note: After running this migration, you need to populate the app_settings table:
-- INSERT INTO app_settings (key, value, description) VALUES 
--   ('supabase_url', 'https://your-project-ref.supabase.co', 'Supabase project URL'),
--   ('service_role_key', 'your-service-role-key', 'Supabase service role key for authentication');
SELECT cron.schedule(
  'process-pending-vocabulary-words',
  '*/1 * * * *', -- Every minute
  $$
  SELECT process_pending_vocabulary_words();
  $$
);

-- ============================================
-- Comments
-- ============================================

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
