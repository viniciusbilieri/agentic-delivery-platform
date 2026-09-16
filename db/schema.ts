// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
export {};
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const deliveries = sqliteTable("deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  objective: text("objective").notNull(),
  status: text("status").notNull().default("discovery"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
