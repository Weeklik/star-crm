import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productsCatalogTable } from "@workspace/db";
import { requireAuth, requireOwner } from "../middlewares/requireAuth";
import { z } from "zod";

const router: IRouter = Router();

const ProductBody = z.object({
  origin:      z.string().max(200).optional().default(""),
  brand:       z.string().max(200).optional().default(""),
  model:       z.string().max(200).optional().default(""),
  description: z.string().max(1000).optional().default(""),
  unitPrice:   z.string().max(100).optional().default(""),
});

router.get("/products-catalog/brands", requireAuth, async (req, res): Promise<void> => {
  const q = ((req.query.q as string | undefined) ?? "").trim().toLowerCase();
  const rows = await db
    .selectDistinct({ brand: productsCatalogTable.brand })
    .from(productsCatalogTable)
    .orderBy(productsCatalogTable.brand);
  const brands = rows
    .map((r) => r.brand ?? "")
    .filter((b) => b && (!q || b.toLowerCase().includes(q)));
  res.json(brands);
});

router.get("/products-catalog/lookup", requireAuth, async (req, res): Promise<void> => {
  const brand = (req.query.brand as string | undefined)?.trim();
  if (!brand) { res.json([]); return; }
  const rows = await db
    .select()
    .from(productsCatalogTable)
    .where(eq(productsCatalogTable.brand, brand));
  res.json(rows);
});

router.get("/products-catalog", requireAuth, requireOwner, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(productsCatalogTable)
    .orderBy(productsCatalogTable.createdAt);
  res.json(rows);
});

router.post("/products-catalog", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const parsed = ProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db
    .insert(productsCatalogTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(row);
});

router.put("/products-catalog/:id", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = ProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db
    .update(productsCatalogTable)
    .set(parsed.data)
    .where(eq(productsCatalogTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/products-catalog/:id", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(productsCatalogTable).where(eq(productsCatalogTable.id, id));
  res.status(204).end();
});

router.post("/products-catalog/bulk", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "Expected non-empty array" });
    return;
  }
  const parsed = rows.map((r) => ProductBody.safeParse(r));
  const invalid = parsed.findIndex((p) => !p.success);
  if (invalid !== -1) {
    res.status(400).json({ error: `Row ${invalid + 1} is invalid` });
    return;
  }
  const values = parsed.map((p) => (p as { success: true; data: z.infer<typeof ProductBody> }).data);
  const inserted = await db.insert(productsCatalogTable).values(values).returning();
  res.status(201).json({ inserted: inserted.length });
});

export default router;
