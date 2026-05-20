---
name: bulk-grid-bot
description: Audit checklist, first-run setup, and full project knowledge for the Bulk Grid Trading Bot. Use when starting a new session on this project, auditing code, debugging trading issues, or adding features.
---

# Bulk Grid Trading Bot — Agent Knowledge Base

## Quick First-Run Checklist

When opening this project fresh, run through this before touching any code:

```bash
# 1. Verify DB is provisioned
pnpm --filter @workspace/db run push

# 2. Confirm both workflows are running
# - artifacts/api-server: API Server  → port 8080
# - artifacts/grid-bot: web           → port 24830

# 3. Typecheck everything
pnpm run typecheck
```

If `DATABASE_URL` is missing, it is auto-provisioned by Replit — go to the Database tab to create a PostgreSQL instance.

---

## Architecture

```
Browser (React + Vite, port 24830)
  │
  ├─ Private key: ONLY in localStorage("bulk_private_key") — NEVER sent to backend
  ├─ Signs orders client-side (Ed25519 via tweetnacl)
  ├─ Places orders via WebSocket + REST → /api/* proxy
  │
  └─ API Server (Express 5, port 8080)
       ├─ /api/bots          CRUD for bot configs (PostgreSQL via Drizzle)
       ├─ /api/markets/*     Proxy → https://staging-api.bulk.trade/api/v1
       ├─ /api/order         Proxy → bulk.trade order submission
       ├─ /api/cancel        Proxy → bulk.trade cancel
       └─ /api/account       Proxy → bulk.trade account data
```

**Key constraint**: Order signing and placement is entirely client-side. The backend only stores config/state. Never move signing logic to the server.

---

## Critical File Map

| File | Purpose |
|------|---------|
| `lib/api-spec/openapi.yaml` | API contract — source of truth. Edit here, then run codegen |
| `lib/db/src/schema/bots.ts` | DB schema: `bots`, `bot_orders` tables |
| `artifacts/api-server/src/routes/bots.ts` | Bot CRUD + start/stop/stats routes |
| `artifacts/api-server/src/routes/markets.ts` | Exchange info + ticker proxy |
| `artifacts/grid-bot/src/lib/gridEngine.ts` | Grid level calculation (LONG/SHORT/NEUTRAL) |
| `artifacts/grid-bot/src/lib/botRunner.ts` | Bot lifecycle: place orders, WS fills, replenish |
| `artifacts/grid-bot/src/lib/signing.ts` | Ed25519 signing (binary + JSON encoding) |
| `artifacts/grid-bot/src/lib/keys.ts` | Derive pubkey from private key (tweetnacl) |
| `artifacts/grid-bot/src/pages/bots/create.tsx` | Create bot form |
| `artifacts/grid-bot/src/pages/bots/edit.tsx` | Edit bot form |
| `artifacts/grid-bot/src/pages/bots/detail.tsx` | Bot detail + grid visualization + start/stop |
| `artifacts/grid-bot/src/pages/logs.tsx` | Real-time trading logs per bot (replaces markets page) |
| `artifacts/grid-bot/src/pages/dashboard.tsx` | Dashboard with session P&L from fills |

---

## Codegen Workflow

After editing `lib/api-spec/openapi.yaml`:
```bash
pnpm --filter @workspace/api-spec run codegen
```
This regenerates:
- `lib/api-client-react/src/generated/api.ts` — React Query hooks
- `lib/api-zod/src/generated/api.ts` — Zod validation schemas

After editing DB schema (`lib/db/src/schema/bots.ts`):
```bash
pnpm --filter @workspace/db run push
# Then typecheck libs before leaf packages:
pnpm run typecheck:libs
```

---

## Bulk.trade API Gotchas

### Signing (CRITICAL — audit these first)
- Nonce must be **nanoseconds**: `BigInt(Date.now()) * 1_000_000n`
- `i` flag (isolated margin) is **required** on all order actions — both JSON and binary
- Ed25519 binary encoding: see `docs/bulk-trade/signing.md`
- Faucet action JSON field is `u` (not `user` or `amount`): `{ faucet: { u: "pubkey" } }`
- Faucet binary: `[u32 discriminant=16][32 bytes user pubkey][1 byte amount tag]`

### Endpoints
- Always use **staging**: `https://staging-api.bulk.trade/api/v1`
- WebSocket: `wss://staging-ws.bulk.trade`
- All requests go through `/api` proxy to avoid CORS — never call bulk.trade directly from browser

### WebSocket Account Stream
Subscribe format:
```json
{ "method": "subscribe", "subscription": [{ "type": "account", "user": "PUBKEY" }] }
```
Message structure — all updates are wrapped:
```json
{ "type": "account", "data": { "type": "fill|orderUpdate|marginUpdate|...", ... } }
```
Fill event fields: `symbol`, `orderId`, `price`, `size`, `fee`, `isBuy`, `reasonCode`, `maker`, `timestamp`

⚠️ `isBuy` ambiguity: docs define it as "true if TAKER bought". For our resting BUY limit orders (maker), when a taker sells against us, `isBuy` may be `false`. Verify with a live staging fill before relying on session P&L direction.

OrderUpdate compact fields: `sym` (not `symbol`), `fillSz`, `origSz` **(signed: negative=sell)**, `sz`, `px`, `oid`, `status`

---

## Grid Bot Logic

### Grid Calculation (`gridEngine.ts`)
```
step = (upperPrice - lowerPrice) / gridCount
levels[i] = lowerPrice + i * step  (i in 0..gridCount, inclusive)
LONG:    place BUY below currentPrice only
SHORT:   place SELL above currentPrice only
NEUTRAL: place BUY below, SELL above currentPrice
```

### Order Size
```
size = (investment * leverage / gridCount) / price
```

### Bot Lifecycle — UPFRONT mode
1. Fetch mark price from `/api/markets/:symbol/ticker`
2. Cancel all existing orders for the symbol
3. Place limit orders at all N grid levels immediately:
   - LONG: BUY at every level **below** current price
   - SHORT: SELL at every level **above** current price
   - NEUTRAL: BUY below, SELL above
4. Connect WebSocket account stream
5. Monitor SL/TP only — no replenishment (⚠️ known P1 gap — see audit-botRunner.md)

### Bot Lifecycle — REACTIVE mode (default)
1. Fetch mark price → set baseline level
2. Cancel all existing orders
3. Connect WebSocket account stream
4. Start price poller (5s interval)
5. On level crossing UP (price moved to higher band) → place resting BUY orders at the crossed levels (below current)
6. On level crossing DOWN (price moved to lower band) → place resting SELL orders at the crossed levels (above current)
7. SL/TP checked every tick before crossing logic

⚠️ **Known P1 gap**: BUY and SELL orders land at the same price boundary (level N base) for the same band. A tight 1-level bounce is zero-profit (only fees paid). Fill-based replenishment (see SKILL.md spec below and audit-botRunner.md) is NOT yet implemented.

### Intended fill-based replenishment (not yet implemented)
Per SKILL.md spec — this is the correct behavior that should be added:
- **filled BUY at price P** → place SELL at `snapToGridLevel(P + gridSpacing)` (one level up)
- **filled SELL at price P** → place BUY at `snapToGridLevel(P - gridSpacing)` (one level down)
- This guarantees profit = spacing × size − fees per round trip

---

## Session P&L

`BotRunner` tracks session P&L from fills only. Resets to 0 on every `start()`.

```typescript
sessionPnl = sessionSellValue − sessionBuyValue − sessionFees
// where:
// sessionSellValue = Σ(SELL fill price × fill size)
// sessionBuyValue  = Σ(BUY fill price × fill size)
// sessionFees      = Σ(fee per fill)
```

Do NOT use `margin.realizedPnl` from the exchange for per-bot P&L — it is a historical account total since account creation and does not reset per bot session.

---

## DB Schema

```sql
bots (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  symbol        TEXT NOT NULL,
  mode          ENUM('LONG','SHORT','NEUTRAL') NOT NULL,
  order_mode    ENUM('UPFRONT','REACTIVE') NOT NULL DEFAULT 'REACTIVE',
  lower_price   REAL NOT NULL,
  upper_price   REAL NOT NULL,
  grid_count    INT NOT NULL,
  investment    REAL NOT NULL,
  leverage      INT DEFAULT 1,
  stop_loss     REAL,           -- null = disabled
  take_profit   REAL,           -- null = disabled
  account_pubkey TEXT NOT NULL,
  status        ENUM('IDLE','RUNNING','STOPPED','ERROR') DEFAULT 'IDLE',
  total_pnl     REAL,           -- NOT updated live; use sessionPnl from BotRunner
  total_trades  INT,            -- NOT updated live; use runner.totalTrades
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
)
```

Status lifecycle: `IDLE` (newly created) → `RUNNING` (on start) → `STOPPED` (on stop) | `ERROR`.

---

## Common Bugs & Fixes (Historical)

| Bug | Cause | Fix |
|-----|-------|-----|
| `bots?.filter is not a function` | React Query returns non-array on first render | `Array.isArray(bots) ? bots : []` |
| Grid prices jumping wildly (e.g. 76→3945→7814) | Indonesian browser locale: "77.456" read as 77456 | Price inputs use `type="text"` + `parseLocaleNumber()` that handles both `,` and `.` as decimal |
| Faucet CORS error | Frontend calling bulk.trade directly | Route through `/api/faucet` proxy |
| Faucet wrong encoding | Wrong field name `amount` instead of `u`, missing 32-byte pubkey in binary | See `signing.ts` faucet section |
| Session P&L showing $0 | Dashboard read `margin.realizedPnl` (historical exchange total) | Dashboard now uses `sessionPnl` from BotRunner fills, reset each start() |
| Orders filled immediately (not resting) | REACTIVE crossing side inverted: UP→SELL, DOWN→BUY | Fixed: UP→BUY (resting below), DOWN→SELL (resting above) |
| SELL orders placed below current price | levelIdx formula for DOWN was `prevLevel-i-1` | Fixed: `currentLevel+i+1` → SELL always above current price |
| Duplicate resting orders draining margin | No live-order deduplication on rapid bounces | Added `hasOpenOrderAt()` check before each order |
| totalTrades counting rejected orders | `totalTrades++` was in order placement loop | Moved to `handleFill()` — counts confirmed fills only |
| `LogLine.text` TS error in logs.tsx | `LogLine = { ts, msg }` not `{ ts, text }` | Fixed to use `.msg` throughout |
| Bot name/range not matching | DB stores old data, no edit feature | Edit bot page at `/bots/:id/edit` (stop bot first) |

---

## Number Input Locale Fix

Price inputs must use `type="text"` with `parseLocaleNumber()` (in create.tsx and edit.tsx):
- Indonesian locale uses `.` as thousands separator, `,` as decimal → `77.456` = 77456
- The custom parser detects last separator position to determine decimal separator
- Also shows a `GridRangePreview` component with live step calculation and warning if range > 100%

---

## Audit Checklist

Run this when auditing before a session or after major changes:

```
[ ] pnpm run typecheck — zero errors
[ ] pnpm --filter @workspace/db run push — schema in sync
[ ] API server responds: curl http://localhost:8080/api/bots
[ ] Frontend loads: check port 24830
[ ] Signing: nonce is nanoseconds (BigInt(Date.now()) * 1_000_000n)
[ ] Signing: all order actions have iso=true (isolated margin) in both binary and JSON
[ ] Signing: reduceOnly correct per mode (LONG+SELL=true, SHORT+BUY=true, NEUTRAL=false)
[ ] Price inputs: use type="text" not type="number"
[ ] All external API calls go through /api proxy, never direct from browser
[ ] Private key never sent to backend (check network tab)
[ ] Bot edit page: requires bot to be STOPPED first
[ ] Dashboard Session P&L: reads from BotRunner.sessionPnl (fills-based), not DB or exchange margin
[ ] REACTIVE crossing: UP→BUY (resting below current), DOWN→SELL (resting above current)
[ ] Fill-based replenishment: NOT yet implemented — see audit-botRunner.md P1 issues
[ ] WS isBuy field: verify with live fill that direction matches account perspective
```

---

## Known P1 Gaps (open — see audit-botRunner.md for details)

1. **REACTIVE zero-profit**: BUY and SELL land at same price boundary. Fill-based replenishment not implemented.
2. **UPFRONT no replenishment**: Filled orders are not replaced. Grid depletes over time.
3. **UPFRONT LONG/SHORT wrong levels**: Places orders at all levels including above/below current price (should skip aggressive side).

---

## Nav Structure

```
/ (Dashboard)       — session P&L total, account balance, running bots
/logs               — real-time trading logs per bot (color-coded, sorted by time)
/bots               — bot list (edit + delete)
/bots/new           — create bot
/bots/:id           — bot detail (grid viz, logs, orders, start/stop, edit button)
/bots/:id/edit      — edit bot (stopped bots only)
/settings           — wallet key management, faucet, staging/prod toggle
```
