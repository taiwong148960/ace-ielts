


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



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_book_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_word_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "word_id" "uuid" NOT NULL,
    "book_id" "uuid" NOT NULL,
    "mastery_level" character varying(20) DEFAULT 'new'::character varying,
    "review_count" integer DEFAULT 0,
    "correct_count" integer DEFAULT 0,
    "last_reviewed_at" timestamp with time zone,
    "next_review_at" timestamp with time zone,
    "ease_factor" numeric(4,2) DEFAULT 2.5,
    "interval_days" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_word_progress_mastery_level_check" CHECK ((("mastery_level")::"text" = ANY ((ARRAY['new'::character varying, 'learning'::character varying, 'reviewing'::character varying, 'mastered'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_word_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vocabulary_books" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "cover_color" character varying(100) DEFAULT 'bg-gradient-to-br from-amber-500 to-orange-600'::character varying,
    "book_type" character varying(20) DEFAULT 'custom'::character varying,
    "is_system_book" boolean DEFAULT false,
    "user_id" "uuid",
    "word_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vocabulary_books_book_type_check" CHECK ((("book_type")::"text" = ANY ((ARRAY['ielts'::character varying, 'academic'::character varying, 'business'::character varying, 'custom'::character varying])::"text"[])))
);


ALTER TABLE "public"."vocabulary_books" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vocabulary_words" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "book_id" "uuid" NOT NULL,
    "word" character varying(200) NOT NULL,
    "phonetic" character varying(200),
    "definition" "text",
    "example_sentence" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vocabulary_words" OWNER TO "postgres";


ALTER TABLE ONLY "public"."user_book_progress"
    ADD CONSTRAINT "user_book_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_book_progress"
    ADD CONSTRAINT "user_book_progress_user_id_book_id_key" UNIQUE ("user_id", "book_id");



ALTER TABLE ONLY "public"."user_word_progress"
    ADD CONSTRAINT "user_word_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_word_progress"
    ADD CONSTRAINT "user_word_progress_user_id_word_id_key" UNIQUE ("user_id", "word_id");



ALTER TABLE ONLY "public"."vocabulary_books"
    ADD CONSTRAINT "vocabulary_books_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vocabulary_words"
    ADD CONSTRAINT "vocabulary_words_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_user_book_progress_book_id" ON "public"."user_book_progress" USING "btree" ("book_id");



CREATE INDEX "idx_user_book_progress_user_id" ON "public"."user_book_progress" USING "btree" ("user_id");



CREATE INDEX "idx_user_word_progress_book_id" ON "public"."user_word_progress" USING "btree" ("book_id");



CREATE INDEX "idx_user_word_progress_next_review" ON "public"."user_word_progress" USING "btree" ("next_review_at");



CREATE INDEX "idx_user_word_progress_user_id" ON "public"."user_word_progress" USING "btree" ("user_id");



CREATE INDEX "idx_user_word_progress_word_id" ON "public"."user_word_progress" USING "btree" ("word_id");



CREATE INDEX "idx_vocabulary_books_is_system" ON "public"."vocabulary_books" USING "btree" ("is_system_book");



CREATE INDEX "idx_vocabulary_books_user_id" ON "public"."vocabulary_books" USING "btree" ("user_id");



CREATE INDEX "idx_vocabulary_words_book_id" ON "public"."vocabulary_words" USING "btree" ("book_id");



CREATE OR REPLACE TRIGGER "update_user_book_progress_updated_at" BEFORE UPDATE ON "public"."user_book_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_word_progress_updated_at" BEFORE UPDATE ON "public"."user_word_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vocabulary_books_updated_at" BEFORE UPDATE ON "public"."vocabulary_books" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vocabulary_words_updated_at" BEFORE UPDATE ON "public"."vocabulary_words" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



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



CREATE POLICY "System books are viewable by everyone" ON "public"."vocabulary_books" FOR SELECT USING (("is_system_book" = true));



CREATE POLICY "Users can create their own books" ON "public"."vocabulary_books" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ("is_system_book" = false)));



CREATE POLICY "Users can create their own progress" ON "public"."user_book_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own word progress" ON "public"."user_word_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own books" ON "public"."vocabulary_books" FOR DELETE USING ((("auth"."uid"() = "user_id") AND ("is_system_book" = false)));



CREATE POLICY "Users can delete their own progress" ON "public"."user_book_progress" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own word progress" ON "public"."user_word_progress" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete words from their own books" ON "public"."vocabulary_words" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."vocabulary_books"
  WHERE (("vocabulary_books"."id" = "vocabulary_words"."book_id") AND ("vocabulary_books"."user_id" = "auth"."uid"()) AND ("vocabulary_books"."is_system_book" = false)))));



CREATE POLICY "Users can insert words into their own books" ON "public"."vocabulary_words" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vocabulary_books"
  WHERE (("vocabulary_books"."id" = "vocabulary_words"."book_id") AND ("vocabulary_books"."user_id" = "auth"."uid"()) AND ("vocabulary_books"."is_system_book" = false)))));



CREATE POLICY "Users can update their own books" ON "public"."vocabulary_books" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND ("is_system_book" = false)));



CREATE POLICY "Users can update their own progress" ON "public"."user_book_progress" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own word progress" ON "public"."user_word_progress" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update words in their own books" ON "public"."vocabulary_words" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."vocabulary_books"
  WHERE (("vocabulary_books"."id" = "vocabulary_words"."book_id") AND ("vocabulary_books"."user_id" = "auth"."uid"()) AND ("vocabulary_books"."is_system_book" = false)))));



CREATE POLICY "Users can view their own books" ON "public"."vocabulary_books" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own progress" ON "public"."user_book_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own word progress" ON "public"."user_word_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view words in their own books" ON "public"."vocabulary_words" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."vocabulary_books"
  WHERE (("vocabulary_books"."id" = "vocabulary_words"."book_id") AND ("vocabulary_books"."user_id" = "auth"."uid"())))));



CREATE POLICY "Words in system books are viewable by everyone" ON "public"."vocabulary_words" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."vocabulary_books"
  WHERE (("vocabulary_books"."id" = "vocabulary_words"."book_id") AND ("vocabulary_books"."is_system_book" = true)))));



ALTER TABLE "public"."user_book_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_word_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vocabulary_books" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vocabulary_words" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


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































drop extension if exists "pg_net";

alter table "public"."user_word_progress" drop constraint "user_word_progress_mastery_level_check";

alter table "public"."vocabulary_books" drop constraint "vocabulary_books_book_type_check";

alter table "public"."user_word_progress" add constraint "user_word_progress_mastery_level_check" CHECK (((mastery_level)::text = ANY ((ARRAY['new'::character varying, 'learning'::character varying, 'reviewing'::character varying, 'mastered'::character varying])::text[]))) not valid;

alter table "public"."user_word_progress" validate constraint "user_word_progress_mastery_level_check";

alter table "public"."vocabulary_books" add constraint "vocabulary_books_book_type_check" CHECK (((book_type)::text = ANY ((ARRAY['ielts'::character varying, 'academic'::character varying, 'business'::character varying, 'custom'::character varying])::text[]))) not valid;

alter table "public"."vocabulary_books" validate constraint "vocabulary_books_book_type_check";


