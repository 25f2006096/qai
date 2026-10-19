# Database migrations

## Application order

1. `01_init_schema.sql`
2. `02_rls_policies.sql`
3. `03_*` through `14_*` according to their existing deployment history
4. `15_gamification.sql`
5. `16_gamification_leaderboard.sql`
6. `17_notifications_and_challenges.sql`

## Status in this workspace

| Migration | Purpose | Repository status | Applied environment status |
| --- | --- | --- | --- |
| 01–14 | Core profiles, learning records, contest/admin/instructor structures | Present | Not verified from this workspace |
| 15 | Trusted reward records, achievements, idempotent reward RPC | Present | Not verified; live configuration unavailable |
| 16 | Privacy-safe weekly verified-XP leaderboard RPC | Present | Not verified; must follow migration 15 |
| 17 | Notifications, saved challenge state, GHZ mission reward extension | Prepared | Not applied; authorization required |

## Review requirements

- Use an isolated Supabase preview/test project first.
- Confirm `auth.users`, `profiles`, and gamification tables exist before applying migrations 15–17.
- Check RLS policies and grant surface after applying the migration.
- Verify that `anon` and `authenticated` cannot insert into `gamification_rewards` or `gamification_achievements`.
- Run parallel reward requests using a test learner. Exactly one reward should be inserted for the same `(user_id, event_key)`.
- For migration 17, verify learners can only read/update their own notifications and saved challenge rows.
- Do not apply migration 17 to production without approval and a rollback/incident plan.
