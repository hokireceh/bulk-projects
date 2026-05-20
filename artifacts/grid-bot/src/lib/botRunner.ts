import { sizePerGrid } from "./gridEngine";
import { buildAndSign, submitTransaction, cancelAllOrders } from "./signing";

// All HTTP requests go through our API proxy to avoid browser CORS restrictions.
const PROXY_API = "/api";
const STAGING_WS = "wss://staging-ws.bulk.trade";

// Polling interval for price-based crossing detection (ms)
const PRICE_POLL_INTERVAL_MS = 5_000;

// Max orders to place per crossing event (when price skips multiple levels)
const MAX_GRID_ORDERS_PER_CROSSING = 5;

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
}

export type LogLine = { ts: number; msg: string };

export interface MarginData {
  totalBalance: number;
  availableBalance: number;
  marginUsed: number;
  notional: number;
  realizedPnl: number;
  unrealizedPnl: number;
  fees: number;
  funding: number;
}

export interface PositionData {
  symbol: string;
  size: number;
  price: number;
  fairPrice: number;
  notional: number;
  realizedPnl: number;
  unrealizedPnl: number;
  leverage: number;
  liquidationPrice: number;
  fees: number;
  funding: number;
}

export interface LiveOrder {
  orderId: string;
  symbol: string;
  price: number;
  originalSize: number;
  size: number;
  filledSize: number;
  isBuy: boolean;
  status: string;
  timestamp: number;
}

export class BotRunner {
  private running = false;
  private ws: WebSocket | null = null;
  private pricePoller: ReturnType<typeof setInterval> | null = null;

  // Level-crossing state (reference: extendedGridStates)
  private lastLevel: number | null = null;
  private gridCheckInFlight = false;

  public currentPrice = 0;
  public logs: LogLine[] = [];
  private onUpdate?: () => void;
  private storageKey: string;

  // Live data from bulk.trade account stream
  public margin: MarginData | null = null;
  public position: PositionData | null = null;
  public openOrders: LiveOrder[] = [];
  public totalTrades = 0;

  constructor(private config: BotConfig, onUpdate?: () => void) {
    this.onUpdate = onUpdate;
    this.storageKey = `bot_logs_${config.botId}`;
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) this.logs = JSON.parse(saved) as LogLine[];
    } catch { /* ignore */ }
  }

  get isRunning() { return this.running; }

  private log(msg: string) {
    this.logs.push({ ts: Date.now(), msg });
    if (this.logs.length > 300) this.logs.shift();
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.logs)); } catch { /* ignore */ }
    this.onUpdate?.();
  }

  // ── Grid math helpers ───────────────────────────────────────────────────────

  private get gridSpacing(): number {
    return (this.config.upperPrice - this.config.lowerPrice) / this.config.gridCount;
  }

  /**
   * Compute which grid band the price is in.
   * Level 0 = [lower, lower+spacing), level N-1 = [upper-spacing, upper].
   * Clamped to [0, gridCount-1] so out-of-range prices don't break logic.
   * Mirror: extendedBotEngine CROSS-CURRENTLEVEL-LOWERBOUND-001
   */
  private computeCurrentLevel(price: number): number {
    const spacing = this.gridSpacing;
    return Math.max(0, Math.min(
      Math.floor((price - this.config.lowerPrice) / spacing),
      this.config.gridCount - 1
    ));
  }

  /**
   * Exact price of a grid level index (rounded to 2dp to avoid float drift).
   */
  private levelBasePrice(levelIndex: number): number {
    return Math.round((this.config.lowerPrice + levelIndex * this.gridSpacing) * 100) / 100;
  }

  /**
   * Side order constraint per mode:
   * LONG:    BUY=opening (ok), SELL=reduce-only (close long)
   * SHORT:   SELL=opening (ok), BUY=reduce-only (close short)
   * NEUTRAL: both directions, never reduce-only
   */
  private computeReduceOnly(side: "BUY" | "SELL"): boolean {
    if (this.config.mode === "LONG")  return side === "SELL";
    if (this.config.mode === "SHORT") return side === "BUY";
    return false;
  }

  // ── Start ───────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.logs = [];
    this.lastLevel = null;
    this.totalTrades = 0;
    this.log(`Starting bot #${this.config.botId} [${this.config.symbol}] mode=${this.config.mode}`);

    // Validate config
    if (!this.config.gridCount || this.config.lowerPrice >= this.config.upperPrice) {
      this.log("✗ Invalid grid config: gridCount=0 or lower >= upper");
      this.running = false;
      this.onUpdate?.();
      return;
    }

    try {
      // 1. Fetch current mark price
      const price = await this.fetchMarkPrice();
      if (!price) throw new Error("Could not determine current price");
      this.currentPrice = price;
      this.log(`Mark price: ${price}`);

      // 2. Cancel any existing open orders for this symbol
      this.log("Cancelling existing orders...");
      const cancelled = await cancelAllOrders({
        privateKey: this.config.privateKey,
        account: this.config.accountPubkey,
        symbol: this.config.symbol,
        endpoint: PROXY_API,
      });
      this.log(cancelled ? "Existing orders cancelled." : "Cancel returned error (may be none open).");

      // 3. Initialize grid level state — no upfront order placement.
      // On the FIRST tick the lastLevel is set; orders only fire on subsequent crossings.
      this.lastLevel = null;

      this.log(
        `Grid initialized: ${this.config.gridCount} levels | ` +
        `range ${this.config.lowerPrice}–${this.config.upperPrice} | ` +
        `spacing ${this.gridSpacing.toFixed(2)}`
      );
      this.log("Waiting for first price tick to set baseline level…");

      // 4. Connect account WS (margin / position / order tracking)
      this.connectWebSocket();

      // 5. Start price poller → drives crossing detection
      this.startPricePoller();

    } catch (err) {
      this.log(`Error starting bot: ${err}`);
      this.running = false;
      this.onUpdate?.();
    }
  }

  // ── Price poller (primary crossing trigger) ─────────────────────────────────

  private startPricePoller() {
    this.pricePoller = setInterval(async () => {
      if (!this.running) return;
      const price = await this.fetchMarkPrice();
      if (!price) return;
      this.currentPrice = price;
      this.onUpdate?.();
      await this.runGridCheck(price);
    }, PRICE_POLL_INTERVAL_MS);
  }

  private async fetchMarkPrice(): Promise<number | null> {
    try {
      const res = await fetch(`${PROXY_API}/markets/${encodeURIComponent(this.config.symbol)}/ticker`);
      if (!res.ok) return null;
      const body = await res.json() as any;
      const p = Number(body.markPrice ?? body.lastPrice ?? 0);
      return p > 0 ? p : null;
    } catch {
      return null;
    }
  }

  // ── Level-crossing detection ────────────────────────────────────────────────

  /**
   * Core grid logic — mirrors extExecuteGridCheck from extendedBotEngine.ts.
   *
   * Algorithm:
   *   1. Compute currentLevel = floor((price - lower) / spacing), clamped [0, N-1]
   *   2. If lastLevel is null → initialize (no order placed on first tick)
   *   3. If currentLevel === lastLevel → no crossing, skip
   *   4. levelsMoved = currentLevel - lastLevel
   *      - negative (price dropped) → BUY
   *      - positive (price rose)    → SELL
   *   5. Place up to MAX_GRID_ORDERS_PER_CROSSING orders at exact level prices
   *   6. Update lastLevel
   */
  private async runGridCheck(price: number): Promise<void> {
    if (!this.running || this.gridCheckInFlight) return;
    this.gridCheckInFlight = true;

    try {
      // Out-of-range guard
      if (price < this.config.lowerPrice || price > this.config.upperPrice) {
        this.log(`⚠ Price ${price.toFixed(2)} out of range [${this.config.lowerPrice}–${this.config.upperPrice}] — no order`);
        return;
      }

      const currentLevel = this.computeCurrentLevel(price);

      // First tick: initialize baseline, place no orders
      if (this.lastLevel === null) {
        this.lastLevel = currentLevel;
        this.log(`Grid baseline set: level ${currentLevel}/${this.config.gridCount} @ $${price.toFixed(2)}`);
        return;
      }

      if (currentLevel === this.lastLevel) {
        // No crossing — silent (avoid log spam)
        return;
      }

      const levelsMoved = currentLevel - this.lastLevel;
      const direction = levelsMoved < 0 ? "down" : "up";
      const side: "BUY" | "SELL" = levelsMoved < 0 ? "BUY" : "SELL";
      const reduceOnly = this.computeReduceOnly(side);

      // Mode constraint: LONG only opens via BUY (and reduces via SELL);
      // SHORT only opens via SELL (and reduces via BUY).
      // For reduce-only we still place — it closes existing position.
      const prevLevel = this.lastLevel;
      this.lastLevel = currentLevel; // update immediately to prevent re-trigger

      this.log(
        `Grid crossing: ${Math.abs(levelsMoved)} level(s) ${direction} | ` +
        `${prevLevel} → ${currentLevel} | $${price.toFixed(2)} | → ${side}${reduceOnly ? " (reduceOnly)" : ""}`
      );

      const orderCount = Math.min(Math.abs(levelsMoved), MAX_GRID_ORDERS_PER_CROSSING);

      for (let i = 0; i < orderCount; i++) {
        if (!this.running) break;

        // Level index for this iteration
        const levelIdx = levelsMoved < 0
          ? prevLevel - i - 1  // going down: place at prevLevel-1, prevLevel-2, …
          : prevLevel + i + 1; // going up:   place at prevLevel+1, prevLevel+2, …

        // Clamp to valid range
        if (levelIdx < 0 || levelIdx >= this.config.gridCount + 1) continue;

        const orderPrice = this.levelBasePrice(levelIdx);
        const size = sizePerGrid(this.config.investment, this.config.gridCount, orderPrice, this.config.leverage);

        const tx = buildAndSign(
          [{ type: "l", symbol: this.config.symbol, isBuy: side === "BUY", price: orderPrice, size, tif: "GTC", reduceOnly, iso: true }],
          this.config.accountPubkey,
          this.config.privateKey
        );

        const result = await submitTransaction(tx, PROXY_API);
        if (result.ok) {
          this.totalTrades++;
          const st = result.statuses?.[0] as any;
          const oid = st?.resting?.oid ?? st?.filled?.oid ?? "?";
          this.log(`✓ ${side} ${size.toFixed(6)} @ ${orderPrice.toFixed(2)} (${String(oid).slice(0, 8)}…)`);
        } else {
          this.log(`✗ Failed ${side} @ ${orderPrice.toFixed(2)}: ${result.error}`);
        }

        await new Promise(r => setTimeout(r, 150));
      }

    } finally {
      this.gridCheckInFlight = false;
    }
  }

  // ── WebSocket account stream ─────────────────────────────────────────────────

  private connectWebSocket() {
    if (!this.running) return;
    this.log("Connecting WebSocket account stream...");

    this.ws = new WebSocket(STAGING_WS);

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

    this.ws.onerror = () => { this.log("WebSocket error."); };
  }

  // Bulk.trade WS account stream:
  // { type: "account", data: { type: "accountSnapshot"|"marginUpdate"|"positionUpdate"|"orderUpdate"|"fill"|..., ... } }
  private handleWsMessage(msg: any) {
    if (msg.type === "subscriptionResponse") return;
    if (msg.type !== "account") return;

    const data = msg.data;
    if (!data?.type) return;

    switch (data.type) {
      case "accountSnapshot":  this.handleSnapshot(data);      break;
      case "marginUpdate":     this.handleMarginUpdate(data);  break;
      case "positionUpdate":   this.handlePositionUpdate(data); break;
      case "orderUpdate":      this.handleOrderUpdate(data);   break;
      case "fill":             this.handleFill(data);          break;
    }
  }

  private handleSnapshot(data: any) {
    if (data.margin) {
      this.margin = {
        totalBalance:     Number(data.margin.totalBalance     ?? 0),
        availableBalance: Number(data.margin.availableBalance ?? 0),
        marginUsed:       Number(data.margin.marginUsed       ?? 0),
        notional:         Number(data.margin.notional         ?? 0),
        realizedPnl:      Number(data.margin.realizedPnl      ?? 0),
        unrealizedPnl:    Number(data.margin.unrealizedPnl    ?? 0),
        fees:             Number(data.margin.fees             ?? 0),
        funding:          Number(data.margin.funding          ?? 0),
      };
    }
    if (Array.isArray(data.positions)) {
      const pos = data.positions.find((p: any) => p.symbol === this.config.symbol);
      if (pos) this.position = this.parsePosition(pos);
    }
    if (Array.isArray(data.openOrders)) {
      this.openOrders = data.openOrders
        .filter((o: any) => o.symbol === this.config.symbol)
        .map((o: any) => this.parseOpenOrder(o));
    }
    this.log(`Account snapshot: balance=${this.margin?.totalBalance?.toFixed(2) ?? "?"} realizedPnl=${this.margin?.realizedPnl?.toFixed(4) ?? "?"}`);
    this.onUpdate?.();
  }

  private handleMarginUpdate(data: any) {
    this.margin = {
      totalBalance:     Number(data.totalBalance     ?? this.margin?.totalBalance     ?? 0),
      availableBalance: Number(data.availableBalance ?? this.margin?.availableBalance ?? 0),
      marginUsed:       Number(data.marginUsed       ?? this.margin?.marginUsed       ?? 0),
      notional:         Number(data.notional         ?? this.margin?.notional         ?? 0),
      realizedPnl:      Number(data.realizedPnl      ?? this.margin?.realizedPnl      ?? 0),
      unrealizedPnl:    Number(data.unrealizedPnl    ?? this.margin?.unrealizedPnl    ?? 0),
      fees:             Number(data.fees             ?? this.margin?.fees             ?? 0),
      funding:          Number(data.funding          ?? this.margin?.funding          ?? 0),
    };
    this.onUpdate?.();
  }

  private handlePositionUpdate(data: any) {
    if (data.symbol !== this.config.symbol) return;
    this.position = this.parsePosition(data);
    this.onUpdate?.();
  }

  private handleOrderUpdate(data: any) {
    if (data.sym !== this.config.symbol) return;
    const isBuy = (data.origSz ?? 0) > 0;
    const terminal = [
      "filled", "partiallyFilled", "cancelled", "cancelledRiskLimit",
      "cancelledSelfCrossing", "cancelledReduceOnly", "cancelledIoc",
      "rejectedInvalid", "rejectedRiskLimit", "rejectedCrossing", "rejectedDuplicate",
      "siblingCancelled", "triggerFailed",
    ].includes(data.status);

    if (terminal) {
      this.openOrders = this.openOrders.filter(o => o.orderId !== data.oid);
    } else {
      const existing = this.openOrders.findIndex(o => o.orderId === data.oid);
      const order: LiveOrder = {
        orderId:      data.oid,
        symbol:       data.sym,
        price:        Number(data.px     ?? 0),
        originalSize: Math.abs(Number(data.origSz ?? 0)),
        size:         Math.abs(Number(data.sz     ?? 0)),
        filledSize:   Number(data.fillSz ?? 0),
        isBuy,
        status:       data.status,
        timestamp:    Number(data.ts ?? 0),
      };
      if (existing >= 0) this.openOrders[existing] = order;
      else               this.openOrders.push(order);
    }
    this.onUpdate?.();
  }

  private handleFill(data: any) {
    if (data.symbol !== this.config.symbol) return;
    const filledPrice = Number(data.price);
    const filledSize  = Number(data.size);
    const isBuy       = Boolean(data.isBuy);
    const fee         = Number(data.fee ?? 0);
    this.log(`Fill: ${isBuy ? "BUY" : "SELL"} ${filledSize.toFixed(6)} @ ${filledPrice.toFixed(2)} fee=${fee.toFixed(4)}`);

    // Crossing detection handles order placement — no manual replenish needed here.
    // The next price poll will fire runGridCheck and react to the new level naturally.
    this.onUpdate?.();
  }

  private parsePosition(p: any): PositionData {
    return {
      symbol:           String(p.symbol          ?? ""),
      size:             Number(p.size            ?? 0),
      price:            Number(p.price           ?? 0),
      fairPrice:        Number(p.fairPrice       ?? 0),
      notional:         Number(p.notional        ?? 0),
      realizedPnl:      Number(p.realizedPnl     ?? 0),
      unrealizedPnl:    Number(p.unrealizedPnl   ?? 0),
      leverage:         Number(p.leverage        ?? 0),
      liquidationPrice: Number(p.liquidationPrice ?? 0),
      fees:             Number(p.fees            ?? 0),
      funding:          Number(p.funding         ?? 0),
    };
  }

  private parseOpenOrder(o: any): LiveOrder {
    const origSz = Number(o.originalSize ?? o.origSz ?? 0);
    return {
      orderId:      String(o.orderId      ?? o.oid ?? ""),
      symbol:       String(o.symbol       ?? o.sym ?? ""),
      price:        Number(o.price        ?? o.px  ?? 0),
      originalSize: Math.abs(origSz),
      size:         Math.abs(Number(o.size ?? o.sz ?? 0)),
      filledSize:   Number(o.filledSize   ?? o.fillSz ?? 0),
      isBuy:        origSz > 0,
      status:       String(o.status       ?? ""),
      timestamp:    Number(o.timestamp    ?? o.ts  ?? 0),
    };
  }

  // ── Stop ────────────────────────────────────────────────────────────────────

  async stop(): Promise<void> {
    this.running = false;
    this.lastLevel = null;
    this.log("Stopping bot...");

    if (this.pricePoller !== null) {
      clearInterval(this.pricePoller);
      this.pricePoller = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.log("Cancelling all grid orders...");
    const cancelled = await cancelAllOrders({
      privateKey: this.config.privateKey,
      account: this.config.accountPubkey,
      symbol: this.config.symbol,
      endpoint: PROXY_API,
    });
    this.log(cancelled ? "All orders cancelled. Bot stopped." : "Cancel error. Bot stopped.");
    this.onUpdate?.();
  }
}
