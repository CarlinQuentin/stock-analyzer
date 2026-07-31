-- ==============================================================================
-- SUPABASE MIGRATION: Anonymous Auth & Server-Side Quota + IP Abuse Protection
-- ==============================================================================

-- 1. Create user_analyses table to track stock analyses performed per user
CREATE TABLE IF NOT EXISTS public.user_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analyses" ON public.user_analyses;
CREATE POLICY "Users can view own analyses"
  ON public.user_analyses
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own analyses" ON public.user_analyses;
CREATE POLICY "Users can insert own analyses"
  ON public.user_analyses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_analyses_user_ticker 
  ON public.user_analyses(user_id, ticker);

-- 2. Create ip_analyses table for server-side IP abuse protection (hashed IPs only)
CREATE TABLE IF NOT EXISTS public.ip_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  ticker TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ip_analyses ENABLE ROW LEVEL SECURITY;

-- Index for fast rolling 24-hour IP rate limit lookups
CREATE INDEX IF NOT EXISTS idx_ip_analyses_hash_created 
  ON public.ip_analyses(ip_hash, created_at);

-- 3. Atomic Postgres RPC Function for Dual Quota & IP Abuse Protection
CREATE OR REPLACE FUNCTION public.check_and_increment_analysis_limit(
  p_ticker TEXT,
  p_ip_hash TEXT DEFAULT NULL,
  p_max_anonymous_limit INT DEFAULT 2,
  p_max_ip_limit INT DEFAULT 10,
  p_ip_window_hours INT DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_is_anonymous BOOLEAN;
  v_distinct_count INT;
  v_ip_count INT;
  v_already_analyzed BOOLEAN;
BEGIN
  -- Get current user ID from JWT context
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'ERROR',
      'code', 'UNAUTHORIZED',
      'message', 'Authentication required. Anonymous session must be initialized.'
    );
  END IF;

  -- Determine if user is anonymous (check JWT is_anonymous or email presence in auth.users)
  SELECT 
    COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, FALSE) OR (email IS NULL OR email = '')
  INTO v_is_anonymous
  FROM auth.users
  WHERE id = v_user_id;

  IF v_is_anonymous IS NULL THEN
    v_is_anonymous := TRUE;
  END IF;

  -- Clean ticker symbol
  p_ticker := UPPER(TRIM(p_ticker));

  -- Check if this user has already analyzed this specific ticker
  SELECT EXISTS (
    SELECT 1 FROM public.user_analyses
    WHERE user_id = v_user_id AND UPPER(ticker) = p_ticker
  ) INTO v_already_analyzed;

  -- Count distinct tickers analyzed by this user so far
  SELECT COUNT(DISTINCT UPPER(ticker))
  INTO v_distinct_count
  FROM public.user_analyses
  WHERE user_id = v_user_id;

  -- Registered users get unlimited access
  IF NOT v_is_anonymous THEN
    IF NOT v_already_analyzed THEN
      INSERT INTO public.user_analyses (user_id, ticker) VALUES (v_user_id, p_ticker);
      IF p_ip_hash IS NOT NULL AND p_ip_hash != '' THEN
        INSERT INTO public.ip_analyses (ip_hash, ticker) VALUES (p_ip_hash, p_ticker);
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'status', 'ALLOWED',
      'is_anonymous', FALSE,
      'already_analyzed', v_already_analyzed,
      'count', v_distinct_count + (CASE WHEN v_already_analyzed THEN 0 ELSE 1 END),
      'limit', NULL
    );
  END IF;

  -- Anonymous User Rule 1:
  -- If user already analyzed this ticker previously, allow without consuming new quota slot
  IF v_already_analyzed THEN
    RETURN jsonb_build_object(
      'status', 'ALLOWED',
      'is_anonymous', TRUE,
      'already_analyzed', TRUE,
      'count', v_distinct_count,
      'limit', p_max_anonymous_limit
    );
  END IF;

  -- Anonymous User Rule 2: Enforce lifetime limit of max 2 analyses per anonymous user
  IF v_distinct_count >= p_max_anonymous_limit THEN
    RETURN jsonb_build_object(
      'status', 'LIMIT_EXCEEDED',
      'code', 'LOGIN_REQUIRED',
      'reason', 'USER_LIMIT_EXCEEDED',
      'is_anonymous', TRUE,
      'already_analyzed', FALSE,
      'count', v_distinct_count,
      'limit', p_max_anonymous_limit,
      'message', 'You have reached your limit of 2 free anonymous stock analyses. Please sign up or log in to continue.'
    );
  END IF;

  -- Abuse Protection Rule 3: Enforce rolling 24-hour limit of max 10 analyses per hashed IP
  IF p_ip_hash IS NOT NULL AND p_ip_hash != '' THEN
    SELECT COUNT(*)
    INTO v_ip_count
    FROM public.ip_analyses
    WHERE ip_hash = p_ip_hash AND created_at > (now() - (p_ip_window_hours || ' hours')::interval);

    IF v_ip_count >= p_max_ip_limit THEN
      RETURN jsonb_build_object(
        'status', 'LIMIT_EXCEEDED',
        'code', 'LOGIN_REQUIRED',
        'reason', 'IP_LIMIT_EXCEEDED',
        'is_anonymous', TRUE,
        'already_analyzed', FALSE,
        'count', v_distinct_count,
        'limit', p_max_anonymous_limit,
        'ip_count', v_ip_count,
        'ip_limit', p_max_ip_limit,
        'message', 'Analysis limit exceeded for your IP network in the last 24 hours. Please sign up or log in to continue.'
      );
    END IF;
  END IF;

  -- Atomic Inserts into both user_analyses and ip_analyses
  INSERT INTO public.user_analyses (user_id, ticker) VALUES (v_user_id, p_ticker);
  IF p_ip_hash IS NOT NULL AND p_ip_hash != '' THEN
    INSERT INTO public.ip_analyses (ip_hash, ticker) VALUES (p_ip_hash, p_ticker);
  END IF;

  RETURN jsonb_build_object(
    'status', 'ALLOWED',
    'is_anonymous', TRUE,
    'already_analyzed', FALSE,
    'count', v_distinct_count + 1,
    'limit', p_max_anonymous_limit
  );
END;
$$;
