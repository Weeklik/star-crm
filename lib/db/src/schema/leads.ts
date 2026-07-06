import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";

export const leadsTable = pgTable("leads", {
  id:                 serial("id").primaryKey(),
  leadSource:         text("lead_source").notNull(),
  dateTime:           timestamp("date_time", { withTimezone: true }).notNull().defaultNow(),
  customerName:       text("customer_name").notNull(),
  companyName:        text("company_name"),
  mobileCountryCode:  text("mobile_country_code").notNull().default("+971"),
  mobileNumber:       text("mobile_number").notNull(),
  email:              text("email"),
  region:             text("region").notNull(),
  brand:              text("brand").notNull(),
  model:              text("model").notNull(),
  closure:            text("closure").notNull(),
  notes:              text("notes"),
  assignedToId:       integer("assigned_to_id").notNull(),
  leadStatus:         text("lead_status").notNull().default("New"),
  nextFollowUpDate:   date("next_follow_up_date").notNull(),
  followUpRemarks:    text("follow_up_remarks"),
  createdById:        integer("created_by_id").notNull(),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Lead = typeof leadsTable.$inferSelect;
export type InsertLead = typeof leadsTable.$inferInsert;
