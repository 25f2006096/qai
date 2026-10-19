-- ================================================================
-- QuantumLearn AI: trusted, auditable gamification foundation
-- ================================================================
-- Rewards are granted only by the backend service after it has validated a
-- circuit challenge. Browser clients have no write access to these tables.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0
    CHECK (longest_streak >= 0);

CREATE TABLE IF NOT EXISTS public.gamification_missions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    mission_type TEXT NOT NULL CHECK (mission_type IN ('build')),
    route TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    xp_reward INTEGER NOT NULL CHECK (xp_reward > 0),
    estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes > 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mission_progress (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mission_id TEXT NOT NULL REFERENCES public.gamification_missions(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_progress', 'completed', 'mastered')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    validation_reference TEXT,
    PRIMARY KEY (user_id, mission_id)
);
CREATE INDEX IF NOT EXISTS idx_mission_progress_user_status ON public.mission_progress(user_id, status);

CREATE TABLE IF NOT EXISTS public.xp_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mission_id TEXT REFERENCES public.gamification_missions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    xp_delta INTEGER NOT NULL CHECK (xp_delta > 0),
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_created ON public.xp_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gamification_achievement_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL REFERENCES public.gamification_achievement_definitions(id) ON DELETE RESTRICT,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_unlocked ON public.user_achievements(user_id, unlocked_at DESC);

CREATE TABLE IF NOT EXISTS public.daily_quests (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    quest_type TEXT NOT NULL,
    target_count INTEGER NOT NULL DEFAULT 1,
    xp_reward INTEGER NOT NULL CHECK (xp_reward > 0),
    icon TEXT NOT NULL DEFAULT '🎯'
);

CREATE TABLE IF NOT EXISTS public.user_quest_progress (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quest_id TEXT NOT NULL REFERENCES public.daily_quests(id) ON DELETE CASCADE,
    quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
    current_count INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, quest_id, quest_date)
);
CREATE INDEX IF NOT EXISTS idx_user_quest_progress_user_date ON public.user_quest_progress(user_id, quest_date);

INSERT INTO public.gamification_missions
    (id, title, description, mission_type, route, difficulty, xp_reward, estimated_minutes)
VALUES
    ('build-superposition', 'Create a superposition', 'Apply a Hadamard gate to q[0] and verify equal measurement probabilities.', 'build', '/circuit?mission=build-superposition', 'beginner', 30, 5),
    ('build-bell-state', 'Build a Bell state', 'Apply H to q[0], then CNOT from q[0] to q[1], and verify the entangled result.', 'build', '/circuit?mission=build-bell-state', 'intermediate', 50, 10)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    route = EXCLUDED.route,
    difficulty = EXCLUDED.difficulty,
    xp_reward = EXCLUDED.xp_reward,
    estimated_minutes = EXCLUDED.estimated_minutes,
    updated_at = NOW();

INSERT INTO public.daily_quests (id, title, description, quest_type, target_count, xp_reward, icon)
VALUES
    ('daily-sim', 'Quantum Experimenter', 'Simulate a circuit or run a quantum experiment today.', 'circuit_simulation', 1, 15, '🔬'),
    ('daily-quiz', 'Knowledge Seeker', 'Answer at least 3 questions in topic quizzes or assessments.', 'quiz_questions', 3, 20, '📝'),
    ('daily-mission', 'Mission Specialist', 'Complete 1 verified circuit mission.', 'mission_completion', 1, 25, '🎯')
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    xp_reward = EXCLUDED.xp_reward,
    icon = EXCLUDED.icon;

INSERT INTO public.gamification_achievement_definitions (id, name, description, icon)
VALUES
    ('first-circuit-built', 'First Circuit Built', 'Complete your first verified circuit mission.', '⚛️'),
    ('superposition-scientist', 'Superposition Scientist', 'Create and validate a balanced single-qubit superposition.', '🌗'),
    ('entanglement-explorer', 'Entanglement Explorer', 'Create and validate a Bell state.', '🔗'),
    ('mission-control', 'Mission Control', 'Complete every available verified circuit mission.', '🏆')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon;

ALTER TABLE public.gamification_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quest_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gamification_missions_read" ON public.gamification_missions;
DROP POLICY IF EXISTS "gamification_achievement_definitions_read" ON public.gamification_achievement_definitions;
DROP POLICY IF EXISTS "mission_progress_read_own" ON public.mission_progress;
DROP POLICY IF EXISTS "xp_transactions_read_own" ON public.xp_transactions;
DROP POLICY IF EXISTS "user_achievements_read_own" ON public.user_achievements;
DROP POLICY IF EXISTS "daily_quests_read" ON public.daily_quests;
DROP POLICY IF EXISTS "user_quest_progress_read_own" ON public.user_quest_progress;

CREATE POLICY "gamification_missions_read" ON public.gamification_missions
    FOR SELECT USING (active OR public.is_instructor_or_admin());
CREATE POLICY "gamification_achievement_definitions_read" ON public.gamification_achievement_definitions
    FOR SELECT USING (TRUE);
CREATE POLICY "mission_progress_read_own" ON public.mission_progress
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "xp_transactions_read_own" ON public.xp_transactions
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "user_achievements_read_own" ON public.user_achievements
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "daily_quests_read" ON public.daily_quests
    FOR SELECT USING (TRUE);
CREATE POLICY "user_quest_progress_read_own" ON public.user_quest_progress
    FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- Only the backend service role may call this routine. It is intentionally not
-- callable by a browser token, even if a user discovers its SQL function name.
CREATE OR REPLACE FUNCTION public.backend_claim_circuit_mission(
    p_user_id UUID,
    p_mission_id TEXT,
    p_validation_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_mission public.gamification_missions%ROWTYPE;
    v_inserted BOOLEAN := FALSE;
    v_today DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - 1;
    v_previous_active DATE;
    v_current_streak INTEGER := 1;
    v_new_achievements JSONB := '[]'::JSONB;
BEGIN
    IF auth.role() <> 'service_role' THEN
        RAISE EXCEPTION 'This reward operation is restricted to the application backend';
    END IF;

    SELECT * INTO v_mission
    FROM public.gamification_missions
    WHERE id = p_mission_id AND active = TRUE AND mission_type = 'build'
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown or inactive mission';
    END IF;

    INSERT INTO public.mission_progress (user_id, mission_id, status, started_at, completed_at, validation_reference)
    VALUES (p_user_id, p_mission_id, 'completed', NOW(), NOW(), p_validation_reference)
    ON CONFLICT (user_id, mission_id) DO UPDATE
    SET status = CASE WHEN public.mission_progress.status = 'mastered' THEN 'mastered' ELSE 'completed' END,
        completed_at = COALESCE(public.mission_progress.completed_at, EXCLUDED.completed_at),
        validation_reference = COALESCE(public.mission_progress.validation_reference, EXCLUDED.validation_reference);

    INSERT INTO public.xp_transactions (user_id, mission_id, event_type, xp_delta, idempotency_key)
    VALUES (p_user_id, p_mission_id, 'verified_circuit_mission', v_mission.xp_reward, 'mission:' || p_mission_id)
    ON CONFLICT (user_id, idempotency_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    IF v_inserted THEN
        SELECT MAX(activity_date) INTO v_previous_active
        FROM public.activity_log
        WHERE user_id = p_user_id AND activity_date < v_today;

        SELECT current_streak INTO v_current_streak FROM public.profiles WHERE id = p_user_id FOR UPDATE;
        v_current_streak := CASE
            WHEN EXISTS (SELECT 1 FROM public.activity_log WHERE user_id = p_user_id AND activity_date = v_today) THEN GREATEST(v_current_streak, 1)
            WHEN v_previous_active = v_yesterday THEN GREATEST(v_current_streak, 0) + 1
            ELSE 1
        END;

        INSERT INTO public.activity_log (user_id, activity_date, interaction_count)
        VALUES (p_user_id, v_today, 1)
        ON CONFLICT (user_id, activity_date) DO UPDATE
        SET interaction_count = public.activity_log.interaction_count + 1;

        UPDATE public.profiles
        SET total_xp = total_xp + v_mission.xp_reward,
            current_streak = v_current_streak,
            longest_streak = GREATEST(longest_streak, v_current_streak),
            updated_at = NOW()
        WHERE id = p_user_id;

        INSERT INTO public.user_achievements (user_id, achievement_id)
        SELECT p_user_id, candidate.achievement_id
        FROM (
            SELECT 'first-circuit-built'::TEXT AS achievement_id
            WHERE EXISTS (SELECT 1 FROM public.xp_transactions WHERE user_id = p_user_id AND event_type = 'verified_circuit_mission')
            UNION ALL
            SELECT 'superposition-scientist' WHERE p_mission_id = 'build-superposition'
            UNION ALL
            SELECT 'entanglement-explorer' WHERE p_mission_id = 'build-bell-state'
            UNION ALL
            SELECT 'mission-control'
            WHERE NOT EXISTS (
                SELECT 1 FROM public.gamification_missions m
                WHERE m.active
                  AND NOT EXISTS (
                      SELECT 1 FROM public.mission_progress mp
                      WHERE mp.user_id = p_user_id AND mp.mission_id = m.id AND mp.status IN ('completed', 'mastered')
                  )
            )
        ) AS candidate
        ON CONFLICT DO NOTHING;

        SELECT COALESCE(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'description', d.description, 'icon', d.icon)), '[]'::JSONB)
        INTO v_new_achievements
        FROM public.user_achievements ua
        JOIN public.gamification_achievement_definitions d ON d.id = ua.achievement_id
        WHERE ua.user_id = p_user_id AND ua.unlocked_at >= NOW() - INTERVAL '5 seconds';
    END IF;

    RETURN jsonb_build_object(
        'awarded', v_inserted,
        'xp_awarded', CASE WHEN v_inserted THEN v_mission.xp_reward ELSE 0 END,
        'new_achievements', v_new_achievements
    );
END;
$$;

REVOKE ALL ON FUNCTION public.backend_claim_circuit_mission(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backend_claim_circuit_mission(UUID, TEXT, TEXT) TO service_role;
