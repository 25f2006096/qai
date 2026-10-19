# QuantumLearn AI environment setup

Never commit real credential values. Configure values in the local environment, Render service settings, or Supabase Edge Function secrets as appropriate.

## Frontend (browser-safe only)

The unified FastAPI deployment serves `/runtime-config.js`, which exposes only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Optional local development value: `VITE_QUANTUM_API_URL`

The `SUPABASE_SERVICE_ROLE_KEY`, AI-provider keys, or quantum-provider credentials must **never** be present in a Vite `.env` file, `runtime-config.js`, browser network response, or client bundle.

## FastAPI / Render environment

Required for authenticated persistence and trusted gamification:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional integrations:

- `GROQ_API_KEY` — server or Supabase Edge Function only.
- `IBM_QUANTUM_API_KEY`
- `IBM_QUANTUM_INSTANCE`
- `QBRAID_API_KEY`
- `CORS_ORIGINS` — comma-separated deployed frontend origins.

The deployed Docker image uses Python 3.12. Local tests were successfully run in the workspace Python 3.14 virtual environment; deployment remains pinned to the Dockerfile’s Python 3.12 for dependency compatibility.

## Supabase configuration

1. Configure the Supabase Auth redirect URLs for the deployed application origin and local development origin.
2. Enable Google Auth and supply its client credentials only if Google login is required.
3. Apply migrations in numeric order, including reviewed migrations `15_gamification.sql`, `16_gamification_leaderboard.sql`, and `17_notifications_and_challenges.sql`.
4. Verify RLS remains enabled and browser roles cannot read or write reward tables.
5. Ensure Storage bucket `avatars` is configured with owner-only policies before enabling custom avatar uploads.
6. Configure `GROQ_API_KEY` in Supabase Edge Function secrets for `ai-tutor` if live AI mentor responses are required.

## Test accounts

For authenticated Playwright workflows, set these process environment variables without committing them:

- `E2E_EMAIL`
- `E2E_PASSWORD`

Use a dedicated non-production learner account. The tests do not create or alter production users.
