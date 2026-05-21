import { Router, type IRouter } from "express";
import { and, eq, ilike, isNotNull } from "drizzle-orm";
import { db, customersTable, companiesTable, productsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

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

router.get("/lookup/regions", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .selectDistinct({ country: usersTable.country })
    .from(usersTable)
    .where(and(eq(usersTable.role, "salesperson"), isNotNull(usersTable.country)));

  const regions = rows
    .map((r) => r.country)
    .filter((r): r is string => !!r && r.trim().length > 0)
    .sort();

  res.json(regions);
});

export default router;
