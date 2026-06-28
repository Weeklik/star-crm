import { Router, type IRouter } from "express";
import { and, eq, ilike, isNotNull } from "drizzle-orm";
import { db, customersTable, companiesTable, productsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { z } from "zod";

const router: IRouter = Router();

const TABLE_MAP = {
  customer: customersTable,
  company:  companiesTable,
  product:  productsTable,
} as const;

type LookupType = keyof typeof TABLE_MAP;

router.get("/lookup", requireAuth, async (req, res): Promise<void> => {
  const type = req.query["type"] as string;
  const q    = String(req.query["q"] ?? "").trim();

  if (!type || !(type in TABLE_MAP)) {
    res.status(400).json({ error: "type must be one of: customer, company, product" });
    return;
  }

  const table = TABLE_MAP[type as LookupType];

  const rows = q.length > 0
    ? await db
        .select({ name: table.name })
        .from(table)
        .where(ilike(table.name, `%${q}%`))
        .limit(10)
    : await db
        .select({ name: table.name })
        .from(table)
        .limit(10);

  res.json(rows.map((r) => r.name));
});

const CreateLookupBody = z.object({ name: z.string().min(1).max(200) });

router.post("/lookup", requireAuth, async (req, res): Promise<void> => {
  const type = req.query["type"] as string;
  if (!type || !(type in TABLE_MAP)) {
    res.status(400).json({ error: "type must be one of: customer, company, product" });
    return;
  }
  const parsed = CreateLookupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "name is required" }); return; }

  const table = TABLE_MAP[type as LookupType];
  const [row] = await db
    .insert(table)
    .values({ name: parsed.data.name.trim() })
    .onConflictDoUpdate({ target: table.name, set: { name: parsed.data.name.trim() } })
    .returning({ name: table.name });
  res.status(201).json({ name: row.name });
});

router.get("/lookup/regions", requireAuth, async (_req, res): Promise<void> => {
  // Use DISTINCT ON (country) to get one row per country, including that salesperson's currency
  const rows = await db
    .selectDistinctOn([usersTable.country], {
      country: usersTable.country,
      currency: usersTable.currency,
    })
    .from(usersTable)
    .where(and(eq(usersTable.role, "salesperson"), isNotNull(usersTable.country)));

  const regions = rows
    .filter((r): r is { country: string; currency: string | null } => !!r.country?.trim())
    .map((r) => ({ country: r.country as string, currency: r.currency ?? null }))
    .sort((a, b) => a.country.localeCompare(b.country));

  res.json(regions);
});

export default router;
