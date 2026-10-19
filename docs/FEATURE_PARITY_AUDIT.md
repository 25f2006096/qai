# QuantumLearn feature-parity audit

Baseline recorded: 2026-10-19

## Architecture

- Frontend: React 19, Vite, React Router, Chart.js, Monaco, and Supabase JS.
- Backend: FastAPI service in `quantum_backend/app`, served with the compiled frontend by the production Docker image.
- Data and auth: Supabase Auth and Postgres, with RLS-enabled public tables and browser authentication via a runtime configuration endpoint.
- External integrations: Groq AI tutor, IBM Quantum, qBraid, and local/supported Qiskit, Cirq, and PennyLane execution paths.
- Deployment: Render Docker web service, configured by `render.yaml`.

## Existing route inventory

| Route | Workflow | Dependencies | Preservation check |
| --- | --- | --- | --- |
| `/`, `/login`, `/register` | Email and Google authentication | Supabase Auth, runtime config | Manual auth test required |
| `/test` | Knowledge assessment/onboarding | Auth profile and question data | Frontend test coverage only |
| `/dashboard` | Learner overview, XP, quests, activity | Progress context, gamification API | Requires deployed schema and signed-in test |
| `/roadmap`, `/modules`, `/modules/:id` | Curriculum and lesson navigation | Module data, progress persistence | Route/build verified; journey test pending |
| `/circuit` | Circuit construction, simulation, verified missions | Quantum API, gamification API | Unit/API test pending after schema deployment |
| `/lab` | Quantum experiment workflows and visualizations | Quantum API and persistence | Route/build verified; provider test pending |
| `/skillmap`, `/achievements` | Skill progression and achievement history | Progress and gamification APIs | Requires deployed schema |
| `/race` | Quantum race workflows | Existing race UI/data | Must be audited before enhancements |
| `/contests`, contest detail/problem routes | Contest participation and submissions | Contest FastAPI routes, Supabase | Existing backend tests required |
| `/admin/*` | Protected administration/content and contest tools | Server-side admin authorization | Protected-route and role test required |
| `/instructor` | Instructor workspace redirect/role flow | Auth role and instructor data | Manual role test required |

## Existing gamification foundation

- The dashboard, achievement page, Circuit Builder, Quantum Lab, contests, and sidebar consume shared gamification state.
- FastAPI owns verified circuit-mission and contest reward requests; the browser does not submit XP amounts.
- `gamification_rewards` uses a user/activity uniqueness constraint for reward idempotency.
- The repository migration `supabase/migrations/15_gamification.sql` adds reward and achievement storage plus a server-only reward function.

## Baseline verification

| Check | Status | Date | Procedure/evidence | Result |
| --- | --- | --- | --- | --- |
| Frontend unit suite | **Unit verified** | 2026-10-19 | `npm.cmd test` | 20 passing tests. The output warns only that test-process Supabase values are absent. |
| Frontend production build | **Build verified** | 2026-10-19 | `npm.cmd run build` | Vite completed successfully and emitted the production bundle. This does not prove authenticated workflows. |
| Gamification backend unit tests | **Unit verified** | 2026-10-19 | From `quantum_backend`: `python -m pytest tests/test_gamification.py -q` | 2 passing tests. |
| Full backend suite | **Blocked** | 2026-10-19 | From `quantum_backend`: `python -m pytest tests -q` | The local Python 3.14 runtime crashes importing Cirq/gRPC. This is an environment compatibility issue, not a passing backend result. |
| Live runtime configuration | **Integration verified** | 2026-10-19 | Read-only request to `https://quantum-to3r.onrender.com/runtime-config.js` | Returned HTTP 200 with both browser Supabase values empty. It exposed no server-side secret. |
| Live gamification route | **Integration verified** | 2026-10-19 | Read-only unauthenticated request to `/api/gamification/summary` | Returned HTTP 401, demonstrating that the deployed route exists and rejects unauthenticated access. |
| Auth, learning, Circuit Builder, Lab, contest, race, admin journeys | **Manual verification required** | 2026-10-19 | Requires an authorized test account and correctly configured preview/production services | Not represented as verified by the build or unit tests. |

## Deployment provenance and release gate

- Intended source repository: `https://github.com/25f2006096/qfinal.git`.
- Intended branch: `main`.
- Intended commit: `7b1ec15` (`Implement gamification features`).
- Render service, deployed commit SHA, deployment timestamp, and build configuration: **not checked / pending workspace confirmation**.
- Evidence of mismatch: the current live bundle did not contain the expected XP/quest/achievement strings, while the live backend did expose the gamification API route.
- Runtime-config contract: `/runtime-config.js` may expose only browser-safe values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). It must never expose service-role, provider, or AI secrets.
- Release remains **blocked** until the intended SHA is confirmed as deployed, runtime configuration is non-empty and safe, migration 15 is approved/applied/verified, and the critical authenticated workflows are exercised.

## Migration 15 safety gate

Before any application of `15_gamification.sql`:

1. Confirm the exact target project and whether it is a non-production preview or production.
2. Review the SQL, dependent `profiles` columns, table ownership, RLS, grants, RPC execution privilege, and Data API exposure.
3. Test reward creation, duplicate reward requests, unauthorized requests, and concurrent requests in an approved non-production environment.
4. Record the outcome and recovery steps. The migration uses additive `IF NOT EXISTS` operations; recovery must nevertheless be planned before any production change.
5. Do not grant browser roles access to reward tables merely to make the UI work; the backend service role remains the writer.

## Competition preservation gate

Before extending race, contest, or multiplayer behavior, audit each workflow's schemas, APIs, timing, scoring, authorization, duplicate-submission handling, deadlines, and result persistence. Learning XP must remain separate from official competition results. Invalid, duplicate, expired, and unauthorized actions require dedicated tests.

## Backend runtime compatibility

- Supported backend runtime: **Python 3.12**, evidenced by `quantum_backend/Dockerfile` and `.github/workflows/ci.yml`.
- Local test runtime: Python 3.14, where importing the installed Cirq/gRPC stack causes a Windows fatal exception during the complete suite.
- Resolution: run the complete backend suite in a clean Python 3.12 environment matching CI/Docker before changing quantum-library versions or production runtime settings.

## Pre-existing production blockers

1. The Render deployment at `quantum-to3r.onrender.com` returns empty browser Supabase configuration. The service needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` configured server-side.
2. The deployed frontend bundle does not include the current XP/quest/achievement UI, although the live FastAPI gamification route is present. Render must deploy the latest intended repository and branch, then build with cache cleared.
3. The connected Supabase project does not yet contain `gamification_rewards`, `gamification_achievements`, or `award_gamification_reward`; migration 15 must be applied in an approved environment before verified rewards can work.
4. Supabase's current Data API behavior may require newly created public tables to be explicitly exposed and granted to the intended role. After applying migration 15, verify the backend service-role REST calls can reach the two gamification tables; keep browser `anon` and `authenticated` access revoked.

## Implementation rules

- Keep Supabase and FastAPI as the single authority for rewards, achievement unlocks, streaks, and competition scoring.
- Do not expose service-role, provider, or AI secrets to the browser.
- Keep Circuit Builder, Lab, contest, race, and admin routes available independently of optional game features.
- Every enhancement must have an actual underlying activity, clear error state, and a non-destructive migration path.

## Status legend

- **Verified:** frontend test/build passed.
- **Manual verification required:** needs authenticated user, authorized provider, or safe deployment environment.
- **Blocked:** requires deployment configuration or approved database migration.
