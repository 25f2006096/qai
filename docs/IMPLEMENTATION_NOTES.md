# QuantumLearn AI implementation notes

Last updated: 2026-10-19

## Completed local implementation

### Authentication and learner profiles

- Added a password recovery request and recovery-session password update workflow through Supabase Auth in `src/context/AuthContext.jsx` and `src/pages/Landing/LandingPage.jsx`.
- Added a protected `/profile` route with persistent display-name, goal, education, cosmetic-avatar, custom-avatar upload, XP/rank, modules, badge, and activity views.
- Profile updates use existing narrow Supabase RPC (`update_my_profile`) for profile fields and Supabase Auth user metadata for education and learning goal. No XP, roles, or achievement state can be changed by this flow.

### Gamification and challenges

- Expanded the server-known mission catalogue with a GHZ-state mission and safe, deterministic validation for `H(q0) → CNOT(q0,q1) → CNOT(q0,q2)`.
- Added broken-Bell and GHZ repair scenarios plus the GHZ Overlord boss battle to the existing Circuit Builder. Reward claims remain subject to FastAPI and database validation.
- Extended the client/server gamification presentation with weekly quest progress and a reward history feed.
- Extended the achievement catalogue with stable identifiers for circuit, XP, streak, and mission milestones. The database migration owns actual achievement grants.

### Notifications and persistence preparation

- Added an authenticated FastAPI notification API and a protected `/notifications` UI for persistent, read/unread notifications.
- Prepared additive migration `17_notifications_and_challenges.sql`. It creates RLS-protected notifications and saved-challenges storage, indexes them, extends the trusted reward function with the GHZ mission, and creates notifications only after a successful, non-duplicate reward operation.

### Test reliability

- Added root `pytest.ini`, making `python -m pytest` resolve `quantum_backend/app` rather than the legacy root `app.py`.
- Added a backend test hook and extended mission tests to cover GHZ validation.

## Architecture and safety decisions

- Browser code never sends an XP amount: it submits a mission activity; the database reward function owns reward amounts, uniqueness, XP updates, and qualified achievement creation.
- Added database objects use RLS and ownership policies. User-authenticated notification writes are not granted; trusted backend code is the writer.
- Migration 17 is additive. It must not be applied directly to production without preview validation and authorization.
- AI tutor responses remain explanatory only. They do not grant rewards or complete missions.

## Live-environment constraints

The local workspace has no configured Supabase project, E2E learner account, Google OAuth client, Groq key, IBM Quantum credential, qBraid credential, or Render deployment permission. Those workflows remain explicitly unverified; no claim of live authentication, persistence, provider execution, or production deployment is made.
