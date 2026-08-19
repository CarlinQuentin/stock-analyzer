-- ==============================================================================
-- SUPABASE MIGRATION: Persistent User Saved Stocks Table & Strict RLS
-- ==============================================================================

-- 1. Create saved_stocks table
CREATE TABLE IF NOT EXISTS public.saved_stocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_saved_stocks_user_ticker UNIQUE (user_id, ticker)
);

-- 2. Performance indexes for efficient user-specific retrieval
CREATE INDEX IF NOT EXISTS idx_saved_stocks_user_id 
  ON public.saved_stocks(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_stocks_user_ticker 
  ON public.saved_stocks(user_id, ticker);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.saved_stocks ENABLE ROW LEVEL SECURITY;

-- 4. Row Level Security Policies: Authenticated Permanent Users Only

-- SELECT: Users can view their own saved stocks
DROP POLICY IF EXISTS "Users can view own saved stocks" ON public.saved_stocks;
CREATE POLICY "Users can view own saved stocks"
  ON public.saved_stocks
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true'
  );

-- INSERT: Users can insert their own saved stocks
DROP POLICY IF EXISTS "Users can insert own saved stocks" ON public.saved_stocks;
CREATE POLICY "Users can insert own saved stocks"
  ON public.saved_stocks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true'
  );

-- UPDATE: Required by Postgres for UPSERT (ON CONFLICT DO UPDATE)
DROP POLICY IF EXISTS "Users can update own saved stocks" ON public.saved_stocks;
CREATE POLICY "Users can update own saved stocks"
  ON public.saved_stocks
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true'
  );

-- DELETE: Users can delete their own saved stocks
DROP POLICY IF EXISTS "Users can delete own saved stocks" ON public.saved_stocks;
CREATE POLICY "Users can delete own saved stocks"
  ON public.saved_stocks
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true'
  );
