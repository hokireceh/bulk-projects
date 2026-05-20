import { Router, type IRouter, type Request } from "express";
import {
  GetMarketsResponse,
  GetMarketTickerResponse,
  GetMarketTickerParams,
} from "@workspace/api-zod";

const BULK_STAGING    = "https://staging-api.bulk.trade/api/v1";
const BULK_PRODUCTION = "https://api.bulk.trade/api/v1";

function bulkApi(req: Request): string {
  return req.headers["x-bulk-env"] === "production" ? BULK_PRODUCTION : BULK_STAGING;
}

const BULK_WS_STAGING    = "wss://staging-ws.bulk.trade";
const BULK_WS_PRODUCTION = "wss://ws.bulk.trade";

export function bulkWsUrl(env: string): string {
  return env === "production" ? BULK_WS_PRODUCTION : BULK_WS_STAGING;
}

const router: IRouter = Router();

router.get("/markets", async (req, res): Promise<void> => {
  try {
    const response = await fetch(`${bulkApi(req)}/exchangeInfo`);
    if (!response.ok) {
      req.log.error({ status: response.status }, "Failed to fetch exchange info from bulk.trade");
      res.status(502).json({ error: "Failed to fetch market data" });
      return;
    }
    const data = await response.json() as unknown[];
    const markets = (Array.isArray(data) ? data : []).map((m: any) => ({
      symbol: m.symbol,
      baseAsset: m.baseAsset,
      quoteAsset: m.quoteAsset,
      status: m.status,
      tickSize: m.tickSize ?? 0,
      lotSize: m.lotSize ?? 0,
      minNotional: m.minNotional ?? 0,
      maxLeverage: m.maxLeverage ?? 1,
      pricePrecision: m.pricePrecision ?? 2,
      sizePrecision: m.sizePrecision ?? 4,
    }));
    res.json(GetMarketsResponse.parse(markets));
  } catch (err) {
    req.log.error({ err }, "Error proxying exchange info");
    res.status(502).json({ error: "Failed to fetch market data" });
  }
});

router.get("/markets/:symbol/ticker", async (req, res): Promise<void> => {
  const params = GetMarketTickerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const response = await fetch(`${bulkApi(req)}/ticker/${encodeURIComponent(params.data.symbol)}`);
    if (!response.ok) {
      req.log.warn({ symbol: params.data.symbol, status: response.status }, "Failed to fetch ticker");
      res.status(response.status === 404 ? 404 : 502).json({ error: "Failed to fetch ticker" });
      return;
    }
    const data = await response.json() as any;
    const ticker = {
      symbol: data.symbol ?? params.data.symbol,
      lastPrice: Number(data.lastPrice ?? 0),
      priceChange: Number(data.priceChange ?? 0),
      priceChangePercent: Number(data.priceChangePercent ?? 0),
      highPrice: Number(data.highPrice ?? 0),
      lowPrice: Number(data.lowPrice ?? 0),
      volume: Number(data.volume ?? 0),
      markPrice: Number(data.markPrice ?? 0),
      oraclePrice: Number(data.oraclePrice ?? 0),
      openInterest: Number(data.openInterest ?? 0),
      fundingRate: Number(data.fundingRate ?? 0),
    };
    res.json(GetMarketTickerResponse.parse(ticker));
  } catch (err) {
    req.log.error({ err }, "Error proxying ticker");
    res.status(502).json({ error: "Failed to fetch ticker" });
  }
});

router.post("/account", async (req, res): Promise<void> => {
  try {
    const response = await fetch(`${bulkApi(req)}/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    if (!response.ok) {
      req.log.warn({ status: response.status }, "Failed to fetch account from bulk.trade");
      res.status(response.status).json({ error: "Failed to fetch account data" });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Error proxying account");
    res.status(502).json({ error: "Failed to fetch account data" });
  }
});

router.post("/order", async (req, res): Promise<void> => {
  try {
    const response = await fetch(`${bulkApi(req)}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
    res.status(response.status).json(data);
  } catch (err) {
    req.log.error({ err }, "Error proxying order to bulk.trade");
    res.status(502).json({ error: "Failed to submit order" });
  }
});

export default router;
