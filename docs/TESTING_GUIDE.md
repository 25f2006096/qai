# Local testing guide

Run from the repository root:

```powershell
npm.cmd test
npm.cmd run build
```

Run focused backend gamification tests from `quantum_backend`:

```powershell
python -m pytest tests\test_gamification.py -q
```

The full backend suite requires Python 3.12, matching `quantum_backend/Dockerfile`. The current workstation has Python 3.14 only and no Docker installation, so a full run is blocked rather than treated as a pass.

Database, authentication, provider, and deployment verification are intentionally outside the current scope because Supabase and deployment work were excluded.
