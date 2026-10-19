# Testing guide

## Local prerequisites

- Node.js 24+ with dependencies installed via `npm ci`.
- Workspace `.venv` with backend dependencies installed.
- The repository `pytest.ini` configures Python imports so backend tests run from the repository root.

## Automated checks

Run from the repository root:

```powershell
npm test -- --run
npm run build
.venv\Scripts\python -m pytest
```

Latest local result (2026-10-19):

| Check | Result |
| --- | --- |
| Frontend unit tests | 26 passed |
| Frontend production build | Passed |
| Backend unit/API tests | 41 passed |

The backend suite covers Qiskit, Cirq, PennyLane, quantum API controls, admin authorization, contests, health behavior, and circuit mission validation.

## Local Playwright E2E

Start the FastAPI service in one terminal:

```powershell
Push-Location quantum_backend
..\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Start Vite in a second terminal:

```powershell
npm run dev -- --host 127.0.0.1 --port 5174
```

Run Playwright:

```powershell
npm run test:e2e
```

Latest local result (2026-10-19): **4 passed, 8 skipped**. The passed tests verify public landing/auth routing and live local FastAPI health, capability, and Qiskit execution endpoints. The eight authenticated journeys are intentionally skipped because `E2E_EMAIL` and `E2E_PASSWORD` were not configured. See `ENVIRONMENT_SETUP.md` for safe test-account setup.

## Required authenticated E2E checks

Once a dedicated non-production Supabase account and public runtime configuration exist, set `E2E_EMAIL` and `E2E_PASSWORD` only in the terminal session and re-run Playwright. Then execute the following manually or automate them against non-production:

1. Email registration/login, refresh, logout, password recovery, and Google OAuth callback.
2. Profile edits and avatar selection/upload persistence.
3. Lesson completion, assessment attempt, progress restoration across refresh/session.
4. Valid circuit mission, duplicate mission retry, XP/achievement/quest/streak updates, and leaderboard update.
5. Challenge save/resume after applying migration 17.
6. Notification creation/read-state persistence.
7. Learner denial of arbitrary XP, cross-user records, admin routes, and contest modification.
8. Admin contest creation/publication, learner submission, server-side scoring, and one-time reward claim.
9. Live provider failure states when Groq/IBM/qBraid credentials are absent and successful calls when configured.

Never run these against production user data without approval.
