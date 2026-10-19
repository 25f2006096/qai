# QuantumLearn feature completion matrix

Last updated: 2026-10-19. This matrix excludes deployment and live Supabase operations at the user's request. A feature that requires cross-device persistence is not reported as verified without that environment.

| Feature | Location | Status | Evidence / remaining acceptance criterion |
| --- | --- | --- | --- |
| Authentication and protected routes | `src/context/AuthContext.jsx`, `src/App.jsx` | Implemented but unverified | Supabase Auth workflow needs an authorized browser session. |
| Dashboard and roadmap | `src/pages/Dashboard`, `src/pages/Roadmap` | Implemented but unverified | Build passes; authenticated data loading remains unverified. |
| Curriculum and knowledge assessment | `src/pages/Module`, `src/pages/KnowledgeTest` | Partially implemented | Local progression exists; cross-device persistence excluded. |
| XP, levels, and ranks | `gamification_service.py`, `src/utils/gamification.js` | Unit verified | Shared level formula and rank titles are covered by frontend/backend tests. |
| Secure reward issuance | `gamification.py`, migration 15 | Partially implemented | Server validates two circuit missions and contest rewards; live database verification excluded. |
| Daily quests and achievements | gamification summary, dashboard | Implemented but unverified | Uses server summary; daily quest persistence needs excluded database environment. |
| Weekly leaderboard | migration 16, gamification API, dashboard | Implemented but unverified | Server-owned aggregation is coded; migration application intentionally excluded. |
| World Map and story chapters | `src/utils/worldMap.js`, `src/pages/WorldMap` | Unit verified | Seven chapters cover modules 1–24 exactly once; 3 focused tests pass. |
| Skill Map and accessible Skill Tree | `SkillMap.jsx`, `skillTree.js` | Unit verified | Tree maps real curriculum modules and prerequisite estimates; verified evidence persistence remains excluded. |
| Circuit Builder and local simulation | `CircuitBuilder.jsx`, `quantum.js` | Unit verified | Gate/state tests pass; provider-backed workflow needs environment verification. |
| Verified circuit missions | gamification router/tests | Unit verified | Exact superposition and Bell circuit order is server-validated; reward persistence excluded. |
| Quantum Lab and visualizations | `QuantumLab.jsx`, `BlochSphere.jsx` | Implemented but unverified | Build passes; configured provider testing is outstanding. |
| Quantum Race | `QuantumRace.jsx` | Implemented but unverified | Correctly labelled educational operation-count visualizer, not multiplayer competition. |
| Contests and admin contest management | contest/admin routers and pages | Implemented but unverified | Requires authenticated database-backed contest workflow. |
| AI mentor | `AITutor.jsx`, `aiTutor.js` | Partially implemented | Input cleanup/unit coverage exists; live provider key deliberately not tested. |
| Profile/avatar, notifications, artifacts, history, calendar, weekly events | related UI/storage absent or partial | Not implemented | Require a persistence design and authorized database verification; excluded by scope. |
| Circuit Repair Mission | `CircuitBuilder.jsx`, gamification router | Implemented but unverified | Guided faulty-X scenario loads into the existing editor; a learner must repair it to the exact server-validated superposition circuit before the existing idempotent reward path can succeed. Authenticated persistence is excluded. |
| Boss battles | Circuit Builder/gamification | Not implemented | Need multi-stage server validators, attempt state, and durable reward policy. |
| Instructor workspace | `InstructorDashboard.jsx` | Implemented but unverified | Role/data scope requires authorized workflow. |
| Accessibility, responsive UI, error handling | shared styles/pages | Partially implemented | Semantics and responsive rules exist; systematic keyboard/manual audit remains. |
| Frontend automated tests | `src/**/*.test.js` | Unit verified | 26 tests passed on 2026-10-19. |
| Backend automated tests | `quantum_backend/tests` | Partially verified | Focused gamification tests pass; full suite requires Python 3.12, not installed. |

## Excluded work

- Applying or verifying Supabase migrations and RLS.
- Runtime configuration, Render changes, or production deployment.
- Claims of persistence, Google OAuth, provider, or end-to-end verification without an authorized environment.
