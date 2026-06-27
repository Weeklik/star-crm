---
name: Two database connections — NEON_DATABASE_URL vs DATABASE_URL
description: The API server uses NEON_DATABASE_URL (Neon.tech), not DATABASE_URL (Replit Postgres). Always run migrations against NEON_DATABASE_URL.
---

## Rule
All DB migrations (`ALTER TABLE`, seed scripts, schema checks) must run against `NEON_DATABASE_URL`, not `DATABASE_URL`.

**Why:** The `lib/db/src/index.ts` module reads `NEON_DATABASE_URL` exclusively. `DATABASE_URL` points to a separate Replit-provisioned PostgreSQL instance that the application never connects to. Running `ALTER TABLE` against `DATABASE_URL` appears to succeed but has zero effect on what the server sees.

**How to apply:**
- `psql "$NEON_DATABASE_URL" -c "ALTER TABLE ..."` — correct
- `psql "$DATABASE_URL" -c "ALTER TABLE ..."` — wrong, silently does nothing useful
- To verify columns: `psql "$NEON_DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='deals';"`
