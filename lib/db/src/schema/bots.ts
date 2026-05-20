import { pgTable, serial, text, integer, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botModeEnum = pgEnum("bot_mode", ["LONG", "SHORT", "NEUTRAL"]);
export const botStatusEnum = pgEnum("bot_status", ["IDLE", "RUNNING", "STOPPED", "ERROR"]);
export const orderSideEnum = pgEnum("order_side", ["BUY", "SELL"]);
export const orderStatusEnum = pgEnum("order_status", ["OPEN", "FILLED", "CANCELLED"]);

export const botsTable = pgTable("bots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  mode: botModeEnum("mode").notNull(),
  lowerPrice: real("lower_price").notNull(),
  upperPrice: real("upper_price").notNull(),
  gridCount: integer("grid_count").notNull(),
  investment: real("investment").notNull(),
  leverage: integer("leverage").notNull().default(1),
  accountPubkey: text("account_pubkey").notNull(),
  status: botStatusEnum("status").notNull().default("IDLE"),
  stopLoss: real("stop_loss"),
  takeProfit: real("take_profit"),
  totalPnl: real("total_pnl"),
  totalTrades: integer("total_trades"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const botOrdersTable = pgTable("bot_orders", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").notNull().references(() => botsTable.id, { onDelete: "cascade" }),
  orderId: text("order_id").notNull(),
  side: orderSideEnum("side").notNull(),
  price: real("price").notNull(),
  size: real("size").notNull(),
  status: orderStatusEnum("status").notNull().default("OPEN"),
  pnl: real("pnl"),
  filledAt: timestamp("filled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBotSchema = createInsertSchema(botsTable).omit({ id: true, createdAt: true, updatedAt: true, status: true, totalPnl: true, totalTrades: true });
export const insertBotOrderSchema = createInsertSchema(botOrdersTable).omit({ id: true, createdAt: true });

export type Bot = typeof botsTable.$inferSelect;
export type InsertBot = z.infer<typeof insertBotSchema>;
export type BotOrder = typeof botOrdersTable.$inferSelect;
export type InsertBotOrder = z.infer<typeof insertBotOrderSchema>;
