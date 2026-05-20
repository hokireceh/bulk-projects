import { Router, type IRouter } from "express";
import { eq, desc, sum, count, and } from "drizzle-orm";
import { db, botsTable, botOrdersTable } from "@workspace/db";
import {
  CreateBotBody,
  UpdateBotBody,
  GetBotParams,
  UpdateBotParams,
  DeleteBotParams,
  StartBotParams,
  StopBotParams,
  GetBotOrdersParams,
  AddBotOrderParams,
  AddBotOrderBody,
  GetBotStatsParams,
  GetBotResponse,
  ListBotsResponse,
  GetBotOrdersResponse,
  GetBotStatsResponse,
  StartBotResponse,
  StopBotResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/bots", async (req, res): Promise<void> => {
  const bots = await db.select().from(botsTable).orderBy(desc(botsTable.createdAt));
  res.json(ListBotsResponse.parse(bots));
});

router.post("/bots", async (req, res): Promise<void> => {
  const parsed = CreateBotBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid create bot body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [bot] = await db.insert(botsTable).values({
    name: parsed.data.name,
    symbol: parsed.data.symbol,
    mode: parsed.data.mode,
    lowerPrice: parsed.data.lowerPrice,
    upperPrice: parsed.data.upperPrice,
    gridCount: parsed.data.gridCount,
    investment: parsed.data.investment,
    leverage: parsed.data.leverage ?? 1,
    accountPubkey: parsed.data.accountPubkey,
    orderMode: parsed.data.orderMode ?? "REACTIVE",
    stopLoss: parsed.data.stopLoss ?? null,
    takeProfit: parsed.data.takeProfit ?? null,
    status: "IDLE",
  }).returning();

  res.status(201).json(GetBotResponse.parse(bot));
});

router.get("/bots/:id", async (req, res): Promise<void> => {
  const params = GetBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, params.data.id));
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  res.json(GetBotResponse.parse(bot));
});

router.patch("/bots/:id", async (req, res): Promise<void> => {
  const params = UpdateBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.mode !== undefined) updateData.mode = parsed.data.mode;
  if (parsed.data.lowerPrice !== undefined) updateData.lowerPrice = parsed.data.lowerPrice;
  if (parsed.data.upperPrice !== undefined) updateData.upperPrice = parsed.data.upperPrice;
  if (parsed.data.gridCount !== undefined) updateData.gridCount = parsed.data.gridCount;
  if (parsed.data.investment !== undefined) updateData.investment = parsed.data.investment;
  if (parsed.data.leverage !== undefined) updateData.leverage = parsed.data.leverage;
  if (parsed.data.orderMode !== undefined) updateData.orderMode = parsed.data.orderMode;
  if (parsed.data.stopLoss !== undefined) updateData.stopLoss = parsed.data.stopLoss ?? null;
  if (parsed.data.takeProfit !== undefined) updateData.takeProfit = parsed.data.takeProfit ?? null;

  const [bot] = await db
    .update(botsTable)
    .set(updateData)
    .where(eq(botsTable.id, params.data.id))
    .returning();

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  res.json(GetBotResponse.parse(bot));
});

router.delete("/bots/:id", async (req, res): Promise<void> => {
  const params = DeleteBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [bot] = await db.delete(botsTable).where(eq(botsTable.id, params.data.id)).returning();
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/bots/:id/start", async (req, res): Promise<void> => {
  const params = StartBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [bot] = await db
    .update(botsTable)
    .set({ status: "RUNNING", updatedAt: new Date() })
    .where(eq(botsTable.id, params.data.id))
    .returning();

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  req.log.info({ botId: bot.id }, "Bot started");
  res.json(StartBotResponse.parse(bot));
});

router.post("/bots/:id/stop", async (req, res): Promise<void> => {
  const params = StopBotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [bot] = await db
    .update(botsTable)
    .set({ status: "STOPPED", updatedAt: new Date() })
    .where(eq(botsTable.id, params.data.id))
    .returning();

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  req.log.info({ botId: bot.id }, "Bot stopped");
  res.json(StopBotResponse.parse(bot));
});

router.get("/bots/:id/orders", async (req, res): Promise<void> => {
  const params = GetBotOrdersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const orders = await db
    .select()
    .from(botOrdersTable)
    .where(eq(botOrdersTable.botId, params.data.id))
    .orderBy(desc(botOrdersTable.createdAt))
    .limit(200);

  res.json(GetBotOrdersResponse.parse(orders));
});

router.post("/bots/:id/orders", async (req, res): Promise<void> => {
  const params = AddBotOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddBotOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db.insert(botOrdersTable).values({
    botId: params.data.id,
    orderId: parsed.data.orderId,
    side: parsed.data.side,
    price: parsed.data.price,
    size: parsed.data.size,
    status: parsed.data.status,
    pnl: parsed.data.pnl ?? undefined,
  }).returning();

  res.status(201).json(order);
});

router.get("/bots/:id/stats", async (req, res): Promise<void> => {
  const params = GetBotStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const botId = params.data.id;

  const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const ordersAgg = await db
    .select({
      totalOrders: count(),
    })
    .from(botOrdersTable)
    .where(eq(botOrdersTable.botId, botId));

  const filledOrders = await db
    .select({
      totalTrades: count(),
      realizedPnl: sum(botOrdersTable.pnl),
    })
    .from(botOrdersTable)
    .where(and(eq(botOrdersTable.botId, botId), eq(botOrdersTable.status, "FILLED")));

  const openOrders = await db
    .select({ cnt: count() })
    .from(botOrdersTable)
    .where(and(eq(botOrdersTable.botId, botId), eq(botOrdersTable.status, "OPEN")));

  const totalOrders = Number(ordersAgg[0]?.totalOrders ?? 0);
  const totalTrades = Number(filledOrders[0]?.totalTrades ?? 0);
  const realizedPnl = Number(filledOrders[0]?.realizedPnl ?? 0);
  const openOrdersCount = Number(openOrders[0]?.cnt ?? 0);

  const stats = {
    botId,
    totalPnl: realizedPnl,
    realizedPnl,
    unrealizedPnl: 0,
    totalTrades,
    totalOrders,
    openOrders: openOrdersCount,
  };

  res.json(GetBotStatsResponse.parse(stats));
});

export default router;
