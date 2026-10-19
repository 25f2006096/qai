-- Privacy-safe weekly learning leaderboard. Apply only after migration 15 has
-- been reviewed and verified in an approved environment.
CREATE OR REPLACE FUNCTION public.learning_weekly_leaderboard(p_viewer_id UUID)
RETURNS TABLE(rank BIGINT, user_id UUID, display_name TEXT, weekly_xp BIGINT, is_viewer BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH weekly AS (
    SELECT user_id, SUM(xp_awarded)::BIGINT AS weekly_xp
    FROM public.gamification_rewards
    WHERE created_at >= date_trunc('week', now() AT TIME ZONE 'UTC')
    GROUP BY user_id
  )
  SELECT
    rank() OVER (ORDER BY weekly.weekly_xp DESC, weekly.user_id),
    weekly.user_id,
    COALESCE(NULLIF(trim(profiles.full_name), ''), 'Quantum learner') AS display_name,
    weekly.weekly_xp,
    weekly.user_id = p_viewer_id
  FROM weekly
  JOIN public.profiles ON profiles.id = weekly.user_id
  ORDER BY weekly.weekly_xp DESC, weekly.user_id
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.learning_weekly_leaderboard(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_weekly_leaderboard(UUID) TO service_role;
