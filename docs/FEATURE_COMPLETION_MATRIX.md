# QuantumLearn feature completion matrix

Last updated: 2026-10-19

**Status terms:** *Implemented and verified* means verified locally through automated tests or a real local browser workflow. *Implemented but unverified* means code exists but requires Supabase, credentials, or an approved deployed environment. *Blocked by configuration* identifies missing external configuration, not a completed workflow.

| Feature | Primary location | Frontend | Backend / database | Tests and verification | Status / exact blocker |
| --- | --- | --- | --- | --- | --- |
| Email/password auth, protected routes, refresh, logout | `AuthContext.jsx`, `App.jsx`, Landing | Implemented | Supabase Auth | Public redirect E2E passed; auth E2E skipped | Implemented but unverified — requires Supabase config + test learner |
| Google OAuth | `AuthContext.jsx` | Implemented | Supabase provider config | Not executable locally | Blocked by configuration — provider client and redirect URL need configuration |
| Password recovery/update | `AuthContext.jsx`, `LandingPage.jsx` | Implemented | Supabase Auth recovery | Build/test verified | Implemented but unverified — needs a configured auth project/email delivery |
| Profile, preferences, avatar | `Profile.jsx`, `storage.js` | Implemented | Existing profile RPC/Auth metadata/avatar storage | Build/test verified | Implemented but unverified — avatar bucket/RLS and persistence need live validation |
| Learning progress / assessments | `ProgressContext.jsx`, `storage.js` | Implemented | Supabase progress tables/RPCs | Existing unit coverage/build | Implemented but unverified — needs authenticated persistence journey |
| RLS / profile authorization | migrations 02/04 | Configured in SQL | RLS and narrow profile RPCs | Static review only | Blocked by configuration — must test against approved Supabase project |
| Trusted XP, levels, ranks | `gamification_service.py`, migration 15 | Displayed | SQL reward RPC is authoritative | Level and mission unit tests pass | Implemented but unverified — migration 15 must be applied |
| Rewards / duplicate prevention | migration 15/17 | No client XP input | Unique reward constraint and service-role RPC | Static/unit behavior verified | Implemented but unverified — concurrency test needs test database |
| Daily + weekly quests | `gamification_service.py`, `Dashboard.jsx` | Implemented | Derived from trusted reward history | Build verified | Implemented but unverified — quest persistence/reward policy needs migration/live test |
| Streaks / streak calendar | existing profile/activity UI | Displayed | Existing profile fields; new logic not yet migrated | Not end-to-end tested | Partially implemented — trusted streak-update rules require approved schema/RPC work |
| Achievements | `Achievements.jsx`, service catalogue, migration 15/17 | Implemented | SQL award flow | Build/unit verified | Implemented but unverified — migration 15/17 required |
| Notifications | `Notifications.jsx`, notification router, migration 17 | Implemented | RLS notification table prepared | Build verified | Blocked by authorization — migration 17 not applied |
| Reward/activity history | dashboard + gamification service | Implemented | Derived from reward records | Build verified | Implemented but unverified — reward table required |
| World Map | `WorldMap.jsx`, `worldMap.js` | Implemented | Based on persisted modules | 3 focused unit tests pass | Implemented and verified locally |
| Skill Tree / adaptive recommendations | `SkillMap.jsx`, `skillTree.js`, `adaptive.js` | Implemented | Evidence derives from saved progress | Focused unit tests pass | Implemented and verified locally for deterministic rules; live evidence unverified |
| Circuit Builder and simulator | `CircuitBuilder.jsx`, `quantum.js` | Implemented | Local simulator + protected backend execution | Quantum unit/API tests and E2E Qiskit execution pass | Implemented and verified locally |
| Circuit repair missions | `CircuitBuilder.jsx`, gamification router | Three guided scenarios | Server validates target operations | Backend mission test passes | Implemented and verified locally; XP persistence awaits migration |
| Boss battles / save-resume | `CircuitBuilder.jsx`, migration 17 | Bell + GHZ boss workflows | Saved challenge table prepared | Build verified | Partially implemented — durable resume blocked pending migration 17 |
| Quantum Lab | `QuantumLab.jsx` | Existing controls/presets/results | Local/back-end execution paths | Backend framework tests pass | Implemented and verified locally for frameworks; hardware/provider state unverified |
| Qiskit, Cirq, PennyLane | backend execution services | Exposed through Lab/API | Tested local execution | 41 backend tests pass | Implemented and verified locally |
| IBM Quantum / qBraid | `ibm_service.py`, `qbraid_service.py` | Existing UI | Provider secrets required | Failure paths covered; no real credential | Blocked by configuration |
| Weekly leaderboard | migration 16, API/dashboard | Implemented | Server-owned Postgres aggregation | Build verified | Blocked by authorization — migration 16 needs approved application |
| Quantum Race | `QuantumRace.jsx` | Implemented | Educational visualizer only | Build verified | Implemented but unverified — manual assumptions review remains |
| Contest learner/admin workflows | contests/admin routers/pages | Implemented | Server-side scoring, roles | Backend tests pass | Implemented but unverified — requires Supabase contest data + test roles |
| Weekly events | quest/contest infrastructure | No dedicated UI | No event data model | None | Not implemented — should reuse contest/challenge infrastructure after product rules are approved |
| AI mentor | `AITutor.jsx`, Supabase Edge Function | Implemented with safe fallback | Groq secret remains server-side | Content-cleaning unit tests pass | Implemented but unverified — live provider key/function needed |
| Instructor workspace | `InstructorDashboard.jsx` | Implemented | Existing role and RPC design | Build/backend admin tests | Implemented but unverified — authorized instructor test required |
| Admin dashboard | `AdminPanel.jsx`, admin router | Implemented | Role-validated operations | 8 admin backend tests pass | Implemented and verified locally for API tests; database/RLS integration remains unverified |
| Accessibility/responsiveness | shared pages/styles | Partial | N/A | Basic semantic controls exist | Partially implemented — manual keyboard/mobile audit required |
| Frontend tests | `src/**/*.test.js` | N/A | N/A | **26 passed** | Implemented and verified locally |
| Backend tests | `quantum_backend/tests` | N/A | N/A | **41 passed** | Implemented and verified locally |
| Public E2E | `tests/e2e` | N/A | Local FastAPI/Vite | **4 passed** | Implemented and verified locally |
| Authenticated E2E | `tests/e2e` | N/A | Requires Supabase test account | **8 skipped** | Blocked by configuration — `E2E_EMAIL` and `E2E_PASSWORD` absent |
| Render production runtime | `render.yaml`, Dockerfile | N/A | Requires Render access | Not deployed/tested | Blocked by authorization |

## Migration / external-service gate

No database migration was applied and no production deployment was performed in this work session. Apply migrations only in an approved Supabase environment after reading `DATABASE_MIGRATIONS.md`. Use `DEPLOYMENT_CHECKLIST.md` before a Render release.
