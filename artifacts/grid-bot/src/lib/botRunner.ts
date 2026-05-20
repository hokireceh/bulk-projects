import { sizePerGrid } from "./gridEngine";
import { buildAndSign, submitTransaction, cancelAllOrders } from "./signing";
import { getEndpoint } from "./keys";

const PROXY_API = "/api";
const WS_URLS: Record<string, string> = {
  staging:    "wss://staging-ws.bulk.trade",
  production: "wss://ws.bulk.trade",
};

const PRICE_POLL_INTERVAL_MS = 5_000;
const MAX_GRID_ORDERS_PER_CROSSING = 5;

// Cooldown before placing another order at the same level+side (ms)
// Prevents duplicate orders when price bounces across a boundary rapidly.
// Mirror: extendedBotEngine BUG-DUP-001
const DUP_GUARD_MS = 30_000;

// Minimum time between out-of-range log lines (ms) to avoid log spam
const OUT_OF_RANGE_LOG_INTERVAL_MS = 60_000;

export interface BotConfig {
  botId: number;
  accountPubkey: string;
  privateKey: string;
  symbol: string;
  mode: "LONG" | "SHORT" | "NEUTRAL";
  orderMode: "UPFRONT" | "REACTIVE";
  lowerPrice: number;
  upperPrice: number;
  gridCount: number;
  investment: number;
  leverage: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
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

  // Level-crossing state
  // Mirror: extendedBotEngine EXT-02 — persist lastLevel so bot survives page refresh
  lastLevel: number | null = null;
  private gridCheckInFlight = false;

  // BUG-DUP-001: tracks recently placed level+side pairs to suppress duplicates
  // key = `${levelIdx}:${side}`, value = timestamp of last placement
  private recentOrders = new Map<string, number>();

  // Out-of-range log throttle (mirror: extendedBotEngine extOutOfRangeNotifAt)
  private lastOutOfRangeLogAt = 0;

  // EXT-02: localStorage key for persisting lastLevel across page refreshes
  private stateKey: string;

  public currentPrice = 0;
  public logs: LogLine[] = [];
  private onUpdate?: () => void;
  private onStopped?: () => void;
  private storageKey: string;

  // Live data from bulk.trade account stream
  public margin: MarginData | null = null;
  public position: PositionData | null = null;
  public openOrders: LiveOrder[] = [];
  public totalTrades = 0;

  constructor(private config: BotConfig, onUpdate?: () => void, onStopped?: () => void) {
    this.onUpdate  = onUpdate;
    this.onStopped = onStopped;
    this.storageKey = `bot_logs_${config.botId}`;
    this.stateKey   = `bot_state_${config.botId}`;
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
   * Clamped to [0, gridCount-1].
   * Mirror: extendedBotEngine CROSS-CURRENTLEVEL-LOWERBOUND-001
   */
  private computeCurrentLevel(price: number): number {
    const spacing = this.gridSpacing;
    return Math.max(0, Math.min(
      Math.floor((price - this.config.lowerPrice) / spacing),
      this.config.gridCount - 1
    ));
  }

  /** Exact price of a grid level index (2dp to avoid float drift). */
  private levelBasePrice(levelIndex: number): number {
    return Math.round((this.config.lowerPrice + levelIndex * this.gridSpacing) * 100) / 100;
  }

  /**
   * LONG:    BUY=opening, SELL=reduce-only (close long)
   * SHORT:   SELL=opening, BUY=reduce-only (close short)
   * NEUTRAL: both sides, never reduce-only
   * Mirror: extendedBotEngine botLogic.ts computeReduceOnly
   */
  private computeReduceOnly(side: "BUY" | "SELL"): boolean {
    if (this.config.mode === "LONG")  return side === "SELL";
    if (this.config.mode === "SHORT") return side === "BUY";
    return false;
  }

  // ── EXT-02: lastLevel persistence ──────────────────────────────────────────

  /**
   * Persist lastLevel to localStorage so the bot survives page refreshes.
   * Mirror: extendedBotEngine EXT-02 (stores gridLastLevel in DB)
   */
  private persistLastLevel(level: number | null) {
    this.lastLevel = level;
    if (level !== null) {
      try {
        localStorage.setItem(this.stateKey, JSON.stringify({ lastLevel: level }));
      } catch { /* ignore */ }
    }
  }

  /**
   * Restore lastLevel from localStorage on bot start.
   * If restored, the bot resumes from the saved level instead of reinitializing.
   */
  private restoreLastLevel(): boolean {
    try {
      const saved = localStorage.getItem(this.stateKey);
      if (!saved) return false;
      const s = JSON.parse(saved) as { lastLevel?: number };
      if (typeof s.lastLevel === "number") {
        this.lastLevel = s.lastLevel;
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  // ── BUG-DUP-001: Duplicate order guard ─────────────────────────────────────

  /**
   * Returns true if an order at this level+side was placed recently (within DUP_GUARD_MS).
   * Prevents double-orders when price ticks rapidly back and forth across a boundary.
   * Mirror: extendedBotEngine BUG-DUP-001 existingPending check
   */
  private isDuplicateOrder(levelIdx: number, side: "BUY" | "SELL"): boolean {
    const key = `${levelIdx}:${side}`;
    const last = this.recentOrders.get(key);
    if (last !== undefined && Date.now() - last < DUP_GUARD_MS) return true;
    this.recentOrders.set(key, Date.now());
    return false;
  }

  // ── SL/TP check ─────────────────────────────────────────────────────────────

  /**
   * Mirror: extendedBotEngine botLogic.ts isSlTriggered / isTpTriggered
   * LONG/NEUTRAL: SL triggers if price < stopLoss, TP triggers if price > takeProfit
   * SHORT:        SL triggers if price > stopLoss, TP triggers if price < takeProfit
   */
  private checkSlTp(price: number): "sl" | "tp" | null {
    const { mode, stopLoss, takeProfit } = this.config;
    if (stopLoss != null) {
      const triggered = mode === "SHORT" ? price > stopLoss : price < stopLoss;
      if (triggered) return "sl";
    }
    if (takeProfit != null) {
      const triggered = mode === "SHORT" ? price < takeProfit : price > takeProfit;
      if (triggered) return "tp";
    }
    return null;
  }

  // ── Start ───────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.logs = [];
    this.totalTrades = 0;
    this.log(`Starting bot #${this.config.botId} [${this.config.symbol}] mode=${this.config.mode}`);

    if (!this.config.gridCount || this.config.lowerPrice >= this.config.upperPrice) {
      this.log("✗ Invalid grid config: gridCount=0 or lower >= upper");
      this.running = false;
      this.onUpdate?.();
      return;
    }

    if (this.config.stopLoss != null) {
      this.log(`Stop Loss: $${this.config.stopLoss.toFixed(2)}`);
    }
    if (this.config.takeProfit != null) {
      this.log(`Take Profit: $${this.config.takeProfit.toFixed(2)}`);
    }

    try {
      const price = await this.fetchMarkPrice();
      if (!price) throw new Error("Could not determine current price");
      this.currentPrice = price;
      this.log(`Mark price: $${price.toFixed(2)}`);

      this.log("Cancelling existing orders...");
      const cancelled = await cancelAllOrders({
        privateKey: this.config.privateKey,
        account: this.config.accountPubkey,
        symbol: this.config.symbol,
        endpoint: PROXY_API,
        env: getEndpoint(),
      });
      this.log(cancelled ? "Existing orders cancelled." : "Cancel returned error (may be none open).");

      this.log(
        `Grid initialized: ${this.config.gridCount} levels | ` +
        `range ${this.config.lowerPrice}–${this.config.upperPrice} | ` +
        `spacing ${this.gridSpacing.toFixed(2)} | ` +
        `mode=${this.config.orderMode}`
      );

      if (this.config.orderMode === "UPFRONT") {
        // UPFRONT: place all grid orders immediately, then only monitor SL/TP
        await this.placeAllOrdersUpfront(price);
      } else {
        // REACTIVE: restore lastLevel from localStorage if available
        const restored = this.restoreLastLevel();
        if (restored) {
          this.log(
            `Restored lastLevel=${this.lastLevel} from previous session | ` +
            `range ${this.config.lowerPrice}–${this.config.upperPrice} | ` +
            `spacing ${this.gridSpacing.toFixed(2)}`
          );
        } else {
          this.lastLevel = null;
          this.log("Waiting for first price tick to set baseline level…");
        }
      }

      this.connectWebSocket();
      this.startPricePoller();

    } catch (err) {
      this.log(`Error starting bot: ${err}`);
      this.running = false;
      this.onUpdate?.();
    }
  }

  // ── UPFRONT: place all grid orders at start ──────────────────────────────────

  /**
   * UPFRONT mode: place a limit order at every grid level immediately.
   *
   * LONG:    BUY at every level (accumulate longs; no reduce-only sells since no position yet)
   * SHORT:   SELL at every level (accumulate shorts; no reduce-only buys since no position yet)
   * NEUTRAL: BUY at levels ≤ current price, SELL at levels > current price
   */
  private async placeAllOrdersUpfront(currentPrice: number): Promise<void> {
    const currentLevel = this.computeCurrentLevel(currentPrice);
    this.log(`UPFRONT: placing all ${this.config.gridCount} grid orders @ mark $${currentPrice.toFixed(2)}…`);

    let placed = 0;
    let skipped = 0;

    for (let levelIdx = 0; levelIdx < this.config.gridCount; levelIdx++) {
      if (!this.running) break;

      const orderPrice = this.levelBasePrice(levelIdx);
      const size = sizePerGrid(this.config.investment, this.config.gridCount, orderPrice, this.config.leverage);

      if (size <= 0) { skipped++; continue; }

      let side: "BUY" | "SELL";
      if (this.config.mode === "LONG") {
        side = "BUY";
      } else if (this.config.mode === "SHORT") {
        side = "SELL";
      } else {
        // NEUTRAL: BUY below current price, SELL above
        side = levelIdx <= currentLevel ? "BUY" : "SELL";
      }

      const tx = buildAndSign(
        [{ type: "l", symbol: this.config.symbol, isBuy: side === "BUY", price: orderPrice, size, tif: "GTC", reduceOnly: false, iso: true }],
        this.config.accountPubkey,
        this.config.privateKey
      );

      const result = await submitTransaction(tx, PROXY_API, getEndpoint());
      if (result.ok) {
        placed++;
        this.totalTrades++;
        const st = result.statuses?.[0] as any;
        const oid = st?.resting?.oid ?? st?.filled?.oid ?? "?";
        this.log(`✓ UPFRONT ${side} ${size.toFixed(6)} @ ${orderPrice.toFixed(2)} (${String(oid).slice(0, 8)}…)`);
      } else {
        skipped++;
        this.log(`✗ UPFRONT ${side} @ ${orderPrice.toFixed(2)}: ${result.error}`);
      }

      await new Promise(r => setTimeout(r, 150));
    }

    this.log(`UPFRONT done: ${placed} orders placed, ${skipped} skipped.`);
    this.onUpdate?.();
  }

  // ── Price poller ─────────────────────────────────────────────────────────────

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
      const res = await fetch(`${PROXY_API}/markets/${encodeURIComponent(this.config.symbol)}/ticker`, {
        headers: { "x-bulk-env": getEndpoint() },
      });
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
   * Improvements over previous version:
   *   [EXT-SL/TP]    Check Stop Loss / Take Profit before crossing detection
   *   [EXT-02]       lastLevel persisted to localStorage (survives page refresh)
   *   [BUG-DUP-001]  Duplicate level+side guard with DUP_GUARD_MS cooldown
   *   [PRECHECK-001] reduceOnly orders check live position before placing
   *   [SIZE-GUARD]   Skip order if computed size is zero or negative
   *   [OOR-THROTTLE] Out-of-range log at most once per OUT_OF_RANGE_LOG_INTERVAL_MS
   */
  private async runGridCheck(price: number): Promise<void> {
    if (!this.running || this.gridCheckInFlight) return;
    this.gridCheckInFlight = true;

    try {
      // ── SL/TP check (mirror: extendedBotEngine SL/TP block) ─────────────────
      const sltp = this.checkSlTp(price);
      if (sltp === "sl") {
        this.log(`🛑 Stop Loss dipicu @ $${price.toFixed(2)} (SL: $${this.config.stopLoss}). Bot berhenti otomatis.`);
        this.gridCheckInFlight = false;
        await this.stop();
        return;
      }
      if (sltp === "tp") {
        this.log(`✅ Take Profit dipicu @ $${price.toFixed(2)} (TP: $${this.config.takeProfit}). Bot berhenti otomatis.`);
        this.gridCheckInFlight = false;
        await this.stop();
        return;
      }

      // ── Out-of-range guard (OOR-THROTTLE) ────────────────────────────────────
      if (price < this.config.lowerPrice || price > this.config.upperPrice) {
        const now = Date.now();
        if (now - this.lastOutOfRangeLogAt >= OUT_OF_RANGE_LOG_INTERVAL_MS) {
          this.log(`⚠ Price $${price.toFixed(2)} di luar range [${this.config.lowerPrice}–${this.config.upperPrice}] — menunggu…`);
          this.lastOutOfRangeLogAt = now;
        }
        return;
      }

      // UPFRONT mode: all orders already placed — only monitor SL/TP, no crossing logic
      if (this.config.orderMode === "UPFRONT") return;

      const currentLevel = this.computeCurrentLevel(price);

      // First tick: initialize baseline (EXT-02: also persist to localStorage)
      if (this.lastLevel === null) {
        this.persistLastLevel(currentLevel);
        this.log(`Grid baseline set: level ${currentLevel}/${this.config.gridCount} @ $${price.toFixed(2)}`);
        return;
      }

      if (currentLevel === this.lastLevel) return; // no crossing — silent

      const levelsMoved = currentLevel - this.lastLevel;
      const direction = levelsMoved < 0 ? "down" : "up";
      // Grid replenishment logic:
      // Price rose  → place BUY  at crossed levels (now below current = resting buy-on-dip orders)
      // Price fell  → place SELL at crossed levels (now above current = resting sell-on-bounce orders)
      // This ensures limit orders always rest on the book rather than crossing immediately.
      const side: "BUY" | "SELL" = levelsMoved < 0 ? "SELL" : "BUY";
      const reduceOnly = this.computeReduceOnly(side);

      const prevLevel = this.lastLevel;
      // EXT-02: persist new level immediately to prevent re-trigger
      this.persistLastLevel(currentLevel);

      this.log(
        `Grid crossing: ${Math.abs(levelsMoved)} level(s) ${direction} | ` +
        `${prevLevel} → ${currentLevel} | $${price.toFixed(2)} | → ${side}${reduceOnly ? " (reduceOnly)" : ""}`
      );

      // ── GRID-REDUCEONLY-PRECHECK-001 ──────────────────────────────────────────
      // Before sending reduceOnly order, verify a matching position exists.
      // LONG+SELL needs long position (size > 0); SHORT+BUY needs short position (size < 0).
      // Without this, the exchange will reject the reduceOnly order (no position to reduce).
      // Mirror: extendedBotEngine GRID-REDUCEONLY-PRECHECK-001
      if (reduceOnly) {
        const pos = this.position;
        const hasMatchingPosition =
          side === "SELL"
            ? pos !== null && pos.size > 0  // need long position to sell-reduce
            : pos !== null && pos.size < 0; // need short position to buy-reduce
        if (!hasMatchingPosition) {
          this.log(
            `Skip ${side} (reduceOnly): tidak ada posisi yang sesuai | ` +
            `pos=${pos ? pos.size.toFixed(6) : "null"} | level tetap di ${currentLevel}`
          );
          return;
        }
      }

      const orderCount = Math.min(Math.abs(levelsMoved), MAX_GRID_ORDERS_PER_CROSSING);

      for (let i = 0; i < orderCount; i++) {
        if (!this.running) break;

        const levelIdx = levelsMoved < 0
          ? prevLevel - i - 1
          : prevLevel + i + 1;

        if (levelIdx < 0 || levelIdx >= this.config.gridCount + 1) continue;

        // ── BUG-DUP-001: Duplicate order guard ────────────────────────────────
        if (this.isDuplicateOrder(levelIdx, side)) {
          this.log(`Skip dup: ${side} @ level ${levelIdx} (placed within last ${DUP_GUARD_MS / 1000}s)`);
          continue;
        }

        const orderPrice = this.levelBasePrice(levelIdx);
        const size = sizePerGrid(this.config.investment, this.config.gridCount, orderPrice, this.config.leverage);

        // ── SIZE-GUARD ─────────────────────────────────────────────────────────
        if (size <= 0) {
          this.log(`Skip ${side} @ ${orderPrice.toFixed(2)}: size terlalu kecil (${size})`);
          continue;
        }

        const tx = buildAndSign(
          [{ type: "l", symbol: this.config.symbol, isBuy: side === "BUY", price: orderPrice, size, tif: "GTC", reduceOnly, iso: true }],
          this.config.accountPubkey,
          this.config.privateKey
        );

        const result = await submitTransaction(tx, PROXY_API, getEndpoint());
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

    const wsUrl = WS_URLS[getEndpoint()] ?? WS_URLS.staging;
    this.ws = new WebSocket(wsUrl);

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

  private handleWsMessage(msg: any) {
    if (msg.type === "subscriptionResponse") return;
    if (msg.type !== "account") return;

    const data = msg.data;
    if (!data?.type) return;

    switch (data.type) {
      case "accountSnapshot":  this.handleSnapshot(data);       break;
      case "marginUpdate":     this.handleMarginUpdate(data);   break;
      case "positionUpdate":   this.handlePositionUpdate(data); break;
      case "orderUpdate":      this.handleOrderUpdate(data);    break;
      case "fill":             this.handleFill(data);           break;
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
    this.onUpdate?.();
  }

  private parsePosition(p: any): PositionData {
    return {
      symbol:           String(p.symbol           ?? ""),
      size:             Number(p.size             ?? 0),
      price:            Number(p.price            ?? 0),
      fairPrice:        Number(p.fairPrice        ?? 0),
      notional:         Number(p.notional         ?? 0),
      realizedPnl:      Number(p.realizedPnl      ?? 0),
      unrealizedPnl:    Number(p.unrealizedPnl    ?? 0),
      leverage:         Number(p.leverage         ?? 0),
      liquidationPrice: Number(p.liquidationPrice ?? 0),
      fees:             Number(p.fees             ?? 0),
      funding:          Number(p.funding          ?? 0),
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

  // ── Stop ─────────────────────────────────────────────────────────────────────

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.lastLevel = null;
    // Clear persisted level so next start reinitializes from scratch
    try { localStorage.removeItem(this.stateKey); } catch { /* ignore */ }
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
      env: getEndpoint(),
    });
    this.log(cancelled ? "All orders cancelled. Bot stopped." : "Cancel error. Bot stopped.");
    this.onUpdate?.();
    // Notify parent so it can update DB status to STOPPED
    this.onStopped?.();
  }
}
