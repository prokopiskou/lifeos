-- Run in Supabase SQL Editor (table + RLS)

CREATE TABLE IF NOT EXISTS public.mood_checkins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  mood text,
  checkin_date date DEFAULT CURRENT_DATE,
  created_at timestamp DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS mood_checkins_user_date_idx
  ON public.mood_checkins (user_id, checkin_date DESC);

ALTER TABLE public.mood_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mood_checkins_select_own"
  ON public.mood_checkins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "mood_checkins_insert_own"
  ON public.mood_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
