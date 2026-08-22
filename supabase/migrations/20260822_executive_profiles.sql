-- ==============================================================================
-- SUPABASE MIGRATION: Executive Career History Profiles Cache Table
-- ==============================================================================

-- 1. Create executive_profiles table
CREATE TABLE IF NOT EXISTS public.executive_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  current_company TEXT NOT NULL,
  current_symbol TEXT,
  current_title TEXT,
  career_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  photo_url TEXT,
  linkedin_url TEXT,
  summary TEXT,
  source TEXT NOT NULL DEFAULT 'none', -- 'pdl', 'wikidata', 'none'
  source_person_id TEXT,
  match_confidence NUMERIC(3,2) DEFAULT 1.0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_executive_name_company UNIQUE (normalized_name, current_company)
);

-- 2. Indexes for ultra-fast lookup and cache expiration checks
CREATE INDEX IF NOT EXISTS idx_executive_profiles_lookup
  ON public.executive_profiles(normalized_name, current_company);

CREATE INDEX IF NOT EXISTS idx_executive_profiles_symbol
  ON public.executive_profiles(current_symbol);

CREATE INDEX IF NOT EXISTS idx_executive_profiles_fetched_at
  ON public.executive_profiles(fetched_at);

-- 3. Row Level Security (RLS)
ALTER TABLE public.executive_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: Public and authenticated visitors can view cached executive profiles
DROP POLICY IF EXISTS "Allow public read access to executive profiles" ON public.executive_profiles;
CREATE POLICY "Allow public read access to executive profiles"
  ON public.executive_profiles
  FOR SELECT
  TO public
  USING (true);

-- ALL: Service role and backend server functions can insert, update, or upsert cached executive profiles
DROP POLICY IF EXISTS "Allow service role manage executive profiles" ON public.executive_profiles;
CREATE POLICY "Allow service role manage executive profiles"
  ON public.executive_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon upsert on executive profiles" ON public.executive_profiles;
CREATE POLICY "Allow anon upsert on executive profiles"
  ON public.executive_profiles
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
