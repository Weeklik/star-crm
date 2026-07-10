import { Router, type IRouter } from "express";
import { eq, and, gte, lte, max, type SQL } from "drizzle-orm";
import { db, dealsTable, customersTable, companiesTable, productsTable, brandsTable } from "@workspace/db";
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

async function upsertLookupNames(name: string, companyName: string, productItem: string, brand?: string | null) {
  try {
    await Promise.all([
      db.insert(customersTable).values({ name: name.trim() }).onConflictDoNothing(),
      db.insert(companiesTable).values({ name: companyName.trim() }).onConflictDoNothing(),
      db.insert(productsTable).values({ name: productItem.trim() }).onConflictDoNothing(),
      ...(brand?.trim() ? [db.insert(brandsTable).values({ name: brand.trim() }).onConflictDoNothing()] : []),
    ]);
  } catch {
    // Non-critical — don't fail the main request
  }
}

function formatDeal(deal: any) {
  return {
    ...deal,
    agreedAmount: parseFloat(deal.agreedAmount ?? "0"),
    receivedAmount: parseFloat(deal.receivedAmount ?? "0"),
    outstandingAmount: parseFloat(deal.outstandingAmount ?? "0"),
    transportationFee: parseFloat(deal.transportationFee ?? "0"),
    progress: deal.progress ?? 0,
    vatApplicable: deal.vatApplicable ?? false,
    orderType: deal.orderType ?? null,
    paymentTerms: deal.paymentTerms ?? null,
    warranty: deal.warranty ?? null,
    pdc: deal.pdc ?? null,
    deliveryTerms: deal.deliveryTerms ?? null,
    deliveryTime: deal.deliveryTime ?? null,
    companySelection: deal.companySelection ?? null,
    items: deal.items ?? null,
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
  const rawQuery = {
    ...req.query,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate:   req.query.endDate   ? new Date(req.query.endDate   as string) : undefined,
  };
  const parsed = ListDealsQueryParams.safeParse(rawQuery);
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
    const d = startDate instanceof Date ? startDate.toISOString().split("T")[0] : String(startDate);
    conditions.push(gte(dealsTable.dealStartDate, d));
  }

  if (endDate) {
    const d = endDate instanceof Date ? endDate.toISOString().split("T")[0] : String(endDate);
    conditions.push(lte(dealsTable.dealStartDate, d));
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

  // Shared proforma invoice sequence — every company selection draws from the
  // same running counter so numbers increment consecutively across all companies
  // (e.g. SSMT #0001, next order for any company is #0002, etc).
  let invoiceSeq: number | null = null;
  if ((data as any).companySelection) {
    const [row] = await db
      .select({
        maxSgt: max(dealsTable.sgtInvoiceSeq),
        maxSsmt: max(dealsTable.ssmtInvoiceSeq),
        maxShared: max(dealsTable.invoiceSeq),
      })
      .from(dealsTable);
    const highest = Math.max(
      (row?.maxSgt as number | null) ?? 0,
      (row?.maxSsmt as number | null) ?? 0,
      (row?.maxShared as number | null) ?? 0,
    );
    invoiceSeq = highest + 1;
  }

  const [deal] = await db
    .insert(dealsTable)
    .values({
      salespersonId: user.id,
      dealStartDate: data.dealStartDate as unknown as string,
      name: data.name,
      companyName: data.companyName,
      productItem: data.productItem,
      stage: data.stage,
      dealType: data.dealType ?? "New Deal",
      region: data.region ?? null,
      progress: data.progress,
      salesStatus: data.salesStatus,
      vatApplicable: data.vatApplicable,
      agreedAmount: String(data.agreedAmount),
      receivedAmount: String(data.receivedAmount),
      outstandingAmount: String(data.outstandingAmount),
      currency: (user.country as string) === "Tunisia" ? "EUR" : ((user.currency as string | null) || ({ UAE:"AED", KSA:"SAR", KE:"KES", NG:"NGN", TN:"TND" } as Record<string,string>)[(user.country as string) ?? ""] || "USD"),
      earliestClosingDate: data.earliestClosingDate as unknown as string | undefined,
      latestClosingDate: data.latestClosingDate as unknown as string | undefined,
      notes: data.notes ?? null,
      lostReason: data.lostReason ?? null,
      delayReason: (data as any).delayReason ?? null,
      creditTerm: (data as any).creditTerm ?? null,
      brand: (data as any).brand ?? null,
      model: (data as any).model ?? null,
      quantity: (data as any).quantity ?? 1,
      items: (data as any).items ?? null,
      transportationFee: String((data as any).transportationFee ?? 0),
      paymentTerms: (data as any).paymentTerms ?? null,
      orderType: (data as any).orderType ?? null,
      warranty: (data as any).warranty ?? null,
      pdc: (data as any).pdc ?? null,
      deliveryTerms: (data as any).deliveryTerms ?? null,
      deliveryTime: (data as any).deliveryTime ?? null,
      companySelection: (data as any).companySelection ?? null,
      bankDetails: (data as any).bankDetails ?? null,
      additionalInfo: (data as any).additionalInfo ?? null,
      invoiceSeq,
    })
    .returning();

  res.status(201).json(GetDealResponse.parse(formatDeal(deal)));

  // Auto-save new names to lookup tables (fire-and-forget)
  void upsertLookupNames(data.name, data.companyName, data.productItem, (data as any).brand);
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
  if (d.dealType !== undefined) updateData.dealType = d.dealType;
  if (d.region !== undefined) updateData.region = d.region;
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
  if (d.lostReason !== undefined) updateData.lostReason = d.lostReason;
  if ((d as any).delayReason !== undefined) updateData.delayReason = (d as any).delayReason;
  if ((d as any).creditTerm !== undefined) updateData.creditTerm = (d as any).creditTerm;
  if ((d as any).brand !== undefined) updateData.brand = (d as any).brand;
  if ((d as any).model !== undefined) updateData.model = (d as any).model;
  if ((d as any).quantity !== undefined) updateData.quantity = (d as any).quantity;
  if ((d as any).items !== undefined) updateData.items = (d as any).items;
  if ((d as any).transportationFee !== undefined) updateData.transportationFee = String((d as any).transportationFee);
  if ((d as any).paymentTerms !== undefined) updateData.paymentTerms = (d as any).paymentTerms;
  if ((d as any).orderType !== undefined) updateData.orderType = (d as any).orderType;
  if ((d as any).warranty !== undefined) updateData.warranty = (d as any).warranty;
  if ((d as any).pdc !== undefined) updateData.pdc = (d as any).pdc;
  if ((d as any).deliveryTerms !== undefined) updateData.deliveryTerms = (d as any).deliveryTerms;
  if ((d as any).deliveryTime !== undefined) updateData.deliveryTime = (d as any).deliveryTime;
  if ((d as any).companySelection !== undefined) updateData.companySelection = (d as any).companySelection;
  if ((d as any).bankDetails !== undefined) updateData.bankDetails = (d as any).bankDetails;
  if ((d as any).additionalInfo !== undefined) updateData.additionalInfo = (d as any).additionalInfo;

  const [updated] = await db
    .update(dealsTable)
    .set(updateData)
    .where(eq(dealsTable.id, params.data.id))
    .returning();

  res.json(UpdateDealResponse.parse(formatDeal(updated)));

  // Auto-save any updated names to lookup tables (fire-and-forget)
  void upsertLookupNames(
    d.name ?? existing.name,
    d.companyName ?? existing.companyName,
    d.productItem ?? existing.productItem,
    (d as any).brand ?? (existing as any).brand,
  );
});

// ─── Bulk Import ─────────────────────────────────────────────────────────────
router.post("/deals/bulk", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const body = req.body;

  if (!Array.isArray(body.deals) || body.deals.length === 0) {
    res.status(400).json({ error: "deals array is required" });
    return;
  }

  const force: boolean = body.force === true;

  // Fetch existing deals for this user to detect duplicates
  const existing = user.role !== "owner"
    ? await db.select().from(dealsTable).where(eq(dealsTable.salespersonId, user.id))
    : await db.select().from(dealsTable);

  // Duplicate key = normalised(name) + "|" + normalised(companyName)
  const existingKeys = new Set(
    existing.map((d) => `${d.name.trim().toLowerCase()}|${d.companyName.trim().toLowerCase()}`)
  );

  const newDeals: typeof body.deals = [];
  const duplicates: typeof body.deals = [];

  for (const deal of body.deals) {
    const key = `${String(deal.name ?? "").trim().toLowerCase()}|${String(deal.companyName ?? "").trim().toLowerCase()}`;
    if (existingKeys.has(key)) {
      duplicates.push(deal);
    } else {
      newDeals.push(deal);
    }
  }

  // If there are duplicates and force is not set, return for user confirmation
  if (duplicates.length > 0 && !force) {
    res.status(200).json({ requiresConfirmation: true, newDeals, duplicates, imported: [] });
    return;
  }

  // Insert non-duplicates + forced duplicates
  const toInsert = force ? [...newDeals, ...duplicates] : newDeals;
  const inserted: any[] = [];

  const VALID_STAGES = ["Quotation Sent", "Order Closed", "Order Confirmed", "Order Lost"] as const;
  const todayStr = new Date().toISOString().split("T")[0];

  function sanitiseDate(val: unknown): string | undefined {
    if (!val) return undefined;
    const s = String(val).trim();
    if (!s) return undefined;
    const d = new Date(s);
    return isNaN(d.getTime()) ? undefined : s;
  }

  // Sanitise every row — never silently drop, just apply safe defaults
  const validRows = toInsert.map((deal: any) => {
    const startDate = sanitiseDate(deal.dealStartDate) ?? todayStr;
    const stage = VALID_STAGES.includes(deal.stage) ? deal.stage : "Quotation Sent";
    const rawProgress = Number(deal.progress) || 0;
    // Normalise fraction (0.2 → 20) or whole number (20 → 20), then round to integer
    const progress = Math.round(
      rawProgress > 0 && rawProgress <= 1
        ? rawProgress * 100
        : Math.min(100, Math.max(0, rawProgress))
    );
    const agreed = Number(deal.agreedAmount) || 0;
    const received = Number(deal.receivedAmount) || 0;
    const outstanding = Number(deal.outstandingAmount) || 0;

    return {
      salespersonId: user.id,
      dealStartDate: startDate as unknown as string,
      name: String(deal.name ?? "").trim() || "Untitled",
      companyName: String(deal.companyName ?? "").trim() || "Unknown",
      productItem: String(deal.productItem ?? "").trim(),
      stage,
      progress,
      salesStatus: String(deal.salesStatus ?? "25%").trim() || "25%",
      vatApplicable: deal.vatApplicable === true || deal.vatApplicable === "true",
      agreedAmount: String(agreed),
      receivedAmount: String(received),
      outstandingAmount: String(outstanding),
      currency: (user.country as string) === "Tunisia" ? "EUR" : ((user.currency as string | null) || ({ UAE:"AED", KSA:"SAR", KE:"KES", NG:"NGN", TN:"TND" } as Record<string,string>)[(user.country as string) ?? ""] || "USD"),
      earliestClosingDate: sanitiseDate(deal.earliestClosingDate) as unknown as string | undefined,
      latestClosingDate: sanitiseDate(deal.latestClosingDate) as unknown as string | undefined,
      notes: deal.notes ? String(deal.notes) : null,
    };
  });

  if (validRows.length > 0) {
    const rows = await db.insert(dealsTable).values(validRows).returning();
    rows.forEach((row: any) => inserted.push(formatDeal(row)));
  }

  res.status(201).json({ requiresConfirmation: false, imported: inserted, duplicates: force ? [] : duplicates, newDeals: [] });
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
