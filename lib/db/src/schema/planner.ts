import { pgTable, text, serial, timestamp, integer, date, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plannerMeetingsTable = pgTable("planner_meetings", {
  id: serial("id").primaryKey(),
  salespersonId: integer("salesperson_id").notNull(),
  date: date("date").notNull(),
  companyName: text("company_name").notNull(),
  productName: text("product_name"),
  meetingTime: text("meeting_time"),
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const plannerTargetsTable = pgTable("planner_targets", {
  id: serial("id").primaryKey(),
  salespersonId: integer("salesperson_id").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  expectedSales: integer("expected_sales").notNull().default(0),
  salesDone: integer("sales_done").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique().on(t.salespersonId, t.year, t.month),
]);

export const insertPlannerMeetingSchema = createInsertSchema(plannerMeetingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlannerMeeting = z.infer<typeof insertPlannerMeetingSchema>;
export type PlannerMeeting = typeof plannerMeetingsTable.$inferSelect;

export const insertPlannerTargetSchema = createInsertSchema(plannerTargetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlannerTarget = z.infer<typeof insertPlannerTargetSchema>;
export type PlannerTarget = typeof plannerTargetsTable.$inferSelect;
