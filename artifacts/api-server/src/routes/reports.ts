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

export default router;
