-- Migration: Top 100 Market Snapshot Global Database Refresh Lease
-- Description: Creates top100_market_snapshots table and atomic lease acquisition RPC functions

CREATE TABLE IF NOT EXISTS public.top100_market_snapshots (
  id TEXT PRIMARY KEY,
  fetched_at BIGINT,
  status TEXT,
  company_count INT,
  payload JSONB,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.top100_market_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow public read access to top100_market_snapshots
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'top100_market_snapshots' AND policyname = 'Allow public read access to top100_market_snapshots'
  ) THEN
    CREATE POLICY "Allow public read access to top100_market_snapshots"
      ON public.top100_market_snapshots
      FOR SELECT USING (true);
  END IF;
END $$;

-- Allow public write/update access for lease management
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'top100_market_snapshots' AND policyname = 'Allow public write access to top100_market_snapshots'
  ) THEN
    CREATE POLICY "Allow public write access to top100_market_snapshots"
      ON public.top100_market_snapshots
      FOR ALL USING (true);
  END IF;
END $$;

-- Postgres Atomic Function: acquire_top100_refresh_lease
CREATE OR REPLACE FUNCTION acquire_top100_refresh_lease(lease_seconds INT DEFAULT 60)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  lock_expiration TIMESTAMPTZ := NOW() + (lease_seconds || ' seconds')::INTERVAL;
  rows_updated INT;
BEGIN
  -- 1. Try to update existing top100_latest row if unlocked or lock expired
  UPDATE public.top100_market_snapshots
  SET locked_until = lock_expiration,
      updated_at = now_ts
  WHERE id = 'top100_latest'
    AND (locked_until IS NULL OR locked_until < now_ts);

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  IF rows_updated > 0 THEN
    RETURN TRUE;
  END IF;

  -- 2. Handle EMPTY DATABASE case: insert top100_latest row atomically if it does not exist
  INSERT INTO public.top100_market_snapshots (id, locked_until, updated_at)
  VALUES ('top100_latest', lock_expiration, now_ts)
  ON CONFLICT (id) DO UPDATE
    SET locked_until = EXCLUDED.locked_until,
        updated_at = EXCLUDED.updated_at
    WHERE public.top100_market_snapshots.locked_until IS NULL 
       OR public.top100_market_snapshots.locked_until < now_ts;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

-- Postgres Atomic Function: release_top100_refresh_lease
CREATE OR REPLACE FUNCTION release_top100_refresh_lease()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.top100_market_snapshots
  SET locked_until = NULL,
      updated_at = NOW()
  WHERE id = 'top100_latest';
END;
$$;
