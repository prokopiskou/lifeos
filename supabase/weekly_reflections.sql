-- Run in Supabase SQL Editor (table + RLS)
-- Weekly reflection answers (shown on Sundays on the dashboard)

CREATE TABLE IF NOT EXISTS public.weekly_reflections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  answer_1 text,
  answer_2 text,
  answer_3 text,
  created_at timestamp DEFAULT now(),
  UNIQUE (user_id, week_number)
);

CREATE INDEX IF NOT EXISTS weekly_reflections_user_week_idx
  ON public.weekly_reflections (user_id, week_number DESC);

ALTER TABLE public.weekly_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_reflections_select_own"
  ON public.weekly_reflections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "weekly_reflections_insert_own"
  ON public.weekly_reflections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
