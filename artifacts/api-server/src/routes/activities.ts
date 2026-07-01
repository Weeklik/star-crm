import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, activitiesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { z } from "zod";

const router: IRouter = Router();

const createActivitySchema = z.object({
  date: z.string(),
  time: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  locationName: z.string().optional(),
  company: z.string().optional(),
  product: z.string().optional(),
  meetingPerson: z.string().optional(),
});

router.get("/activities", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  try {
    let rows;
    if (user.role === "owner") {
      rows = await db
        .select()
        .from(activitiesTable)
        .orderBy(desc(activitiesTable.createdAt));
    } else {
      rows = await db
        .select()
        .from(activitiesTable)
        .where(eq(activitiesTable.salespersonId, user.id))
        .orderBy(desc(activitiesTable.createdAt));
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

router.post("/activities", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const parsed = createActivitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  try {
    const [row] = await db
      .insert(activitiesTable)
      .values({
        salespersonId: user.id,
        date: data.date,
        time: data.time,
        latitude: String(data.latitude),
        longitude: String(data.longitude),
        locationName: data.locationName ?? null,
        company: data.company ?? null,
        product: data.product ?? null,
        meetingPerson: data.meetingPerson ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create activity" });
  }
});

export default router;
