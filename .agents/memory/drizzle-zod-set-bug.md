---
name: Drizzle set() with Zod optional types
description: Drizzle ORM's update().set() silently does nothing when passed a Zod-inferred object whose fields are .optional() — the UPDATE runs, returns 200, but no columns are changed in the DB.
---

## The Rule
Never pass a Zod `safeParse` result's `.data` directly to Drizzle's `update().set()` when the schema uses `.optional()` fields. The Drizzle set() method silently produces no SET clauses and the UPDATE becomes a no-op.

**Why:** Drizzle's internal column-mapping logic does not recognize the optional-field typing from Zod-inferred objects under certain runtime conditions — the keys are present but Drizzle generates empty SQL SET. This was confirmed by raw SQL working correctly while `set(body.data)` did not update the DB even though the PATCH returned 200.

**How to apply:** For any PATCH/UPDATE route that receives a Zod-parsed body, use Drizzle's `sql` template tag for raw parameterized SQL instead of `set(body.data)`:

```ts
import { sql } from "drizzle-orm";

const result = await db.execute(sql`
  UPDATE table
  SET col1 = ${val1}, col2 = ${val2}
  WHERE id = ${id}
  RETURNING col1, col2, ...
`);
const updated = result.rows[0];
```

Raw SQL is confirmed working (direct DB tests showed `UPDATE 1` and correct values returned).
