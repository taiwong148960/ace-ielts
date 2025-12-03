ALTER TABLE public.vocabulary_books
ADD COLUMN IF NOT EXISTS cover_text character varying(100);
