# Deployment checklist

## Before deployment

- [ ] Confirm the target branch and intended commit SHA.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Run `.venv\Scripts\python -m pytest` locally or test under the Docker Python 3.12 runtime.
- [ ] Apply and validate required Supabase migrations in a non-production environment.
- [ ] Confirm RLS denies cross-user learner data access and browser reward writes.
- [ ] Configure Render environment variables listed in `ENVIRONMENT_SETUP.md`.
- [ ] Ensure only public Supabase configuration is exposed at `/runtime-config.js`.
- [ ] Verify `CORS_ORIGINS` contains the deployed frontend origin.
- [ ] Set Supabase Auth redirect URLs, password recovery redirect URL, and Google OAuth callback URL.

## After deployment

- [ ] Verify `/api/health` returns `200`.
- [ ] Verify `/runtime-config.js` has non-empty public values but no service-role or provider keys.
- [ ] Confirm the served frontend bundle matches the intended deployment commit.
- [ ] Complete an authenticated learner sign-in and browser refresh.
- [ ] Submit one valid circuit mission twice: first call awards once, second call awards zero XP.
- [ ] Confirm profile, avatar, module progress, notification read state, and saved challenges persist after refresh.
- [ ] Confirm weekly leaderboard reads only display name, verified weekly XP, rank, and viewer flag.
- [ ] Confirm a learner cannot invoke admin endpoints, change roles, assign XP, or access another user’s profile/progress.
- [ ] Exercise an administrator contest creation/publication flow and a separate learner participation flow.
- [ ] Inspect Render logs for startup errors and missing configuration warnings.

## Explicit blockers

This workspace does not contain authorized Supabase/Render/quantum-provider credentials. No migration has been applied and no deployment has been performed by this work session.
