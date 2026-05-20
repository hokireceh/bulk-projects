import { calculateGridLevels, sizePerGrid } from "./gridEngine";
import { buildAndSign, submitTransaction, cancelAllOrders } from "./signing";

const STAGING_HTTP = "https://staging-api.bulk.trade/api/v1";
const STAGING_WS = "wss://staging-ws.bulk.trade";

export interface BotConfig {
  botId: number;
  accountPubkey: string;
  privateKey: string;
  symbol: string;
  mode: "LONG" | "SHORT" | "NEUTRAL";
  lowerPrice: number;
  upperPrice: number;
  gridCount: number;
  investment: number;
  leverage: number;
  httpEndpoint?: string;
  wsEndpoint?: string;
}

export type LogLine = { ts: number; msg: string };

export class BotRunner {
  private running = false;
  private ws: WebSocket | null = null;
  private currentPrice = 0;
  public logs: LogLine[] = [];
  private onUpdate?: () => void;

  constructor(
    private config: BotConfig,
    onUpdate?: () => void
  ) {
    this.onUpdate = onUpdate;
  }

  get isRunning() { return this.running; }

  private get http() { return this.config.httpEndpoint ?? STAGING_HTTP; }
  private get wsUrl() { return this.config.wsEndpoint ?? STAGING_WS; }

  private log(msg: string) {
    this.logs.push({ ts: Date.now(), msg });
    if (this.logs.length > 200) this.logs.shift();
    this.onUpdate?.();
  }

  // ── Start ───────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.logs = [];
    this.log(`Starting bot #${this.config.botId} for ${this.config.symbol} (${this.config.mode})`);

    try {
      // 1. Fetch current mark price
      const tickerRes = await fetch(
        `${this.http}/ticker/${encodeURIComponent(this.config.symbol)}`
      );
      if (!tickerRes.ok) throw new Error(`Ticker fetch failed: ${tickerRes.status}`);
      const ticker = await tickerRes.json() as any;
      this.currentPrice = Number(ticker.markPrice ?? ticker.lastPrice ?? 0);
      if (!this.currentPrice) throw new Error("Could not determine current price");
      this.log(`Mark price: ${this.currentPrice}`);

      // 2. Cancel any existing orders for this symbol
      this.log("Cancelling existing orders...");
      const cancelled = await cancelAllOrders({
        privateKey: this.config.privateKey,
        account: this.config.accountPubkey,
        symbol: this.config.symbol,
        endpoint: this.http,
      });
      this.log(cancelled ? "Existing orders cancelled." : "Cancel returned error (may be none open).");

      // 3. Calculate grid levels
      const levels = calculateGridLevels(
        this.config.lowerPrice,
        this.config.upperPrice,
        this.config.gridCount,
        this.config.mode,
        this.currentPrice
      );
      this.log(`Placing ${levels.length} grid orders...`);

      // 4. Place orders one by one (small delay to avoid rate limits)
      let placed = 0;
      for (const level of levels) {
        if (!this.running) break;
        const size = sizePerGrid(this.config.investment, this.config.gridCount, level.price);
        const isBuy = level.side === "BUY";

        const tx = buildAndSign(
          [{ type: "l", symbol: this.config.symbol, isBuy, price: level.price, size, tif: "GTC", reduceOnly: false, iso: false }],
          this.config.accountPubkey,
          this.config.privateKey
        );
        const result = await submitTransaction(tx, this.http);
        if (result.ok) {
          placed++;
          const st = (result.statuses?.[0] as any);
          const oid = st?.resting?.oid ?? st?.filled?.oid ?? "?";
          this.log(`✓ ${level.side} ${size.toFixed(6)} @ ${level.price.toFixed(2)} (${oid.slice(0, 8)}…)`);
        } else {
          this.log(`✗ Failed ${level.side} @ ${level.price.toFixed(2)}: ${result.error}`);
        }
        // 150ms between orders
        await new Promise(r => setTimeout(r, 150));
      }

      this.log(`Grid active: ${placed}/${levels.length} orders placed.`);

      // 5. Subscribe to account stream via WebSocket
      this.connectWebSocket();

    } catch (err) {
      this.log(`Error: ${err}`);
      this.running = false;
      this.onUpdate?.();
    }
  }

  // ── WebSocket account stream ────────────────────────────────────────────────

  private connectWebSocket() {
    if (!this.running) return;
    this.log("Connecting WebSocket account stream...");

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.log("WebSocket connected.");
      this.ws!.send(JSON.stringify({
        method: "subscribe",
        subscription: [{ type: "account", user: this.config.accountPubkey }],
      }));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        this.handleWsMessage(msg);
      } catch { /* ignore */ }
    };

    this.ws.onclose = () => {
      if (this.running) {
        this.log("WebSocket disconnected. Reconnecting in 3s...");
        setTimeout(() => this.connectWebSocket(), 3000);
      }
    };

    this.ws.onerror = () => {
      this.log("WebSocket error.");
    };
  }

  private handleWsMessage(msg: any) {
    // Account stream fill event — replenish the grid
    const fill = msg.fills ?? (msg.type === "fill" ? msg : null);
    if (!fill) return;
    if (fill.symbol !== this.config.symbol) return;

    const filledPrice = Number(fill.price);
    const filledSize  = Number(fill.amount);
    const wasBuy      = Boolean(fill.isBuy);
    this.log(`Fill: ${wasBuy ? "BUY" : "SELL"} ${filledSize.toFixed(6)} @ ${filledPrice.toFixed(2)}`);

    if (!this.running) return;

    // Replenish: filled BUY → place SELL one step up; filled SELL → place BUY one step down
    const step = (this.config.upperPrice - this.config.lowerPrice) / this.config.gridCount;
    const replenishIsBuy = !wasBuy;
    const replenishPrice = replenishIsBuy
      ? Math.max(filledPrice - step, this.config.lowerPrice)
      : Math.min(filledPrice + step, this.config.upperPrice);

    // Mode constraints
    const allowed =
      this.config.mode === "NEUTRAL" ||
      (this.config.mode === "LONG"  && replenishIsBuy) ||
      (this.config.mode === "SHORT" && !replenishIsBuy);

    if (!allowed || replenishPrice === filledPrice) return;

    const size = sizePerGrid(this.config.investment, this.config.gridCount, replenishPrice);
    const tx = buildAndSign(
      [{ type: "l", symbol: this.config.symbol, isBuy: replenishIsBuy, price: replenishPrice, size, tif: "GTC", reduceOnly: false, iso: false }],
      this.config.accountPubkey,
      this.config.privateKey
    );
    submitTransaction(tx, this.http).then((result) => {
      if (result.ok) {
        this.log(`↺ Replenish ${replenishIsBuy ? "BUY" : "SELL"} ${size.toFixed(6)} @ ${replenishPrice.toFixed(2)}`);
      } else {
        this.log(`✗ Replenish failed @ ${replenishPrice.toFixed(2)}: ${result.error}`);
      }
    });
  }

  // ── Stop ────────────────────────────────────────────────────────────────────

  async stop(): Promise<void> {
    this.running = false;
    this.log("Stopping bot...");

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.log("Cancelling all grid orders...");
    const cancelled = await cancelAllOrders({
      privateKey: this.config.privateKey,
      account: this.config.accountPubkey,
      symbol: this.config.symbol,
      endpoint: this.http,
    });
    this.log(cancelled ? "All orders cancelled. Bot stopped." : "Cancel error. Bot stopped.");
    this.onUpdate?.();
  }
}

// ── Singleton registry (survives re-renders) ──────────────────────────────────

const runners = new Map<number, BotRunner>();

export function getRunner(botId: number): BotRunner | undefined {
  return runners.get(botId);
}

export function createOrGetRunner(config: BotConfig, onUpdate: () => void): BotRunner {
  const existing = runners.get(config.botId);
  if (existing) return existing;
  const runner = new BotRunner(config, onUpdate);
  runners.set(config.botId, runner);
  return runner;
}

export function destroyRunner(botId: number) {
  runners.delete(botId);
}
