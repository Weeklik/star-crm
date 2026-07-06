import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, leadsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { z } from "zod";

const router: IRouter = Router();

const LeadBody = z.object({
  leadSource:        z.string().min(1),
  dateTime:          z.string().min(1),
  customerName:      z.string().min(1),
  companyName:       z.string().nullish(),
  mobileCountryCode: z.string().default("+971"),
  mobileNumber:      z.string().min(1),
  email:             z.string().nullish(),
  region:            z.string().min(1),
  brand:             z.string().min(1),
  model:             z.string().min(1),
  closure:           z.string().min(1),
  notes:             z.string().nullish(),
  assignedToId:      z.number().int().positive(),
  leadStatus:        z.string().min(1).default("New"),
  nextFollowUpDate:  z.string().min(1),
  followUpRemarks:   z.string().nullish(),
});

router.get("/leads", requireAuth, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id:               leadsTable.id,
        leadSource:       leadsTable.leadSource,
        dateTime:         leadsTable.dateTime,
        customerName:     leadsTable.customerName,
        companyName:      leadsTable.companyName,
        mobileCountryCode:leadsTable.mobileCountryCode,
        mobileNumber:     leadsTable.mobileNumber,
        email:            leadsTable.email,
        region:           leadsTable.region,
        brand:            leadsTable.brand,
        model:            leadsTable.model,
        closure:          leadsTable.closure,
        notes:            leadsTable.notes,
        assignedToId:     leadsTable.assignedToId,
        assignedToName:   usersTable.name,
        leadStatus:       leadsTable.leadStatus,
        nextFollowUpDate: leadsTable.nextFollowUpDate,
        followUpRemarks:  leadsTable.followUpRemarks,
        createdById:      leadsTable.createdById,
        createdAt:        leadsTable.createdAt,
      })
      .from(leadsTable)
      .leftJoin(usersTable, eq(leadsTable.assignedToId, usersTable.id))
      .orderBy(desc(leadsTable.createdAt));
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

router.post("/leads", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const parsed = LeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  try {
    const [lead] = await db
      .insert(leadsTable)
      .values({ ...parsed.data, dateTime: new Date(parsed.data.dateTime), createdById: user.id })
      .returning();
    res.status(201).json(lead);
  } catch {
    res.status(500).json({ error: "Failed to create lead" });
  }
});

router.put("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = LeadBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  try {
    const data: any = { ...parsed.data };
    if (data.dateTime) data.dateTime = new Date(data.dateTime);
    const [lead] = await db.update(leadsTable).set(data).where(eq(leadsTable.id, id)).returning();
    if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
    res.json(lead);
  } catch {
    res.status(500).json({ error: "Failed to update lead" });
  }
});

router.delete("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(leadsTable).where(eq(leadsTable.id, id));
  res.status(204).send();
});

export default router;
