-- Run in Supabase SQL Editor — percentile band (1 = elite, 100 = lowest) among all user_journey rows
CREATE OR REPLACE FUNCTION public.get_community_top_percent()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  uid uuid := auth.uid();
  my_days int;
  total int;
  rank_num int;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(total_days_active, 0) INTO my_days
  FROM public.user_journey
  WHERE user_id = uid
  LIMIT 1;

  IF my_days IS NULL THEN
    my_days := 0;
  END IF;

  SELECT COUNT(*)::int INTO total FROM public.user_journey;

  IF total < 1 THEN
    RETURN 50;
  END IF;

  SELECT (1 + COUNT(*)::int) INTO rank_num
  FROM public.user_journey
  WHERE COALESCE(total_days_active, 0) > my_days;

  RETURN LEAST(
    100,
    GREATEST(1, CEIL((rank_num::numeric / NULLIF(total, 0)) * 100)::int)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_top_percent() TO authenticated;
