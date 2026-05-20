import { calculateGridLevels, sizePerGrid } from "./gridEngine";
import { buildAndSign, submitTransaction, cancelAllOrders } from "./signing";

// All HTTP requests go through our API proxy to avoid browser CORS restrictions.
// The proxy forwards to https://staging-api.bulk.trade/api/v1 server-side.
const PROXY_API = "/api";
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
  private currentPrice = 0;
  public logs: LogLine[] = [];
  private onUpdate?: () => void;
  private storageKey: string;

  // Live data from bulk.trade account stream (not DB)
  public margin: MarginData | null = null;
  public position: PositionData | null = null;
  public openOrders: LiveOrder[] = [];
  public totalTrades = 0;

  constructor(
    private config: BotConfig,
    onUpdate?: () => void
  ) {
    this.onUpdate = onUpdate;
    this.storageKey = `bot_logs_${config.botId}`;
    // Restore logs from previous session
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

  // ── Start ───────────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.logs = [];
    this.log(`Starting bot #${this.config.botId} for ${this.config.symbol} (${this.config.mode})`);

    try {
      // 1. Fetch current mark price (via API proxy to avoid CORS)
      const tickerRes = await fetch(
        `${PROXY_API}/markets/${encodeURIComponent(this.config.symbol)}/ticker`
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
        endpoint: PROXY_API,
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
        const result = await submitTransaction(tx, PROXY_API);
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

    this.ws.onerror = () => {
      this.log("WebSocket error.");
    };
  }

  // Bulk.trade WS account stream format:
  // { type: "account", data: { type: "accountSnapshot"|"marginUpdate"|"positionUpdate"|"orderUpdate"|"fill"|..., ... } }
  private handleWsMessage(msg: any) {
    if (msg.type === "subscriptionResponse") return;
    if (msg.type !== "account") return;

    const data = msg.data;
    if (!data?.type) return;

    switch (data.type) {
      case "accountSnapshot":
        this.handleSnapshot(data);
        break;
      case "marginUpdate":
        this.handleMarginUpdate(data);
        break;
      case "positionUpdate":
        this.handlePositionUpdate(data);
        break;
      case "orderUpdate":
        this.handleOrderUpdate(data);
        break;
      case "fill":
        this.handleFill(data);
        break;
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
    const terminal = ["filled","partiallyFilled","cancelled","cancelledRiskLimit",
                      "cancelledSelfCrossing","cancelledReduceOnly","cancelledIoc",
                      "rejectedInvalid","rejectedRiskLimit","rejectedCrossing","rejectedDuplicate",
                      "siblingCancelled","triggerFailed"].includes(data.status);

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
      if (existing >= 0) {
        this.openOrders[existing] = order;
      } else {
        this.openOrders.push(order);
      }
    }
    this.onUpdate?.();
  }

  private handleFill(data: any) {
    if (data.symbol !== this.config.symbol) return;

    const filledPrice = Number(data.price);
    const filledSize  = Number(data.size);
    const isBuy       = Boolean(data.isBuy);
    const fee         = Number(data.fee ?? 0);

    this.totalTrades++;
    this.log(`Fill #${this.totalTrades}: ${isBuy ? "BUY" : "SELL"} ${filledSize.toFixed(6)} @ ${filledPrice.toFixed(2)} fee=${fee.toFixed(4)}`);

    if (!this.running) return;

    // Replenish: filled BUY → place SELL one step up; filled SELL → place BUY one step down
    const step = (this.config.upperPrice - this.config.lowerPrice) / this.config.gridCount;
    const replenishIsBuy = !isBuy;
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
    submitTransaction(tx, PROXY_API).then((result) => {
      if (result.ok) {
        this.log(`↺ Replenish ${replenishIsBuy ? "BUY" : "SELL"} ${size.toFixed(6)} @ ${replenishPrice.toFixed(2)}`);
      } else {
        this.log(`✗ Replenish failed @ ${replenishPrice.toFixed(2)}: ${result.error}`);
      }
    });
  }

  private parsePosition(p: any): PositionData {
    return {
      symbol:           String(p.symbol ?? ""),
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
      orderId:      String(o.orderId ?? o.oid ?? ""),
      symbol:       String(o.symbol ?? o.sym ?? ""),
      price:        Number(o.price ?? o.px ?? 0),
      originalSize: Math.abs(origSz),
      size:         Math.abs(Number(o.size ?? o.sz ?? 0)),
      filledSize:   Number(o.filledSize ?? o.fillSz ?? 0),
      isBuy:        origSz > 0,
      status:       String(o.status ?? ""),
      timestamp:    Number(o.timestamp ?? o.ts ?? 0),
    };
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
      endpoint: PROXY_API,
    });
    this.log(cancelled ? "All orders cancelled. Bot stopped." : "Cancel error. Bot stopped.");
    this.onUpdate?.();
  }
}
