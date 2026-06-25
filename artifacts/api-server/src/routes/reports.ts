import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray, type SQL } from "drizzle-orm";
import { db, dealsTable, usersTable } from "@workspace/db";
import { requireAuth, requireOwner } from "../middlewares/requireAuth";
import {
  GetReportSummaryQueryParams,
  GetReportSummaryResponse,
  GetReportBySalespersonQueryParams,
  GetReportBySalespersonResponse,
  GetWeeklyReportQueryParams,
  GetWeeklyReportResponse,
  GetStageBreakdownQueryParams,
  GetStageBreakdownResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/** Resolve a salesperson-country filter to a list of matching salesperson IDs. */
async function resolveRegionSpIds(country: string): Promise<number[]> {
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.role, "salesperson"), eq(usersTable.country, country)));
  return rows.map((r) => r.id);
}

function buildDateConditions(
  startDate?: Date | string,
  endDate?: Date | string,
  salespersonId?: number,
  userRole?: string,
  userId?: number,
  regionSpIds?: number[],
): SQL[] {
  const conditions: SQL[] = [];
  if (userRole !== "owner") {
    conditions.push(eq(dealsTable.salespersonId, userId!));
  } else if (salespersonId) {
    conditions.push(eq(dealsTable.salespersonId, salespersonId));
  } else if (regionSpIds) {
    // regionSpIds resolved but empty → no salespersons in that country → force zero results
    conditions.push(
      regionSpIds.length > 0
        ? inArray(dealsTable.salespersonId, regionSpIds)
        : eq(dealsTable.salespersonId, -1),
    );
  }
  if (startDate) {
    const d = startDate instanceof Date ? startDate.toISOString().split("T")[0] : startDate;
    conditions.push(gte(dealsTable.dealStartDate, d));
  }
  if (endDate) {
    const d = endDate instanceof Date ? endDate.toISOString().split("T")[0] : endDate;
    conditions.push(lte(dealsTable.dealStartDate, d));
  }
  return conditions;
}

router.get(
  "/reports/summary",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = (req as any).user;
    const rawQuery = {
      ...req.query,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };
    const parsed = GetReportSummaryQueryParams.safeParse(rawQuery);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { salespersonId, startDate, endDate, region } = parsed.data;
    const regionSpIds = region ? await resolveRegionSpIds(region) : undefined;
    const conditions = buildDateConditions(
      startDate,
      endDate,
      salespersonId,
      user.role,
      user.id,
      regionSpIds,
    );

    const deals =
      conditions.length > 0
        ? await db
            .select()
            .from(dealsTable)
            .where(and(...conditions))
        : await db.select().from(dealsTable);

    const totalDeals = deals.length;
    const totalAgreedAmount = deals.reduce(
      (s, d) => s + parseFloat(d.agreedAmount ?? "0"),
      0,
    );
    const totalReceivedAmount = deals.reduce(
      (s, d) => s + parseFloat(d.receivedAmount ?? "0"),
      0,
    );
    const totalOutstandingAmount = deals.reduce(
      (s, d) => s + parseFloat(d.outstandingAmount ?? "0"),
      0,
    );
    const closedDealsList = deals.filter((d) => d.stage === "Order Closed");
    const closedDeals = closedDealsList.length;
    const closedAmount = closedDealsList.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0);
    const confirmedDealsList = deals.filter((d) => d.stage === "Order Confirmed");
    const confirmedDeals = confirmedDealsList.length;
    const confirmedAmount = confirmedDealsList.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0);
    const lostDealsList = deals.filter((d) => d.stage === "Order Lost");
    const lostDeals = lostDealsList.length;
    const lostAmount = lostDealsList.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0);
    const quotationSentList = deals.filter((d) => d.stage === "Quotation Sent");
    const quotationSentCount = quotationSentList.length;
    const quotationSentAmount = quotationSentList.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0);
    const avgProgress =
      totalDeals > 0
        ? deals.reduce((s, d) => s + (d.progress ?? 0), 0) / totalDeals
        : 0;
    const vatApplicableCount = deals.filter((d) => d.vatApplicable).length;

    res.json(
      GetReportSummaryResponse.parse({
        totalDeals,
        totalAgreedAmount,
        totalReceivedAmount,
        totalOutstandingAmount,
        closedDeals,
        closedAmount,
        confirmedDeals,
        confirmedAmount,
        lostDeals,
        lostAmount,
        avgProgress,
        vatApplicableCount,
        quotationSentCount,
        quotationSentAmount,
      }),
    );
  },
);

router.get(
  "/reports/by-salesperson",
  requireAuth,
  requireOwner,
  async (req, res): Promise<void> => {
    const rawQuery = {
      ...req.query,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };
    const parsed = GetReportBySalespersonQueryParams.safeParse(rawQuery);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { startDate, endDate, region } = parsed.data;
    const regionSpIds = region ? await resolveRegionSpIds(region) : undefined;
    const conditions: SQL[] = [];
    if (regionSpIds) {
      conditions.push(
        regionSpIds.length > 0
          ? inArray(dealsTable.salespersonId, regionSpIds)
          : eq(dealsTable.salespersonId, -1),
      );
    }
    if (startDate) {
      const d = startDate instanceof Date ? startDate.toISOString().split("T")[0] : startDate;
      conditions.push(gte(dealsTable.dealStartDate, d));
    }
    if (endDate) {
      const d = endDate instanceof Date ? endDate.toISOString().split("T")[0] : endDate;
      conditions.push(lte(dealsTable.dealStartDate, d));
    }

    const deals =
      conditions.length > 0
        ? await db
            .select()
            .from(dealsTable)
            .where(and(...conditions))
        : await db.select().from(dealsTable);

    const users = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, currency: usersTable.currency })
      .from(usersTable);
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const byPerson: Record<number, any> = {};
    for (const deal of deals) {
      const sid = deal.salespersonId;
      if (!byPerson[sid]) {
        const u = userMap[sid];
        byPerson[sid] = {
          salespersonId: sid,
          salespersonName: u?.name ?? null,
          email: u?.email ?? null,
          currency: u?.currency ?? null,
          totalDeals: 0,
          // Order Closed only
          totalAgreedAmount: 0,
          totalReceivedAmount: 0,
          totalOutstandingAmount: 0,
          closedDeals: 0,
          // All stages pipeline
          agreedAmountAll: 0,
          // Confirmed
          confirmedDeals: 0,
          confirmedAmount: 0,
          // Lost
          lostDeals: 0,
          lostAmount: 0,
          // Quotation Sent
          quotationSentCount: 0,
          quotationSentAmount: 0,
          progressSum: 0,
        };
      }
      const p = byPerson[sid];
      p.totalDeals++;
      p.agreedAmountAll += parseFloat(deal.agreedAmount ?? "0");
      p.totalReceivedAmount += parseFloat(deal.receivedAmount ?? "0");
      p.totalOutstandingAmount += parseFloat(deal.outstandingAmount ?? "0");
      p.progressSum += deal.progress ?? 0;
      if (deal.stage === "Order Closed") {
        p.totalAgreedAmount += parseFloat(deal.agreedAmount ?? "0");
        p.closedDeals++;
      } else if (deal.stage === "Order Confirmed") {
        p.confirmedDeals++;
        p.confirmedAmount += parseFloat(deal.agreedAmount ?? "0");
      } else if (deal.stage === "Order Lost") {
        p.lostDeals++;
        p.lostAmount += parseFloat(deal.agreedAmount ?? "0");
      } else if (deal.stage === "Quotation Sent") {
        p.quotationSentCount++;
        p.quotationSentAmount += parseFloat(deal.agreedAmount ?? "0");
      }
    }

    const result = Object.values(byPerson).map((p) => ({
      ...p,
      avgProgress: p.totalDeals > 0 ? p.progressSum / p.totalDeals : 0,
      progressSum: undefined,
    }));

    // Send enriched result directly (includes extra fields beyond Zod schema)
    res.json(result);
  },
);

router.get(
  "/reports/weekly",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = (req as any).user;
    const parsed = GetWeeklyReportQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const weeks = parsed.data.weeks ?? 8;
    const salespersonId = parsed.data.salespersonId;

    const now = new Date();

    // Build week boundaries up front
    const weekBuckets: Array<{ weekLabel: string; weekStart: string; weekEnd: string }> = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      weekBuckets.push({
        weekLabel: `W${weeks - i}`,
        weekStart: weekStart.toISOString().split("T")[0],
        weekEnd: weekEnd.toISOString().split("T")[0],
      });
    }

    // Single query covering the entire range
    const rangeStart = weekBuckets[0].weekStart;
    const rangeEnd = weekBuckets[weekBuckets.length - 1].weekEnd;
    const conditions: SQL[] = [
      gte(dealsTable.dealStartDate, rangeStart),
      lte(dealsTable.dealStartDate, rangeEnd),
    ];
    if (user.role !== "owner") {
      conditions.push(eq(dealsTable.salespersonId, user.id));
    } else if (salespersonId) {
      conditions.push(eq(dealsTable.salespersonId, salespersonId));
    }
    const allDeals = await db.select().from(dealsTable).where(and(...conditions));

    // Group in memory
    const weekData = weekBuckets.map(({ weekLabel, weekStart, weekEnd }) => {
      const deals = allDeals.filter(
        (d) => d.dealStartDate >= weekStart && d.dealStartDate <= weekEnd,
      );
      return {
        weekLabel,
        weekStart,
        weekEnd,
        totalDeals: deals.length,
        newDeals: deals.length,
        closedDeals: deals.filter(
          (d) => d.stage === "Order Closed" || d.stage === "Order Confirmed",
        ).length,
        totalAgreedAmount: deals.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0),
        totalReceivedAmount: deals.reduce((s, d) => s + parseFloat(d.receivedAmount ?? "0"), 0),
      };
    });

    res.json(GetWeeklyReportResponse.parse(weekData));
  },
);

router.get(
  "/reports/stage-breakdown",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = (req as any).user;
    const rawQuery = {
      ...req.query,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };
    const parsed = GetStageBreakdownQueryParams.safeParse(rawQuery);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { salespersonId, startDate, endDate, region } = parsed.data;
    const regionSpIds = region ? await resolveRegionSpIds(region) : undefined;
    const conditions = buildDateConditions(
      startDate,
      endDate,
      salespersonId,
      user.role,
      user.id,
      regionSpIds,
    );

    const deals =
      conditions.length > 0
        ? await db
            .select()
            .from(dealsTable)
            .where(and(...conditions))
        : await db.select().from(dealsTable);

    const stages = ["Quotation Sent", "Order Closed", "Order Confirmed", "Order Lost", "Sales Return"];
    const breakdown = stages.map((stage) => {
      const stageDeals = deals.filter((d) => d.stage === stage);
      return {
        stage,
        count: stageDeals.length,
        totalAgreedAmount: stageDeals.reduce(
          (s, d) => s + parseFloat(d.agreedAmount ?? "0"),
          0,
        ),
        totalReceivedAmount: stageDeals.reduce(
          (s, d) => s + parseFloat(d.receivedAmount ?? "0"),
          0,
        ),
        totalOutstandingAmount: stageDeals.reduce(
          (s, d) => s + parseFloat(d.outstandingAmount ?? "0"),
          0,
        ),
      };
    });

    res.json(GetStageBreakdownResponse.parse(breakdown));
  },
);


// ─── Weekly Stage Breakdown (for Reports Dashboard) ───────────────────────────
router.get(
  "/reports/weekly-stage-breakdown",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = (req as any).user;
    const salespersonId = req.query.salespersonId
      ? parseInt(req.query.salespersonId as string, 10)
      : undefined;
    const startDate = (req.query.startDate as string) || undefined;
    const endDate = (req.query.endDate as string) || undefined;
    const region = (req.query.region as string) || undefined;

    const now = new Date();
    const rangeEndStr = endDate ?? now.toISOString().split("T")[0];
    const rangeStartStr = startDate ?? (() => {
      const d = new Date(now);
      d.setDate(d.getDate() - 55);
      return d.toISOString().split("T")[0];
    })();

    // Build week buckets backwards from rangeEnd
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const weekBuckets: Array<{ weekLabel: string; weekStart: string; weekEnd: string }> = [];
    let cursor = new Date(rangeEndStr);
    const rangeStartDate = new Date(rangeStartStr);

    while (cursor >= rangeStartDate) {
      const wEnd = new Date(cursor);
      const wStart = new Date(cursor);
      wStart.setDate(wStart.getDate() - 6);
      if (wStart < rangeStartDate) wStart.setTime(rangeStartDate.getTime());
      const wStartStr = wStart.toISOString().split("T")[0];
      const wEndStr = wEnd.toISOString().split("T")[0];
      const label = `${wStart.getDate()}-${wEnd.getDate()} ${MONTHS[wEnd.getMonth()]}`;
      weekBuckets.unshift({ weekLabel: label, weekStart: wStartStr, weekEnd: wEndStr });
      cursor = new Date(wStart);
      cursor.setDate(cursor.getDate() - 1);
    }

    const conditions: SQL[] = [
      gte(dealsTable.dealStartDate, rangeStartStr),
      lte(dealsTable.dealStartDate, rangeEndStr),
    ];
    if (user.role !== "owner") {
      conditions.push(eq(dealsTable.salespersonId, user.id));
    } else if (salespersonId) {
      conditions.push(eq(dealsTable.salespersonId, salespersonId));
    }
    if (region) {
      const regionSpIds = await resolveRegionSpIds(region);
      conditions.push(
        regionSpIds.length > 0
          ? inArray(dealsTable.salespersonId, regionSpIds)
          : eq(dealsTable.salespersonId, -1),
      );
    }
    const allDeals = await db.select().from(dealsTable).where(and(...conditions));

    const result = weekBuckets.map(({ weekLabel, weekStart, weekEnd }) => {
      const deals = allDeals.filter(
        (d) => d.dealStartDate >= weekStart && d.dealStartDate <= weekEnd,
      );
      const quotationSent = deals.filter((d) => d.stage === "Quotation Sent");
      const orderClosed = deals.filter((d) => d.stage === "Order Closed");
      const orderConfirmed = deals.filter((d) => d.stage === "Order Confirmed");
      const orderLost = deals.filter((d) => d.stage === "Order Lost");
      const closedDeals = orderClosed.length;
      const confirmedDeals = orderConfirmed.length;
      const quotationDeals = quotationSent.length;
      const totalDeals = deals.length;
      // Close rate: closed ÷ (closed + open quotations) — measures conversion of pipeline to closed
      const closeRateDenominator = closedDeals + quotationDeals;
      return {
        weekLabel,
        weekStart,
        weekEnd,
        totalDeals,
        closedDeals,
        winRate: closeRateDenominator > 0 ? (closedDeals / closeRateDenominator) * 100 : 0,
        quotationSentAmount: quotationSent.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0),
        orderClosedAmount: orderClosed.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0),
        orderClosedReceivedAmount: orderClosed.reduce((s, d) => s + parseFloat(d.receivedAmount ?? "0"), 0),
        orderConfirmedAmount: orderConfirmed.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0),
        orderLostAmount: orderLost.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0),
      };
    });

    res.json(result);
  },
);

// ─── Summary Sales Report ─────────────────────────────────────────────────────
router.get(
  "/reports/summary-sales",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = (req as any).user;
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()), 10);
    const summaryStart = req.query.summaryStart as string | undefined;
    const summaryEnd = req.query.summaryEnd as string | undefined;
    const filterSalespersonId = req.query.salespersonId
      ? parseInt(req.query.salespersonId as string, 10)
      : undefined;
    const region = req.query.region as string | undefined;
    const regionSpIds = region ? await resolveRegionSpIds(region) : undefined;

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Build query conditions
    const yearConditions: SQL[] = [
      gte(dealsTable.dealStartDate, yearStart),
      lte(dealsTable.dealStartDate, yearEnd),
    ];
    if (user.role !== "owner") {
      yearConditions.push(eq(dealsTable.salespersonId, user.id));
    } else if (filterSalespersonId) {
      yearConditions.push(eq(dealsTable.salespersonId, filterSalespersonId));
    } else if (regionSpIds) {
      yearConditions.push(
        regionSpIds.length > 0
          ? inArray(dealsTable.salespersonId, regionSpIds)
          : eq(dealsTable.salespersonId, -1),
      );
    }

    type YearDeal = typeof dealsTable.$inferSelect;
    let summaryQueryPromise: Promise<YearDeal[]> = Promise.resolve([]);
    if (summaryStart && summaryEnd) {
      const sumConditions: SQL[] = [
        gte(dealsTable.dealStartDate, summaryStart),
        lte(dealsTable.dealStartDate, summaryEnd),
      ];
      if (user.role !== "owner") {
        sumConditions.push(eq(dealsTable.salespersonId, user.id));
      } else if (filterSalespersonId) {
        sumConditions.push(eq(dealsTable.salespersonId, filterSalespersonId));
      } else if (regionSpIds) {
        sumConditions.push(
          regionSpIds.length > 0
            ? inArray(dealsTable.salespersonId, regionSpIds)
            : eq(dealsTable.salespersonId, -1),
        );
      }
      summaryQueryPromise = db.select().from(dealsTable).where(and(...sumConditions)) as Promise<YearDeal[]>;
    }

    // Run all three queries in parallel
    const [yearDeals, summaryDeals, users] = await Promise.all([
      db.select().from(dealsTable).where(and(...yearConditions)),
      summaryQueryPromise,
      db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, currency: usersTable.currency }).from(usersTable),
    ]);

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    // Group deals by salesperson in a single pass — avoids O(Salespeople × Deals) filtering
    type DealRow = typeof yearDeals[0];
    const yearDealsBySp = new Map<number, DealRow[]>();
    for (const d of yearDeals) {
      const arr = yearDealsBySp.get(d.salespersonId);
      if (arr) arr.push(d);
      else yearDealsBySp.set(d.salespersonId, [d]);
    }

    const summaryDealsBySp = new Map<number, DealRow[]>();
    for (const d of summaryDeals as DealRow[]) {
      const arr = summaryDealsBySp.get(d.salespersonId);
      if (arr) arr.push(d);
      else summaryDealsBySp.set(d.salespersonId, [d]);
    }

    const spIds = [...yearDealsBySp.keys()];

    const result = spIds.map((spId) => {
      const spDeals = yearDealsBySp.get(spId) ?? [];
      const u = userMap[spId];

      // Single pass: monthly totals (Order Closed only)
      const monthly: Record<number, number> = { 1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0,10:0,11:0,12:0 };
      let totalSales = 0;
      for (const d of spDeals) {
        if (d.stage === "Order Closed") {
          const amt = parseFloat(d.agreedAmount ?? "0");
          monthly[new Date(d.dealStartDate).getMonth() + 1] += amt;
          totalSales += amt;
        }
      }
      const activeMonths = Object.values(monthly).filter((v) => v > 0).length || 1;
      const avgMonthlySales = totalSales / activeMonths;

      // Single pass: summary period aggregation
      // summaryTotal = Order Closed only (matches the monthly Sales columns)
      const spSummary = summaryDealsBySp.get(spId) ?? [];
      let summaryTotal = 0, summaryQuotation = 0, summaryOrderConfirmed = 0;
      for (const d of spSummary) {
        const amt = parseFloat(d.agreedAmount ?? "0");
        if (d.stage === "Order Closed") summaryTotal += amt;
        else if (d.stage === "Quotation Sent") summaryQuotation += amt;
        else if (d.stage === "Order Confirmed") summaryOrderConfirmed += amt;
      }

      return {
        salespersonId: spId,
        name: u?.name ?? u?.email ?? `User ${spId}`,
        currency: u?.currency ?? null,
        totalSales,
        avgMonthlySales,
        monthly,
        summaryTotal,
        summaryQuotation,
        summaryOrderConfirmed,
      };
    });

    res.json(result);
  },
);

// ─── Sales Breakdown (week × stage) ──────────────────────────────────────────
router.get(
  "/reports/sales-breakdown",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = (req as any).user;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const filterSpId = req.query.salespersonId
      ? parseInt(req.query.salespersonId as string, 10)
      : undefined;

    if (!startDate || !endDate) {
      res.status(400).json({ error: "startDate and endDate are required" });
      return;
    }

    function ordinalSuffix(n: number): string {
      if (n === 1) return "1st";
      if (n === 2) return "2nd";
      if (n === 3) return "3rd";
      return `${n}th`;
    }

    // Build calendar-aligned weekly buckets (reset week counter per month)
    const start = new Date(startDate);
    start.setDate(1);
    const end = new Date(endDate);
    end.setMonth(end.getMonth() + 1, 0);

    const weeks: Array<{
      monthName: string;
      monthYear: string;
      weekOrdinal: string;
      weekStart: string;
      weekEnd: string;
    }> = [];

    const cursor = new Date(start);
    let weekNum = 1;
    let currentMonth = cursor.getMonth();

    while (cursor <= end) {
      const wStart = new Date(cursor);

      if (wStart.getMonth() !== currentMonth) {
        currentMonth = wStart.getMonth();
        weekNum = 1;
      }

      // End of the 7-day window
      const sevenDayEnd = new Date(wStart);
      sevenDayEnd.setDate(wStart.getDate() + 6);

      // Last day of the current month — clip here so weeks never cross months
      const monthEnd = new Date(wStart.getFullYear(), wStart.getMonth() + 1, 0);

      // Week ends at the earliest of: 7 days, month end, or range end
      const wEnd = new Date(
        Math.min(sevenDayEnd.getTime(), monthEnd.getTime(), end.getTime()),
      );

      weeks.push({
        monthName: wStart.toLocaleString("en-US", { month: "long" }),
        monthYear: String(wStart.getFullYear()),
        weekOrdinal: ordinalSuffix(weekNum),
        weekStart: wStart.toISOString().split("T")[0],
        weekEnd: wEnd.toISOString().split("T")[0],
      });

      weekNum++;
      // Next cursor = day after this week ends
      const next = new Date(wEnd);
      next.setDate(wEnd.getDate() + 1);
      cursor.setTime(next.getTime());
    }

    if (weeks.length === 0) {
      res.json({ weeks: [] });
      return;
    }

    // Single query for all deals in the range
    const conditions: SQL[] = [
      gte(dealsTable.dealStartDate, weeks[0].weekStart),
      lte(dealsTable.dealStartDate, weeks[weeks.length - 1].weekEnd),
    ];
    if (user.role !== "owner") {
      conditions.push(eq(dealsTable.salespersonId, user.id));
    } else if (filterSpId) {
      conditions.push(eq(dealsTable.salespersonId, filterSpId));
    }
    const allDeals = await db.select().from(dealsTable).where(and(...conditions));

    // Index deals by date string for O(1) lookup — avoids O(Weeks × Deals) scans
    type Deal = typeof allDeals[0];
    const dealsByDate = new Map<string, Deal[]>();
    for (const deal of allDeals) {
      const key = deal.dealStartDate ?? "";
      if (!key) continue;
      const bucket = dealsByDate.get(key);
      if (bucket) bucket.push(deal);
      else dealsByDate.set(key, [deal]);
    }

    // Collect deals for a date range via O(days) Map lookups instead of full scan
    function dealsInRange(ws: string, we: string): Deal[] {
      const out: Deal[] = [];
      const cur = new Date(ws + "T00:00:00Z");
      const last = new Date(we + "T00:00:00Z");
      while (cur <= last) {
        const key = cur.toISOString().slice(0, 10);
        const bucket = dealsByDate.get(key);
        if (bucket) out.push(...bucket);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      return out;
    }

    // Build per-week stage aggregates — single pass per week
    const weekData = weeks.map(({ monthName, monthYear, weekOrdinal, weekStart, weekEnd }) => {
      const weekDeals = dealsInRange(weekStart, weekEnd);

      let orderClosedCount = 0, orderClosedAmount = 0, downPayment = 0;
      let quotationSentCount = 0, quotationSentAmount = 0;
      let orderConfirmedCount = 0, orderConfirmedAmount = 0;

      for (const d of weekDeals) {
        const amt = parseFloat(d.agreedAmount ?? "0");
        if (d.stage === "Order Closed") {
          orderClosedCount++;
          orderClosedAmount += amt;
          downPayment += parseFloat(d.receivedAmount ?? "0");
        } else if (d.stage === "Quotation Sent") {
          quotationSentCount++;
          quotationSentAmount += amt;
        } else if (d.stage === "Order Confirmed") {
          orderConfirmedCount++;
          orderConfirmedAmount += amt;
        }
      }

      return {
        monthName,
        monthYear,
        weekOrdinal,
        weekStart,
        weekEnd,
        orderClosedCount,
        orderClosedAmount,
        downPayment,
        totalPaymentReceipt: orderClosedAmount,
        quotationSentCount,
        quotationSentAmount,
        orderConfirmedCount,
        orderConfirmedAmount,
        totalSalesInProcess: quotationSentAmount + orderConfirmedAmount,
      };
    });

    res.json({ weeks: weekData });
  },
);

// ─── Region × Stage breakdown (owner-only, all regions, date-filtered) ────────
router.get(
  "/reports/region-stage-breakdown",
  requireAuth,
  requireOwner,
  async (req, res): Promise<void> => {
    const startDate = req.query.startDate as string | undefined;
    const endDate   = req.query.endDate   as string | undefined;

    const conditions: SQL[] = [];
    if (startDate) conditions.push(gte(dealsTable.dealStartDate, startDate));
    if (endDate)   conditions.push(lte(dealsTable.dealStartDate, endDate));

    const rows = await db
      .select({
        country:      usersTable.country,
        currency:     usersTable.currency,
        stage:        dealsTable.stage,
        agreedAmount: dealsTable.agreedAmount,
      })
      .from(dealsTable)
      .innerJoin(usersTable, eq(dealsTable.salespersonId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Group by [country, currency, stage] so the client can convert per currency
    const map = new Map<string, {
      region: string; currency: string; stage: string; amount: number; count: number;
    }>();

    for (const row of rows) {
      const region   = row.country   ?? "Unknown";
      const currency = row.currency  ?? "USD";
      const stage    = row.stage     ?? "";
      const key      = `${region}||${currency}||${stage}`;
      if (!map.has(key)) map.set(key, { region, currency, stage, amount: 0, count: 0 });
      const entry = map.get(key)!;
      entry.amount += parseFloat(row.agreedAmount ?? "0");
      entry.count++;
    }

    res.json(Array.from(map.values()));
  },
);

// ─── Sales Breakdown drill-down: deals behind a specific week × stage cell ────
router.get(
  "/reports/sales-breakdown-deals",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = (req as any).user;
    const { weekStart, weekEnd, stage, salespersonId } = req.query as Record<string, string>;

    if (!weekStart || !weekEnd) {
      res.status(400).json({ error: "weekStart and weekEnd are required" });
      return;
    }

    const conditions: SQL[] = [
      gte(dealsTable.dealStartDate, weekStart),
      lte(dealsTable.dealStartDate, weekEnd),
    ];

    if (user.role !== "owner") {
      conditions.push(eq(dealsTable.salespersonId, user.id));
    } else if (salespersonId) {
      conditions.push(eq(dealsTable.salespersonId, parseInt(salespersonId, 10)));
    }

    let deals = await db.select().from(dealsTable).where(and(...conditions));

    // Filter by stage — "Sales in Process" means Quotation Sent + Order Confirmed
    if (stage === "Sales in Process") {
      deals = deals.filter((d) => d.stage === "Quotation Sent" || d.stage === "Order Confirmed");
    } else if (stage) {
      deals = deals.filter((d) => d.stage === stage);
    }

    res.json(deals);
  },
);

export default router;

