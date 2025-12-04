-- ============================================
-- User Settings Migration
-- Stores user-specific settings including encrypted LLM API keys
-- ============================================

-- Create user_settings table
CREATE TABLE IF NOT EXISTS "public"."user_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- LLM API Configuration (for self-hosted mode)
  "llm_api_key_encrypted" TEXT, -- Encrypted API key using pgcrypto
  "llm_provider" TEXT DEFAULT 'gemini' CHECK (llm_provider IN ('gemini', 'openai', 'anthropic', 'custom')),
  
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one setting per user
  CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_user_settings_user_id" ON "public"."user_settings" ("user_id");

-- Enable RLS
ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own settings" ON "public"."user_settings"
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON "public"."user_settings"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON "public"."user_settings"
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings" ON "public"."user_settings"
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
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

-- Helper function to encrypt API key (using pgcrypto)
-- Note: In production, consider using Supabase Vault for better security
CREATE OR REPLACE FUNCTION "public"."encrypt_api_key"(api_key TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Using pgcrypto's encrypt function
  -- Note: encryption_key should be stored securely (e.g., in Supabase Vault)
  RETURN encode(
    pgp_sym_encrypt(api_key, encryption_key),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to decrypt API key
CREATE OR REPLACE FUNCTION "public"."decrypt_api_key"(encrypted_key TEXT, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(
    decode(encrypted_key, 'base64'),
    encryption_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

