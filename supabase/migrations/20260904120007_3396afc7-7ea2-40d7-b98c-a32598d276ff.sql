CREATE TABLE public.player_ratings (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'PLAYER',
  mmr INT NOT NULL DEFAULT 1000,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.player_ratings TO service_role;
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'live',
  best_of INT NOT NULL DEFAULT 5,
  seed INT NOT NULL DEFAULT 0,
  host_player_id TEXT NOT NULL,
  guest_player_id TEXT NOT NULL,
  host_name TEXT NOT NULL DEFAULT 'PLAYER',
  guest_name TEXT NOT NULL DEFAULT 'PLAYER',
  host_skin TEXT NOT NULL DEFAULT 'nova',
  guest_skin TEXT NOT NULL DEFAULT 'ember',
  host_mmr INT NOT NULL DEFAULT 1000,
  guest_mmr INT NOT NULL DEFAULT 1000,
  host_mmr_after INT,
  guest_mmr_after INT,
  score_host INT NOT NULL DEFAULT 0,
  score_guest INT NOT NULL DEFAULT 0,
  winner TEXT,
  host_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  guest_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX matches_host_idx ON public.matches (host_player_id, status);
CREATE INDEX matches_guest_idx ON public.matches (guest_player_id, status);
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.mm_queue (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'PLAYER',
  skin TEXT NOT NULL DEFAULT 'nova',
  mmr INT NOT NULL DEFAULT 1000,
  region TEXT NOT NULL DEFAULT 'eu',
  best_of INT NOT NULL DEFAULT 5,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mm_queue_wait_idx ON public.mm_queue (region, match_id, created_at);
GRANT ALL ON public.mm_queue TO service_role;
ALTER TABLE public.mm_queue ENABLE ROW LEVEL SECURITY;

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
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('mvm_matchmaking'));

  DELETE FROM public.mm_queue WHERE seen_at < now() - INTERVAL '25 seconds';

  -- already paired while waiting?
  SELECT m.* INTO v_match
  FROM public.mm_queue q JOIN public.matches m ON m.id = q.match_id
  WHERE q.player_id = p_player_id;
  IF FOUND THEN
    UPDATE public.mm_queue SET seen_at = now() WHERE player_id = p_player_id;
    RETURN v_match;
  END IF;

  SELECT * INTO v_opp
  FROM public.mm_queue
  WHERE player_id <> p_player_id
    AND match_id IS NULL
    AND region = p_region
    AND seen_at > now() - INTERVAL '25 seconds'
  ORDER BY abs(mmr - p_mmr) + EXTRACT(EPOCH FROM (now() - created_at)) * -8, created_at
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.mm_queue (player_id, name, skin, mmr, region, best_of, match_id, seen_at, created_at)
    VALUES (p_player_id, p_name, p_skin, p_mmr, p_region, p_best_of, NULL, now(), now())
    ON CONFLICT (player_id) DO UPDATE
      SET name = EXCLUDED.name, skin = EXCLUDED.skin, mmr = EXCLUDED.mmr,
          region = EXCLUDED.region, best_of = EXCLUDED.best_of, seen_at = now();
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

  INSERT INTO public.mm_queue (player_id, name, skin, mmr, region, best_of, match_id)
  VALUES (p_player_id, p_name, p_skin, p_mmr, p_region, p_best_of, v_match.id)
  ON CONFLICT (player_id) DO UPDATE SET match_id = v_match.id, seen_at = now();

  RETURN v_match;
END;
$$;