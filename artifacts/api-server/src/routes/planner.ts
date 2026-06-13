import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, plannerMeetingsTable, plannerTargetsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { z } from "zod";

const router: IRouter = Router();

function formatDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split("T")[0];
  return String(val);
}

function formatMeeting(m: any) {
  return { ...m, date: formatDate(m.date) };
}

// Helper: resolve which salesperson ID to use for a given request.
// Owners may pass ?salespersonId=N to view/manage another person's data.
// 0 is returned when the owner wants to see ALL (no filter).
function resolveSpId(user: any, querySp: unknown): number {
  if (user.role === "owner" && querySp !== undefined && querySp !== "") {
    return Number(querySp) || 0;
  }
  if (user.role === "owner") return 0; // 0 = all
  return user.id; // salesperson always sees own
}

// ── Meetings ────────────────────────────────────────────────────────────────

router.get("/planner/meetings", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const { year, month, salespersonId } = req.query;
  const y = Number(year);
  const mo = Number(month);
  if (!y || !mo || mo < 1 || mo > 12) {
    res.status(400).json({ error: "year and month (1-12) are required" });
    return;
  }

  const start  = `${y}-${String(mo).padStart(2, "0")}-01`;
  const end    = new Date(y, mo, 0);
  const endStr = `${y}-${String(mo).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

  const spId = resolveSpId(user, salespersonId);

  const rows = await db
    .select()
    .from(plannerMeetingsTable)
    .where(spId > 0 ? eq(plannerMeetingsTable.salespersonId, spId) : undefined);

  const filtered = rows.filter((r) => {
    const d = formatDate(r.date)!;
    return d >= start && d <= endStr;
  });

  res.json(filtered.map(formatMeeting));
});

const CreateMeetingBody = z.object({
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  companyName:     z.string().min(1),
  productName:     z.string().optional(),
  meetingTime:     z.string().optional(),
  location:        z.string().optional(),
  notes:           z.string().optional(),
  salespersonId:   z.number().int().positive().optional(), // owner may specify a target SP
});

router.post("/planner/meetings", requireAuth, async (req, res): Promise<void> => {
  const user   = (req as any).user;
  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { date, companyName, productName, meetingTime, location, notes, salespersonId } = parsed.data;

  // Owner may create a meeting on behalf of a salesperson
  const targetSpId = (user.role === "owner" && salespersonId) ? salespersonId : user.id;

  const [row] = await db
    .insert(plannerMeetingsTable)
    .values({ salespersonId: targetSpId, date, companyName, productName, meetingTime, location, notes })
    .returning();
  res.status(201).json(formatMeeting(row));
});

const UpdateMeetingBody = z.object({
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  companyName: z.string().min(1).optional(),
  productName: z.string().optional().nullable(),
  meetingTime: z.string().optional().nullable(),
  location:    z.string().optional().nullable(),
  notes:       z.string().optional().nullable(),
});

router.put("/planner/meetings/:id", requireAuth, async (req, res): Promise<void> => {
  const user   = (req as any).user;
  const id     = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "invalid id" }); return; }

  const parsed = UpdateMeetingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Owner can edit any meeting; salesperson only their own
  const existing = await db.select().from(plannerMeetingsTable).where(
    user.role === "owner"
      ? eq(plannerMeetingsTable.id, id)
      : and(eq(plannerMeetingsTable.id, id), eq(plannerMeetingsTable.salespersonId, user.id)),
  );
  if (!existing.length) { res.status(404).json({ error: "not found" }); return; }

  const [updated] = await db
    .update(plannerMeetingsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(plannerMeetingsTable.id, id))
    .returning();
  res.json(formatMeeting(updated));
});

router.delete("/planner/meetings/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const id   = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "invalid id" }); return; }

  // Owner can delete any meeting; salesperson only their own
  await db.delete(plannerMeetingsTable).where(
    user.role === "owner"
      ? eq(plannerMeetingsTable.id, id)
      : and(eq(plannerMeetingsTable.id, id), eq(plannerMeetingsTable.salespersonId, user.id)),
  );
  res.status(204).end();
});

// ── Targets ─────────────────────────────────────────────────────────────────

router.get("/planner/targets", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const year = Number(req.query.year);
  if (!year) { res.status(400).json({ error: "year is required" }); return; }

  const spId = resolveSpId(user, req.query.salespersonId);
  // For targets, if owner sends no salespersonId return empty (frontend always passes one)
  if (spId === 0) { res.json([]); return; }

  const rows = await db
    .select()
    .from(plannerTargetsTable)
    .where(
      and(
        eq(plannerTargetsTable.salespersonId, spId),
        eq(plannerTargetsTable.year, year),
      ),
    );
  res.json(rows);
});

const UpsertTargetBody = z.object({
  expectedSales:  z.number().int().min(0),
  salesDone:      z.number().int().min(0),
  salespersonId:  z.number().int().positive().optional(), // owner may specify
});

router.put("/planner/targets/:year/:month", requireAuth, async (req, res): Promise<void> => {
  const user  = (req as any).user;
  const year  = Number(req.params.year);
  const month = Number(req.params.month);
  if (!year || !month || month < 1 || month > 12) {
    res.status(400).json({ error: "invalid year/month" });
    return;
  }

  const parsed = UpsertTargetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { expectedSales, salesDone, salespersonId } = parsed.data;
  const targetSpId = (user.role === "owner" && salespersonId) ? salespersonId : user.id;

  const [row] = await db
    .insert(plannerTargetsTable)
    .values({ salespersonId: targetSpId, year, month, expectedSales, salesDone })
    .onConflictDoUpdate({
      target: [plannerTargetsTable.salespersonId, plannerTargetsTable.year, plannerTargetsTable.month],
      set: { expectedSales, salesDone, updatedAt: new Date() },
    })
    .returning();
  res.json(row);
});

export default router;
