import { Router, type IRouter } from "express";
import { eq, and, gte, lte, type SQL } from "drizzle-orm";
import { db, dealsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  ListDealsQueryParams,
  ListDealsResponse,
  CreateDealBody,
  GetDealParams,
  GetDealResponse,
  UpdateDealParams,
  UpdateDealBody,
  UpdateDealResponse,
  DeleteDealParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatDeal(deal: any) {
  return {
    ...deal,
    agreedAmount: parseFloat(deal.agreedAmount ?? "0"),
    receivedAmount: parseFloat(deal.receivedAmount ?? "0"),
    outstandingAmount: parseFloat(deal.outstandingAmount ?? "0"),
    progress: deal.progress ?? 0,
    vatApplicable: deal.vatApplicable ?? false,
    dealStartDate:
      deal.dealStartDate instanceof Date
        ? deal.dealStartDate.toISOString().split("T")[0]
        : deal.dealStartDate,
    earliestClosingDate:
      deal.earliestClosingDate instanceof Date
        ? deal.earliestClosingDate.toISOString().split("T")[0]
        : deal.earliestClosingDate,
    latestClosingDate:
      deal.latestClosingDate instanceof Date
        ? deal.latestClosingDate.toISOString().split("T")[0]
        : deal.latestClosingDate,
  };
}

router.get("/deals", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const parsed = ListDealsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { salespersonId, stage, startDate, endDate } = parsed.data;

  const conditions: SQL[] = [];

  if (user.role !== "owner") {
    conditions.push(eq(dealsTable.salespersonId, user.id));
  } else if (salespersonId) {
    conditions.push(eq(dealsTable.salespersonId, salespersonId));
  }

  if (stage) {
    conditions.push(eq(dealsTable.stage, stage));
  }

  if (startDate) {
    conditions.push(gte(dealsTable.dealStartDate, startDate as unknown as string));
  }

  if (endDate) {
    conditions.push(lte(dealsTable.dealStartDate, endDate as unknown as string));
  }

  const deals =
    conditions.length > 0
      ? await db
          .select()
          .from(dealsTable)
          .where(and(...conditions))
          .orderBy(dealsTable.createdAt)
      : await db.select().from(dealsTable).orderBy(dealsTable.createdAt);

  res.json(ListDealsResponse.parse(deals.map(formatDeal)));
});

router.post("/deals", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const parsed = CreateDealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const [deal] = await db
    .insert(dealsTable)
    .values({
      salespersonId: user.id,
      dealStartDate: data.dealStartDate as unknown as string,
      name: data.name,
      companyName: data.companyName,
      productItem: data.productItem,
      stage: data.stage,
      progress: data.progress,
      salesStatus: data.salesStatus,
      vatApplicable: data.vatApplicable,
      agreedAmount: String(data.agreedAmount),
      receivedAmount: String(data.receivedAmount),
      outstandingAmount: String(data.outstandingAmount),
      earliestClosingDate: data.earliestClosingDate as unknown as string | undefined,
      latestClosingDate: data.latestClosingDate as unknown as string | undefined,
      notes: data.notes ?? null,
    })
    .returning();

  res.status(201).json(GetDealResponse.parse(formatDeal(deal)));
});

router.get("/deals/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetDealParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deal] = await db
    .select()
    .from(dealsTable)
    .where(eq(dealsTable.id, params.data.id));

  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  if (user.role !== "owner" && deal.salespersonId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(GetDealResponse.parse(formatDeal(deal)));
});

router.patch("/deals/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateDealParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(dealsTable)
    .where(eq(dealsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  if (user.role !== "owner" && existing.salespersonId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = UpdateDealBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  const d = body.data;
  if (d.dealStartDate !== undefined)
    updateData.dealStartDate = d.dealStartDate as unknown as string;
  if (d.name !== undefined) updateData.name = d.name;
  if (d.companyName !== undefined) updateData.companyName = d.companyName;
  if (d.productItem !== undefined) updateData.productItem = d.productItem;
  if (d.stage !== undefined) updateData.stage = d.stage;
  if (d.progress !== undefined) updateData.progress = d.progress;
  if (d.salesStatus !== undefined) updateData.salesStatus = d.salesStatus;
  if (d.vatApplicable !== undefined) updateData.vatApplicable = d.vatApplicable;
  if (d.agreedAmount !== undefined)
    updateData.agreedAmount = String(d.agreedAmount);
  if (d.receivedAmount !== undefined)
    updateData.receivedAmount = String(d.receivedAmount);
  if (d.outstandingAmount !== undefined)
    updateData.outstandingAmount = String(d.outstandingAmount);
  if (d.earliestClosingDate !== undefined)
    updateData.earliestClosingDate = d.earliestClosingDate as unknown as string | null;
  if (d.latestClosingDate !== undefined)
    updateData.latestClosingDate = d.latestClosingDate as unknown as string | null;
  if (d.notes !== undefined) updateData.notes = d.notes;

  const [updated] = await db
    .update(dealsTable)
    .set(updateData)
    .where(eq(dealsTable.id, params.data.id))
    .returning();

  res.json(UpdateDealResponse.parse(formatDeal(updated)));
});

router.delete("/deals/:id", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteDealParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(dealsTable)
    .where(eq(dealsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  if (user.role !== "owner" && existing.salespersonId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(dealsTable).where(eq(dealsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
