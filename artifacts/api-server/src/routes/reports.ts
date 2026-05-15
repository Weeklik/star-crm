import { Router, type IRouter } from "express";
import { eq, and, gte, lte, type SQL } from "drizzle-orm";
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

function buildDateConditions(
  startDate?: Date | string,
  endDate?: Date | string,
  salespersonId?: number,
  userRole?: string,
  userId?: number,
): SQL[] {
  const conditions: SQL[] = [];
  if (userRole !== "owner") {
    conditions.push(eq(dealsTable.salespersonId, userId!));
  } else if (salespersonId) {
    conditions.push(eq(dealsTable.salespersonId, salespersonId));
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

    const { salespersonId, startDate, endDate } = parsed.data;
    const conditions = buildDateConditions(
      startDate,
      endDate,
      salespersonId,
      user.role,
      user.id,
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
    const closedDeals = deals.filter((d) => d.stage === "Order Closed" || d.stage === "Order Confirmed").length;
    const lostDeals = deals.filter((d) => d.stage === "Order Lost").length;
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
        lostDeals,
        avgProgress,
        vatApplicableCount,
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

    const { startDate, endDate } = parsed.data;
    const conditions: SQL[] = [];
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
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
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
          totalDeals: 0,
          totalAgreedAmount: 0,
          totalReceivedAmount: 0,
          totalOutstandingAmount: 0,
          closedDeals: 0,
          lostDeals: 0,
          progressSum: 0,
        };
      }
      const p = byPerson[sid];
      p.totalDeals++;
      p.totalAgreedAmount += parseFloat(deal.agreedAmount ?? "0");
      p.totalReceivedAmount += parseFloat(deal.receivedAmount ?? "0");
      p.totalOutstandingAmount += parseFloat(deal.outstandingAmount ?? "0");
      if (deal.stage === "Order Closed" || deal.stage === "Order Confirmed")
        p.closedDeals++;
      if (deal.stage === "Order Lost") p.lostDeals++;
      p.progressSum += deal.progress ?? 0;
    }

    const result = Object.values(byPerson).map((p) => ({
      ...p,
      avgProgress: p.totalDeals > 0 ? p.progressSum / p.totalDeals : 0,
      progressSum: undefined,
    }));

    res.json(GetReportBySalespersonResponse.parse(result));
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

    const { salespersonId, startDate, endDate } = parsed.data;
    const conditions = buildDateConditions(
      startDate,
      endDate,
      salespersonId,
      user.role,
      user.id,
    );

    const deals =
      conditions.length > 0
        ? await db
            .select()
            .from(dealsTable)
            .where(and(...conditions))
        : await db.select().from(dealsTable);

    const stages = ["Quotation Sent", "Order Closed", "Order Confirmed", "Order Lost"];
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

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Fetch all year deals
    const yearConditions: SQL[] = [
      gte(dealsTable.dealStartDate, yearStart),
      lte(dealsTable.dealStartDate, yearEnd),
    ];
    if (user.role !== "owner") {
      yearConditions.push(eq(dealsTable.salespersonId, user.id));
    } else if (filterSalespersonId) {
      yearConditions.push(eq(dealsTable.salespersonId, filterSalespersonId));
    }
    const yearDeals = await db
      .select()
      .from(dealsTable)
      .where(and(...yearConditions));

    // Fetch summary period deals
    let summaryDeals: typeof yearDeals = [];
    if (summaryStart && summaryEnd) {
      const sumConditions: SQL[] = [
        gte(dealsTable.dealStartDate, summaryStart),
        lte(dealsTable.dealStartDate, summaryEnd),
      ];
      if (user.role !== "owner") {
        sumConditions.push(eq(dealsTable.salespersonId, user.id));
      } else if (filterSalespersonId) {
        sumConditions.push(eq(dealsTable.salespersonId, filterSalespersonId));
      }
      summaryDeals = await db
        .select()
        .from(dealsTable)
        .where(and(...sumConditions));
    }

    // Fetch all salespersons
    const users = await db
      .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
      .from(usersTable);
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    // Collect salesperson IDs from year deals
    const spIds = [...new Set(yearDeals.map((d) => d.salespersonId))];

    const result = spIds.map((spId) => {
      const spDeals = yearDeals.filter((d) => d.salespersonId === spId);
      const u = userMap[spId];

      // Monthly totals (1-12)
      const monthly: Record<number, number> = {};
      for (let m = 1; m <= 12; m++) monthly[m] = 0;
      for (const d of spDeals) {
        const month = new Date(d.dealStartDate).getMonth() + 1;
        monthly[month] += parseFloat(d.agreedAmount ?? "0");
      }

      const totalSales = spDeals.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0);
      const activeMonths = Object.values(monthly).filter((v) => v > 0).length || 1;
      const avgMonthlySales = totalSales / activeMonths;

      // Summary period
      const spSummary = summaryDeals.filter((d) => d.salespersonId === spId);
      const summaryTotal = spSummary.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0);
      const summaryQuotation = spSummary
        .filter((d) => d.stage === "Quotation Sent")
        .reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0);
      const summaryOrderConfirmed = spSummary
        .filter((d) => d.stage === "Order Confirmed")
        .reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0);

      return {
        salespersonId: spId,
        name: u?.name ?? u?.email ?? `User ${spId}`,
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
      const wEnd = new Date(cursor);
      wEnd.setDate(wEnd.getDate() + 6);
      if (wEnd > end) wEnd.setTime(end.getTime());

      if (wStart.getMonth() !== currentMonth) {
        currentMonth = wStart.getMonth();
        weekNum = 1;
      }

      weeks.push({
        monthName: wStart.toLocaleString("en-US", { month: "long" }),
        monthYear: String(wStart.getFullYear()),
        weekOrdinal: ordinalSuffix(weekNum),
        weekStart: wStart.toISOString().split("T")[0],
        weekEnd: wEnd.toISOString().split("T")[0],
      });

      weekNum++;
      cursor.setDate(cursor.getDate() + 7);
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

    // Build per-week stage aggregates
    const weekData = weeks.map(({ monthName, monthYear, weekOrdinal, weekStart, weekEnd }) => {
      const weekDeals = allDeals.filter(
        (d) => d.dealStartDate >= weekStart && d.dealStartDate <= weekEnd,
      );

      const closedDeals = weekDeals.filter((d) => d.stage === "Order Closed");
      const orderClosedCount = closedDeals.length;
      const orderClosedAmount = closedDeals.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0);
      const downPayment = closedDeals.reduce((s, d) => s + parseFloat(d.receivedAmount ?? "0"), 0);
      const totalPaymentReceipt = orderClosedAmount;

      const quotationDeals = weekDeals.filter((d) => d.stage === "Quotation Sent");
      const quotationSentCount = quotationDeals.length;
      const quotationSentAmount = quotationDeals.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0);

      const confirmedDeals = weekDeals.filter((d) => d.stage === "Order Confirmed");
      const orderConfirmedCount = confirmedDeals.length;
      const orderConfirmedAmount = confirmedDeals.reduce((s, d) => s + parseFloat(d.agreedAmount ?? "0"), 0);

      const totalSalesInProcess = quotationSentAmount + orderConfirmedAmount;

      return {
        monthName,
        monthYear,
        weekOrdinal,
        weekStart,
        weekEnd,
        orderClosedCount,
        orderClosedAmount,
        downPayment,
        totalPaymentReceipt,
        quotationSentCount,
        quotationSentAmount,
        orderConfirmedCount,
        orderConfirmedAmount,
        totalSalesInProcess,
      };
    });

    res.json({ weeks: weekData });
  },
);

export default router;

