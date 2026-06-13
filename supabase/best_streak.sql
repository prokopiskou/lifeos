-- Run in Supabase SQL Editor
ALTER TABLE public.user_journey
  ADD COLUMN IF NOT EXISTS best_streak int NOT NULL DEFAULT 0;

UPDATE public.user_journey
SET best_streak = GREATEST(COALESCE(best_streak, 0), COALESCE(streak, 0))
WHERE best_streak < streak;
