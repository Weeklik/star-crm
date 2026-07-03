import { pgTable, text, serial, timestamp, integer, boolean, numeric, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dealsTable = pgTable("deals", {
  id: serial("id").primaryKey(),
  salespersonId: integer("salesperson_id").notNull(),
  dealStartDate: date("deal_start_date").notNull(),
  name: text("name").notNull(),
  companyName: text("company_name").notNull(),
  productItem: text("product_item").notNull(),
  stage: text("stage").notNull().default("Quotation Sent"),
  dealType: text("deal_type").notNull().default("New Deal"),
  region: text("region"),
  progress: integer("progress").notNull().default(0),
  salesStatus: text("sales_status").notNull().default("Active"),
  vatApplicable: boolean("vat_applicable").notNull().default(false),
  agreedAmount: numeric("agreed_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  receivedAmount: numeric("received_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  outstandingAmount: numeric("outstanding_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  earliestClosingDate: date("earliest_closing_date"),
  latestClosingDate: date("latest_closing_date"),
  currency: text("currency").notNull().default("USD"),
  notes: text("notes"),
  lostReason: text("lost_reason"),
  creditTerm: text("credit_term"),
  brand: text("brand"),
  model: text("model"),
  quantity: integer("quantity").notNull().default(1),
  // New fields for the full-page order form
  items: jsonb("items"),
  transportationFee: numeric("transportation_fee", { precision: 15, scale: 2 }).notNull().default("0"),
  orderType: text("order_type"),
  paymentTerms: text("payment_terms"),
  warranty: text("warranty"),
  pdc: text("pdc"),
  deliveryTerms: text("delivery_terms"),
  deliveryTime: text("delivery_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDealSchema = createInsertSchema(dealsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof dealsTable.$inferSelect;
