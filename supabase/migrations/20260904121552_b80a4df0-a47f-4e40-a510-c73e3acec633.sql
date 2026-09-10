CREATE INDEX IF NOT EXISTS mm_queue_seen_idx ON public.mm_queue (seen_at);
CREATE INDEX IF NOT EXISTS mm_queue_match_idx ON public.mm_queue (match_id);
CREATE INDEX IF NOT EXISTS matches_status_idx ON public.matches (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.mm_find_or_queue(
  p_player_id TEXT,
  p_name TEXT,
  p_skin TEXT,
  p_mmr INT,
  p_region TEXT DEFAULT 'eu',
  p_best_of INT DEFAULT 5
) RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp public.mm_queue;
  v_match public.matches;
  v_code TEXT;
  v_wait NUMERIC := 0;
  v_window INT;
BEGIN
  -- 1) reconnect: the player already sits in a live match
  SELECT m.* INTO v_match
  FROM public.matches m
  WHERE m.status = 'live'
    AND (m.host_player_id = p_player_id OR m.guest_player_id = p_player_id)
    AND m.created_at > now() - INTERVAL '30 minutes'
  ORDER BY m.created_at DESC
  LIMIT 1;
  IF FOUND THEN
    DELETE FROM public.mm_queue WHERE player_id = p_player_id;
    RETURN v_match;
  END IF;

  -- 2) paired while waiting?
  SELECT m.* INTO v_match
  FROM public.mm_queue q
  JOIN public.matches m ON m.id = q.match_id
  WHERE q.player_id = p_player_id;
  IF FOUND THEN
    UPDATE public.mm_queue SET seen_at = now() WHERE player_id = p_player_id;
    RETURN v_match;
  END IF;

  -- 3) refresh our own ticket first so others can pair with us even when this
  --    call cannot take the pairing lock right now
  INSERT INTO public.mm_queue (player_id, name, skin, mmr, region, best_of, match_id, seen_at, created_at)
  VALUES (p_player_id, p_name, p_skin, p_mmr, p_region, p_best_of, NULL, now(), now())
  ON CONFLICT (player_id) DO UPDATE
    SET name = EXCLUDED.name, skin = EXCLUDED.skin, mmr = EXCLUDED.mmr,
        region = EXCLUDED.region, best_of = EXCLUDED.best_of, seen_at = now();

  -- 4) only one pairing pass at a time; concurrent callers return instantly
  IF NOT pg_try_advisory_xact_lock(hashtext('mvm_matchmaking')) THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.mm_queue
  WHERE player_id <> p_player_id AND seen_at < now() - INTERVAL '20 seconds';

  UPDATE public.matches
  SET status = 'abandoned', ended_at = now(), updated_at = now()
  WHERE status = 'live'
    AND host_seen_at < now() - INTERVAL '3 minutes'
    AND guest_seen_at < now() - INTERVAL '3 minutes';

  SELECT EXTRACT(EPOCH FROM (now() - created_at)) INTO v_wait
  FROM public.mm_queue WHERE player_id = p_player_id;
  v_window := 120 + (COALESCE(v_wait, 0) * 150)::INT;
  IF v_window > 100000 THEN v_window := 100000; END IF;

  SELECT * INTO v_opp
  FROM public.mm_queue
  WHERE player_id <> p_player_id
    AND match_id IS NULL
    AND region = p_region
    AND seen_at > now() - INTERVAL '20 seconds'
    AND abs(mmr - p_mmr) <= v_window
  ORDER BY abs(mmr - p_mmr), created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.matches (
    code, best_of, seed,
    host_player_id, guest_player_id,
    host_name, guest_name, host_skin, guest_skin, host_mmr, guest_mmr
  ) VALUES (
    v_code, LEAST(p_best_of, v_opp.best_of), (random() * 1000000)::INT,
    v_opp.player_id, p_player_id,
    v_opp.name, p_name, v_opp.skin, p_skin, v_opp.mmr, p_mmr
  ) RETURNING * INTO v_match;

  UPDATE public.mm_queue SET match_id = v_match.id, seen_at = now()
  WHERE player_id IN (p_player_id, v_opp.player_id);

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.mm_find_or_queue(TEXT, TEXT, TEXT, INT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mm_find_or_queue(TEXT, TEXT, TEXT, INT, TEXT, INT) FROM anon;
REVOKE ALL ON FUNCTION public.mm_find_or_queue(TEXT, TEXT, TEXT, INT, TEXT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mm_find_or_queue(TEXT, TEXT, TEXT, INT, TEXT, INT) TO service_role;