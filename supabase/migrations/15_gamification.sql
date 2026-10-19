-- Apply manually through the Supabase migration workflow. This file is not
-- executed by the application and makes reward writes server-only.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0);

CREATE TABLE IF NOT EXISTS public.gamification_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('circuit_mission', 'contest_solution', 'daily_quest')),
  event_key TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL CHECK (xp_awarded > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_key)
);

CREATE TABLE IF NOT EXISTS public.gamification_achievements (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);
ALTER TABLE public.gamification_achievements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gamification_achievements FROM anon, authenticated;

ALTER TABLE public.gamification_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.gamification_rewards FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.award_gamification_reward(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reward_xp INTEGER;
  daily_xp INTEGER := 0;
  new_achievements JSONB := '[]'::jsonb;
  inserted_id UUID;
  reward_date TEXT := to_char(CURRENT_DATE, 'YYYY-MM-DD');
BEGIN
  -- Only the backend service role may grant a reward. Amounts are fixed here,
  -- never taken from a browser request.
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only the service role may award XP';
  END IF;
  reward_xp := CASE
    WHEN p_event_type = 'circuit_mission' AND p_event_key = 'build-superposition' THEN 30
    WHEN p_event_type = 'circuit_mission' AND p_event_key = 'build-bell-state' THEN 50
    WHEN p_event_type = 'contest_solution' THEN 75
    ELSE NULL
  END;
  IF reward_xp IS NULL THEN RAISE EXCEPTION 'Unsupported reward event'; END IF;
  INSERT INTO public.gamification_rewards (user_id, event_type, event_key, xp_awarded)
  VALUES (p_user_id, p_event_type, p_event_key, reward_xp)
  ON CONFLICT (user_id, event_key) DO NOTHING
  RETURNING id INTO inserted_id;
  IF inserted_id IS NOT NULL THEN
    IF p_event_type = 'circuit_mission' THEN
      INSERT INTO public.gamification_rewards (user_id, event_type, event_key, xp_awarded)
      VALUES (p_user_id, 'daily_quest', 'daily:circuit:' || reward_date, 20)
      ON CONFLICT (user_id, event_key) DO NOTHING
      RETURNING xp_awarded INTO daily_xp;
      daily_xp := COALESCE(daily_xp, 0);
      INSERT INTO public.gamification_achievements (user_id, achievement_id)
      VALUES (p_user_id, 'first-circuit') ON CONFLICT DO NOTHING;
    ELSIF p_event_type = 'contest_solution' THEN
      INSERT INTO public.gamification_achievements (user_id, achievement_id)
      VALUES (p_user_id, 'first-contest') ON CONFLICT DO NOTHING;
    END IF;
    UPDATE public.profiles SET total_xp = total_xp + reward_xp + daily_xp, updated_at = NOW() WHERE id = p_user_id;
    IF (SELECT total_xp FROM public.profiles WHERE id = p_user_id) >= 100 THEN
      INSERT INTO public.gamification_achievements (user_id, achievement_id)
      VALUES (p_user_id, 'xp-100') ON CONFLICT DO NOTHING;
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', achievement_id)), '[]'::jsonb) INTO new_achievements
    FROM public.gamification_achievements WHERE user_id = p_user_id AND unlocked_at >= NOW() - INTERVAL '1 second';
    RETURN jsonb_build_object('awarded', true, 'xp_awarded', reward_xp, 'daily_quest_xp', daily_xp, 'new_achievements', new_achievements);
  END IF;
  RETURN jsonb_build_object('awarded', false, 'xp_awarded', 0, 'new_achievements', '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.award_gamification_reward(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_gamification_reward(UUID, TEXT, TEXT) TO service_role;
