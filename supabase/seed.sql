-- Seed file for initial data
-- This file is intentionally empty for now
-- Add seed data here if needed

-- Default App Settings for Development
INSERT INTO "public"."app_settings" ("key", "value", "description")
VALUES ('supabase_origin', '"https://localhost:54321"', 'Base URL for Supabase Edge Functions')
ON CONFLICT ("key") DO NOTHING;

-- Add default secret for development (user should update this in production)
-- We wrap this in a block to ignore errors if the secret already exists or vault is not fully set up
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
        -- 1. Supabase Secret Key (for Edge Functions security)
        BEGIN
            PERFORM vault.create_secret(
                'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz', 
                'supabase_secret',
                'Secret key for securing Edge Function calls from Database'
            );
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- 2. LLM API Key (Global default for AI features)
        BEGIN
            PERFORM vault.create_secret(
                'sk-placeholder-key-for-llm-service', 
                'llm_api_key',
                'Global API Key for LLM service (OpenAI/Gemini/etc)'
            );
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
END $$;
