-- =============================================================================
-- Migration 17: Notifications, Saved Challenges, and Extended Rewards
-- =============================================================================
-- Applies persistent notification tracking, challenge state saving, and adds
-- support for the 3-qubit GHZ mission in the authoritative server-side reward function.
--
-- Apply through Supabase Dashboard -> SQL Editor in an approved environment.
-- =============================================================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'achievement', 'level_up', 'mission', 'quest', 'contest')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  route TEXT DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Learners may view their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Learners may mark their own notifications as read
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access
GRANT ALL ON TABLE public.notifications TO service_role;
GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;


-- 2. SAVED CHALLENGES (FOR SAVE AND RESUME)
CREATE TABLE IF NOT EXISTS public.saved_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL,
  stage INTEGER NOT NULL DEFAULT 0,
  circuit_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, challenge_id)
);

ALTER TABLE public.saved_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own saved challenges" ON public.saved_challenges;
CREATE POLICY "Users can manage own saved challenges"
  ON public.saved_challenges FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON TABLE public.saved_challenges TO service_role, authenticated;


-- 3. EXTENDED GAMIFICATION REWARD FUNCTION
-- Includes 3-qubit GHZ state reward and notification generation
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
  profile_xp INTEGER;
BEGIN
  -- Only the backend service role may grant a reward. Amounts are fixed here,
  -- never taken from a browser request.
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only the service role may award XP';
  END IF;

  reward_xp := CASE
    WHEN p_event_type = 'circuit_mission' AND p_event_key = 'build-superposition' THEN 30
    WHEN p_event_type = 'circuit_mission' AND p_event_key = 'build-bell-state' THEN 50
    WHEN p_event_type = 'circuit_mission' AND p_event_key = 'build-ghz-state' THEN 60
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

      IF p_event_key = 'build-bell-state' THEN
        INSERT INTO public.gamification_achievements (user_id, achievement_id)
        VALUES (p_user_id, 'bell-state') ON CONFLICT DO NOTHING;
      ELSIF p_event_key = 'build-ghz-state' THEN
        INSERT INTO public.gamification_achievements (user_id, achievement_id)
        VALUES (p_user_id, 'all-missions') ON CONFLICT DO NOTHING;
      END IF;

    ELSIF p_event_type = 'contest_solution' THEN
      INSERT INTO public.gamification_achievements (user_id, achievement_id)
      VALUES (p_user_id, 'first-contest') ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.profiles SET total_xp = total_xp + reward_xp + daily_xp, updated_at = NOW()
    WHERE id = p_user_id
    RETURNING total_xp INTO profile_xp;

    IF profile_xp >= 100 THEN
      INSERT INTO public.gamification_achievements (user_id, achievement_id)
      VALUES (p_user_id, 'xp-100') ON CONFLICT DO NOTHING;
    END IF;
    IF profile_xp >= 500 THEN
      INSERT INTO public.gamification_achievements (user_id, achievement_id)
      VALUES (p_user_id, 'xp-500') ON CONFLICT DO NOTHING;
    END IF;

    -- Notification creation for milestone
    INSERT INTO public.notifications (user_id, category, title, body, route)
    VALUES (
      p_user_id,
      'mission',
      'Mission Verified: +' || (reward_xp + daily_xp)::TEXT || ' XP',
      'You successfully completed ' || p_event_key || ' and earned verified XP.',
      '/circuit'
    );

    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', achievement_id)), '[]'::jsonb) INTO new_achievements
    FROM public.gamification_achievements WHERE user_id = p_user_id AND unlocked_at >= NOW() - INTERVAL '1 second';

    RETURN jsonb_build_object(
      'awarded', true,
      'xp_awarded', reward_xp,
      'daily_quest_xp', daily_xp,
      'new_achievements', new_achievements
    );
  END IF;

  RETURN jsonb_build_object('awarded', false, 'xp_awarded', 0, 'new_achievements', '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.award_gamification_reward(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_gamification_reward(UUID, TEXT, TEXT) TO service_role;
