-- Run in Supabase SQL Editor

ALTER TABLE public.user_journey
  ADD COLUMN IF NOT EXISTS within_path_stage text DEFAULT 'Awake';

ALTER TABLE public.daily_completions
  ADD COLUMN IF NOT EXISTS completed_on date;

-- Optional backfill from created_at (if that column exists)
-- UPDATE public.daily_completions SET completed_on = (created_at AT TIME ZONE 'Europe/Athens')::date WHERE completed_on IS NULL AND created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS daily_completions_user_completed_on_idx
  ON public.daily_completions (user_id, completed_on DESC);
