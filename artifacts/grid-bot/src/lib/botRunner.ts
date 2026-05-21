import { sizePerGrid, snapToGridLevel } from "./gridEngine";
import { buildAndSign, submitTransaction, cancelAllOrders, setLeverage, topUpIsolatedMargin } from "./signing";
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

interface MarketSpecs {
  tickSize: number;
  lotSize: number;
  pricePrecision: number;
  sizePrecision: number;
  minNotional: number;
}

/** Parse the first status from a submitted transaction response and classify it. */
function extractOrderResult(statuses: any[] | undefined): { oid: string; rejected: boolean; reason?: string } {
  const st = statuses?.[0] as any;
  if (!st) return { oid: "?", rejected: false };
  if (st.resting)           return { oid: st.resting.oid ?? "?",           rejected: false };
  if (st.filled)            return { oid: st.filled.oid ?? "?",            rejected: false };
  if (st.working)           return { oid: st.working.oid ?? "?",           rejected: false };
  if (st.rejectedInvalid)   return { oid: st.rejectedInvalid.oid ?? "?",   rejected: true, reason: `rejectedInvalid: ${st.rejectedInvalid.reason ?? "no reason"}` };
  if (st.rejectedRiskLimit) return { oid: st.rejectedRiskLimit.oid ?? "?", rejected: true, reason: `rejectedRiskLimit: ${st.rejectedRiskLimit.reason ?? "no reason"}` };
  if (st.rejectedCrossing)  return { oid: st.rejectedCrossing.oid ?? "?",  rejected: true, reason: "rejectedCrossing (post-only)" };
  if (st.rejectedDuplicate) return { oid: st.rejectedDuplicate.oid ?? "?", rejected: true, reason: "rejectedDuplicate" };
  if (st.cancelledRiskLimit) return { oid: st.cancelledRiskLimit.oid ?? "?", rejected: true, reason: `cancelledRiskLimit: ${st.cancelledRiskLimit.reason ?? "no reason"}` };
  const key = Object.keys(st)[0] ?? "unknown";
  const inner = st[key] as any;
  return { oid: inner?.oid ?? "?", rejected: false };
}

export class BotRunner {
  private running = false;
  private ws: WebSocket | null = null;
  private pricePoller: ReturnType<typeof setInterval> | null = null;
  private marketSpecs: MarketSpecs = { tickSize: 0.001, lotSize: 0.0001, pricePrecision: 3, sizePrecision: 4, minNotional: 50 };

  // Level-crossing state
  // Mirror: extendedBotEngine EXT-02 — persist lastLevel so bot survives page refresh
  lastLevel: number | null = null;
  private gridCheckInFlight = false;

  // BUG-DUP-001: tracks recently placed level+side pairs to suppress duplicates
  // key = `${levelIdx}:${side}`, value = timestamp of last placement
  private recentOrders = new Map<string, number>();

  // Out-of-range log throttle (mirror: extendedBotEngine extOutOfRangeNotifAt)
  private lastOutOfRangeLogAt = 0;

  // Dedup account snapshot logs — only log when balance/pnl actually changes
  private lastSnapshotKey = "";

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

  // Session P&L: computed from actual fills during this bot session.
  // sessionPnl = Σ(SELL fills) − Σ(BUY fills) − Σ(fees)
  // This is the only accurate per-bot P&L — exchange margin.realizedPnl is
  // a historical account-total that predates the bot and never resets per session.
  public sessionPnl      = 0;
  public sessionFees     = 0;
  public sessionSellValue = 0;
  public sessionBuyValue  = 0;

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

  // ── Market specs ─────────────────────────────────────────────────────────────

  /**
   * Fetch tick/lot size for this symbol from the proxy.
   * Falls back to safe defaults (ETH-USD values) if the call fails.
   */
  private async fetchMarketSpecs(): Promise<void> {
    try {
      const res = await fetch(`${PROXY_API}/markets`, { headers: { "x-bulk-env": getEndpoint() } });
      if (!res.ok) return;
      const markets = await res.json() as any[];
      const m = markets.find((x: any) => x.symbol === this.config.symbol);
      if (!m) return;
      this.marketSpecs = {
        tickSize:       m.tickSize       > 0 ? m.tickSize       : 0.001,
        lotSize:        m.lotSize        > 0 ? m.lotSize        : 0.0001,
        pricePrecision: m.pricePrecision > 0 ? m.pricePrecision : 3,
        sizePrecision:  m.sizePrecision  > 0 ? m.sizePrecision  : 4,
        minNotional:    m.minNotional    > 0 ? m.minNotional    : 50,
      };
      this.log(`Market specs: tickSize=${this.marketSpecs.tickSize} lotSize=${this.marketSpecs.lotSize} minNotional=${this.marketSpecs.minNotional}`);
    } catch { /* keep defaults */ }
  }

  /** Round price to the exchange's tick size. */
  private snapPrice(price: number): number {
    const { tickSize, pricePrecision } = this.marketSpecs;
    const snapped = Math.round(price / tickSize) * tickSize;
    return parseFloat(snapped.toFixed(pricePrecision));
  }

  /** Floor size to the exchange's lot size (floor = never exceed investment). */
  private snapSize(size: number): number {
    const { lotSize, sizePrecision } = this.marketSpecs;
    const snapped = Math.floor(size / lotSize) * lotSize;
    return parseFloat(snapped.toFixed(sizePrecision));
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
    const now = Date.now();
    // Prune stale entries — prevents Map from growing unboundedly (P2 memory leak fix)
    for (const [k, t] of this.recentOrders) {
      if (now - t >= DUP_GUARD_MS) this.recentOrders.delete(k);
    }
    const key = `${levelIdx}:${side}`;
    const last = this.recentOrders.get(key);
    if (last !== undefined && now - last < DUP_GUARD_MS) return true;
    this.recentOrders.set(key, now);
    return false;
  }

  /**
   * Returns true if a resting order already exists at this price in the live order book.
   * Prevents margin drain when price bounces repeatedly across the same level —
   * each bounce would otherwise reserve fresh margin for a duplicate resting order.
   * Checks any side: BUY+SELL at the same price would be self-crossing anyway.
   *
   * TOLERANCE-001: Dynamic radius = min(0.1% of price, 40% of grid spacing).
   * Mirror: HokirecehProjects getDuplicateTolerance().
   * Rationale: fixed 2%-of-spacing fails for low-price assets where spacing is tiny
   * (e.g. spacing $0.002 → 2% = $0.00004 radius, too tight for float rounding).
   * The dynamic formula self-scales: on BTC ($67k, $5 spacing) → radius = min($67, $2) = $2.
   * On low-price asset ($35, $0.002 spacing) → radius = min($0.035, $0.0008) = $0.0008.
   */
  private hasOpenOrderAt(price: number): boolean {
    const priceTol   = price * 0.001;              // 0.1% of price
    const spacingTol = this.gridSpacing * 0.4;     // 40% of grid spacing
    const tolerance  = Math.min(priceTol, spacingTol);
    return this.openOrders.some(
      o => o.symbol === this.config.symbol && Math.abs(o.price - price) < tolerance
    );
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

  // ── Isolated margin helpers ──────────────────────────────────────────────────

  /**
   * Query fullAccount and return the isoPubkey for this bot's symbol, if any
   * isolated orders or positions exist. Must be called BEFORE cancelAllOrders so
   * that existing iso orders are still visible in the snapshot.
   */
  private async fetchIsolatedPubkey(): Promise<string | null> {
    try {
      const res = await fetch(`${PROXY_API}/account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bulk-env": getEndpoint() },
        body: JSON.stringify({ type: "fullAccount", user: this.config.accountPubkey }),
      });
      if (!res.ok) return null;
      const rows: any[] = await res.json();
      const account = rows.find((r: any) => r.fullAccount)?.fullAccount;
      if (!account) return null;
      // Prefer open orders (more likely to exist at startup)
      const isoOrder = (account.openOrders ?? []).find(
        (o: any) => o.symbol === this.config.symbol && o.iso === true
      );
      if (isoOrder?.isoPubkey) return isoOrder.isoPubkey;
      // Fall back to positions (may exist after fills)
      const isoPos = (account.positions ?? []).find(
        (p: any) => p.symbol === this.config.symbol && p.iso === true
      );
      if (isoPos?.isoPubkey) return isoPos.isoPubkey;
      return null;
    } catch {
      return null;
    }
  }

  // ── Start ───────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.logs = [];
    this.totalTrades = 0;
    this.sessionPnl       = 0;
    this.sessionFees      = 0;
    this.sessionSellValue = 0;
    this.sessionBuyValue  = 0;
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

      await this.fetchMarketSpecs();

      // ── Fund isolated margin account ─────────────────────────────────────
      // Query fullAccount BEFORE cancelling so existing iso orders are visible
      // and we can discover the isoPubkey. Transfer `investment` USDC from base
      // to isolated account to ensure all grid orders fit within the risk limit.
      const isoPubkey = await this.fetchIsolatedPubkey();
      if (isoPubkey) {
        const topUpAmount = this.config.investment;
        this.log(`Funding isolated margin (${isoPubkey.slice(0, 8)}…) +${topUpAmount} USDC…`);
        const transferred = await topUpIsolatedMargin({
          privateKey: this.config.privateKey,
          account: this.config.accountPubkey,
          isoPubkey,
          amount: topUpAmount,
          endpoint: PROXY_API,
          env: getEndpoint(),
        });
        this.log(transferred ? `Isolated margin funded +${topUpAmount} USDC.` : "Margin transfer returned error — continuing.");
      } else {
        this.log("No prior isolated exposure found — margin auto-allocated on first order.");
      }

      this.log("Cancelling existing orders...");
      const cancelled = await cancelAllOrders({
        privateKey: this.config.privateKey,
        account: this.config.accountPubkey,
        symbol: this.config.symbol,
        endpoint: PROXY_API,
        env: getEndpoint(),
      });
      this.log(cancelled ? "Existing orders cancelled." : "Cancel returned error (may be none open).");

      const lev = Math.max(1, Math.min(50, Math.round(this.config.leverage)));
      this.log(`Setting leverage ${lev}x for ${this.config.symbol}...`);
      const levOk = await setLeverage({
        privateKey: this.config.privateKey,
        account: this.config.accountPubkey,
        symbol: this.config.symbol,
        leverage: lev,
        endpoint: PROXY_API,
        env: getEndpoint(),
      });
      this.log(levOk ? `Leverage set to ${lev}x.` : "Leverage set returned error — continuing.");

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
        // LONG: only BUY below current price — orders above would cross immediately (aggressive fill)
        if (orderPrice >= currentPrice) { skipped++; continue; }
        side = "BUY";
      } else if (this.config.mode === "SHORT") {
        // SHORT: only SELL above current price — orders below would cross immediately (aggressive fill)
        if (orderPrice <= currentPrice) { skipped++; continue; }
        side = "SELL";
      } else {
        // NEUTRAL: BUY below current price, SELL above
        // Skip levels within 0.001 of currentPrice (mirror: gridEngine.ts calculateGridLevels)
        if (Math.abs(orderPrice - currentPrice) < 0.001) { skipped++; continue; }
        side = levelIdx <= currentLevel ? "BUY" : "SELL";
      }

      const snappedPrice = this.snapPrice(orderPrice);
      const snappedSize  = this.snapSize(size);

      if (snappedSize <= 0) { skipped++; continue; }

      const notional = snappedSize * snappedPrice;
      if (notional < this.marketSpecs.minNotional) {
        skipped++;
        this.log(`Skip UPFRONT ${side} @ ${snappedPrice}: notional $${notional.toFixed(2)} < minNotional $${this.marketSpecs.minNotional}`);
        continue;
      }

      const tx = buildAndSign(
        [{ type: "l", symbol: this.config.symbol, isBuy: side === "BUY", price: snappedPrice, size: snappedSize, tif: "GTC", reduceOnly: false, iso: true }],
        this.config.accountPubkey,
        this.config.privateKey
      );

      const result = await submitTransaction(tx, PROXY_API, getEndpoint());
      if (result.ok) {
        const { oid, rejected, reason } = extractOrderResult(result.statuses);
        if (rejected) {
          skipped++;
          this.log(`✗ UPFRONT ${side} ${snappedSize} @ ${snappedPrice} — ${reason}`);
        } else {
          placed++;
          this.log(`✓ UPFRONT ${side} ${snappedSize} @ ${snappedPrice} (${String(oid).slice(0, 8)}…)`);
        }
      } else {
        skipped++;
        this.log(`✗ UPFRONT ${side} @ ${snappedPrice}: ${result.error}`);
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

        // Level index formula:
        // UP   (BUY) : prevLevel → prevLevel+orderCount-1  — all BELOW current ✓
        //   Using prevLevel+i (not prevLevel+i+1) so BUY rests at the level just
        //   crossed FROM, which is now below price. The old +1 offset placed the
        //   first BUY at currentLevel (AT current price) — same as the SELL on a
        //   reverse crossing, causing identical BUY and SELL prices.
        // DOWN (SELL): currentLevel+1 → prevLevel  — all ABOVE current ✓
        const levelIdx = levelsMoved < 0
          ? currentLevel + i + 1   // SELL: above current ✓
          : prevLevel + i;          // BUY : at/below prev level ✓

        if (levelIdx < 0 || levelIdx > this.config.gridCount) continue;

        // ── BUG-DUP-001: Duplicate order guard ────────────────────────────────
        if (this.isDuplicateOrder(levelIdx, side)) {
          this.log(`Skip dup: ${side} @ level ${levelIdx} (placed within last ${DUP_GUARD_MS / 1000}s)`);
          continue;
        }

        const orderPrice = this.levelBasePrice(levelIdx);

        // ── LIVE-ORDER-CHECK: Skip if resting order already at this price ─────
        // Prevents margin drain when price bounces across the same level repeatedly.
        // Each new resting order reserves fresh margin even if the old one still sits there.
        if (this.hasOpenOrderAt(orderPrice)) {
          this.log(`Skip ${side} @ ${orderPrice.toFixed(2)}: resting order already at this level`);
          continue;
        }
        const rawSize = sizePerGrid(this.config.investment, this.config.gridCount, orderPrice, this.config.leverage);
        const snappedPrice = this.snapPrice(orderPrice);
        const snappedSize  = this.snapSize(rawSize);

        // ── SIZE-GUARD ─────────────────────────────────────────────────────────
        if (snappedSize <= 0) {
          this.log(`Skip ${side} @ ${snappedPrice}: size terlalu kecil (${snappedSize})`);
          continue;
        }

        const notional = snappedSize * snappedPrice;
        if (notional < this.marketSpecs.minNotional) {
          this.log(`Skip ${side} @ ${snappedPrice}: notional $${notional.toFixed(2)} < minNotional $${this.marketSpecs.minNotional}`);
          continue;
        }

        const tx = buildAndSign(
          [{ type: "l", symbol: this.config.symbol, isBuy: side === "BUY", price: snappedPrice, size: snappedSize, tif: "GTC", reduceOnly, iso: true }],
          this.config.accountPubkey,
          this.config.privateKey
        );

        const result = await submitTransaction(tx, PROXY_API, getEndpoint());
        if (result.ok) {
          const { oid, rejected, reason } = extractOrderResult(result.statuses);
          if (rejected) {
            this.log(`✗ ${side} ${snappedSize} @ ${snappedPrice} — ${reason}`);
          } else {
            this.log(`✓ ${side} ${snappedSize} @ ${snappedPrice} (${String(oid).slice(0, 8)}…)`);
          }
        } else {
          this.log(`✗ Failed ${side} @ ${snappedPrice}: ${result.error}`);
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
    const snapKey = `${this.margin?.totalBalance?.toFixed(2)}`;
    if (snapKey !== this.lastSnapshotKey) {
      this.lastSnapshotKey = snapKey;
      this.log(`[Bot ${this.config.botId}] Account snapshot: balance=${this.margin?.totalBalance?.toFixed(2) ?? "?"} sessionPnl=${this.sessionPnl >= 0 ? "+" : ""}${this.sessionPnl.toFixed(4)}`);
    }
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
    const isBuy       = Boolean(data.isBuy); // true = taker bought (taker's POV per docs)
    const isMaker     = Boolean(data.maker); // true = our resting limit order was taken
    const fee         = Number(data.fee ?? 0);

    // Determine our actual trade direction.
    // Docs: "isBuy = true if taker bought"
    // When WE are the MAKER (resting limit order hit by a taker):
    //   taker bought our SELL limit  → isBuy=true  → WE SOLD
    //   taker sold into our BUY limit → isBuy=false → WE BOUGHT
    // When WE are the TAKER (aggressive/market order):
    //   isBuy=true  → WE BOUGHT
    //   isBuy=false → WE SOLD
    const weBought = isMaker ? !isBuy : isBuy;

    // Accumulate session P&L from fills.
    // SELL fill = earned money; BUY fill = spent money.
    // Net = what the grid has actually made or lost this session, after fees.
    const tradeValue = filledPrice * filledSize;
    if (weBought) {
      this.sessionBuyValue += tradeValue;
    } else {
      this.sessionSellValue += tradeValue;
    }
    this.sessionFees += fee;
    this.sessionPnl = this.sessionSellValue - this.sessionBuyValue - this.sessionFees;

    this.totalTrades++;
    this.log(
      `Fill: ${weBought ? "BUY" : "SELL"} ${filledSize.toFixed(6)} @ ${filledPrice.toFixed(2)} ` +
      `${isMaker ? "(maker)" : "(taker)"} fee=${fee.toFixed(4)} | ` +
      `Session P&L: ${this.sessionPnl >= 0 ? "+" : ""}$${this.sessionPnl.toFixed(4)}`
    );

    // Fill-based replenishment: place the opposite side one grid step away.
    // BUY filled → place SELL one level above (profit on price recovery)
    // SELL filled → place BUY one level below (profit on price recovery)
    this.scheduleReplenishment(filledPrice, weBought);

    this.onUpdate?.();
  }

  /**
   * Schedule a fill-based replenishment order with a short delay.
   * The delay gives the exchange time to update open-orders before LIVE-ORDER-CHECK runs.
   */
  private scheduleReplenishment(filledPrice: number, weBought: boolean): void {
    if (!this.running) return;
    const replenishSide: "BUY" | "SELL" = weBought ? "SELL" : "BUY";
    const rawPrice = weBought
      ? filledPrice + this.gridSpacing
      : filledPrice - this.gridSpacing;
    const replenishPrice = snapToGridLevel(rawPrice, this.config.lowerPrice, this.config.upperPrice, this.config.gridCount);

    // Sanity: snap must land strictly on the correct side of the fill
    if (weBought  && replenishPrice <= filledPrice) return;
    if (!weBought && replenishPrice >= filledPrice) return;

    setTimeout(() => void this.placeReplenishOrder(replenishSide, replenishPrice), 1_500);
  }

  /**
   * Place a replenishment limit order after a fill.
   * Applies all existing guards: bounds, LIVE-ORDER-CHECK, DUP-GUARD, position pre-check.
   */
  private async placeReplenishOrder(side: "BUY" | "SELL", price: number): Promise<void> {
    if (!this.running) return;
    if (price < this.config.lowerPrice || price > this.config.upperPrice) return;

    // LIVE-ORDER-CHECK
    if (this.hasOpenOrderAt(price)) {
      this.log(`Skip replenish ${side} @ ${price.toFixed(2)}: resting order already exists`);
      return;
    }

    // DUP-GUARD
    const levelIdx = Math.round((price - this.config.lowerPrice) / this.gridSpacing);
    if (this.isDuplicateOrder(levelIdx, side)) {
      this.log(`Skip replenish ${side} @ ${price.toFixed(2)}: duplicate guard active`);
      return;
    }

    const rawSize = sizePerGrid(this.config.investment, this.config.gridCount, price, this.config.leverage);
    const snappedPrice = this.snapPrice(price);
    const snappedSize  = this.snapSize(rawSize);

    if (snappedSize <= 0) return;

    const notional = snappedSize * snappedPrice;
    if (notional < this.marketSpecs.minNotional) {
      this.log(`Skip replenish ${side} @ ${snappedPrice}: notional $${notional.toFixed(2)} < minNotional $${this.marketSpecs.minNotional}`);
      return;
    }

    // GRID-REDUCEONLY-PRECHECK
    const reduceOnly = this.computeReduceOnly(side);
    if (reduceOnly) {
      const pos = this.position;
      const hasPos = side === "SELL" ? pos !== null && pos.size > 0 : pos !== null && pos.size < 0;
      if (!hasPos) {
        this.log(`Skip replenish ${side} (reduceOnly): tidak ada posisi yang sesuai`);
        return;
      }
    }

    const tx = buildAndSign(
      [{ type: "l", symbol: this.config.symbol, isBuy: side === "BUY", price: snappedPrice, size: snappedSize, tif: "GTC", reduceOnly, iso: true }],
      this.config.accountPubkey,
      this.config.privateKey
    );

    const result = await submitTransaction(tx, PROXY_API, getEndpoint());
    if (result.ok) {
      const { oid, rejected, reason } = extractOrderResult(result.statuses);
      if (rejected) {
        this.log(`✗ Replenish ${side} ${snappedSize} @ ${snappedPrice} — ${reason}`);
      } else {
        this.log(`✓ Replenish ${side} ${snappedSize} @ ${snappedPrice} (${String(oid).slice(0, 8)}…)`);
      }
    } else {
      this.log(`✗ Replenish ${side} @ ${snappedPrice}: ${result.error}`);
    }
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
