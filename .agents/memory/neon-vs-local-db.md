---
name: Neon vs local DB
description: The API server uses NEON_DATABASE_URL when set; psql "$DATABASE_URL" goes to a different local DB — always run migrations against both or check which one the server uses first.
---

## Rule
Always run schema changes (ALTER TABLE, etc.) against `$NEON_DATABASE_URL` when it is set — that is the live database the API server reads. `$DATABASE_URL` is the local Postgres instance only used by psql by default.

**Why:** `lib/db/src/index.ts` resolves `process.env.NEON_DATABASE_URL || process.env.DATABASE_URL`. When NEON_DATABASE_URL is present (as a shared env var in this repl), ALL server queries hit Neon. Running `psql "$DATABASE_URL"` applies changes to the wrong database and the server keeps failing.

**How to apply:** For every raw SQL migration command, use:
```
psql "$NEON_DATABASE_URL" -c "ALTER TABLE ..."
```
Or run against both to keep local and Neon in sync:
```
psql "$DATABASE_URL" -c "ALTER TABLE ..."
psql "$NEON_DATABASE_URL" -c "ALTER TABLE ..."
```
