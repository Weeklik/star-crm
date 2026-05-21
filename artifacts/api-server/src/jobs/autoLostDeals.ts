import cron from "node-cron";
import { db, dealsTable } from "@workspace/db";
import { and, eq, lte } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Marks Quotation Sent deals as Order Lost when the deal start date
 * is 90 or more days in the past.
 *
 * Runs every day at 06:00 AM server time.
 */
async function runAutoLostDeals(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffDate = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const updated = await db
      .update(dealsTable)
      .set({ stage: "Order Lost", updatedAt: new Date() })
      .where(
        and(
          eq(dealsTable.stage, "Quotation Sent"),
          lte(dealsTable.dealStartDate, cutoffDate),
        ),
      )
      .returning({ id: dealsTable.id });

    logger.info(
      { count: updated.length, cutoffDate },
      "Auto-lost job: marked stale quotations as Order Lost",
    );
  } catch (err) {
    logger.error({ err }, "Auto-lost job: failed to update stale deals");
  }
}

export function startAutoLostDealsJob(): void {
  // Run once immediately on server start so stale deals are caught right away
  runAutoLostDeals();

  // Then run every day at 06:00 AM
  cron.schedule("0 6 * * *", () => {
    logger.info("Auto-lost job: starting daily run");
    runAutoLostDeals();
  });

  logger.info("Auto-lost job: scheduled (daily at 06:00 AM)");
}
