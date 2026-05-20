# BotRunner Audit Report
**Engine**: `artifacts/grid-bot/src/lib/botRunner.ts`  
**Date**: 2026-05-20  
**tsc --noEmit**: ✅ CLEAN (zero errors across all packages)

---

## 1. Typecheck Status

```
pnpm run typecheck
  typecheck:libs  → tsc --build             ✅
  api-server      → tsc --noEmit            ✅
  grid-bot        → tsc --noEmit            ✅
  scripts         → tsc --noEmit            ✅
```

---

## 2. Fixes Applied This Session

### FIX-01 — REACTIVE crossing side inverted (CRITICAL)
**Was**: UP crossing → SELL; DOWN crossing → BUY  
**Problem**: Orders placed on the WRONG side of the book, crossing immediately as aggressive orders instead of resting as limit orders.  
**Fix**: UP crossing → BUY (buy-on-dip); DOWN crossing → SELL (sell-on-bounce).  
**File**: `botRunner.ts` line 481

### FIX-02 — `levelIdx` formula for DOWN crossing (CRITICAL)
**Was**: `prevLevel - i - 1` → produced prices BELOW current price for SELL orders (market-crossing)  
**Fix**: `currentLevel + i + 1` → SELL prices are ABOVE current price (resting on book)  
**File**: `botRunner.ts` line 523–525

### FIX-03 — `hasOpenOrderAt()` duplicate order check
**Was**: No live-order deduplication; rapid bounces placed fresh resting orders while old ones still occupied margin.  
**Fix**: Added `hasOpenOrderAt(price)` — checks `openOrders[]` for any resting order within 2% of grid spacing before placing.  
**File**: `botRunner.ts` lines 228–233

### FIX-04 — `totalTrades` counted on placement instead of fill
**Was**: `totalTrades++` inside order-placement loop (counted rejected/failed orders too)  
**Fix**: `totalTrades++` moved to `handleFill()` — increments only on confirmed exchange fills.  
**File**: `botRunner.ts` line 721

### FIX-05 — Session P&L: historical exchange value replaced with fill-based
**Was**: Dashboard showed `margin.realizedPnl` — a historical account-total since account creation; never resets per bot session.  
**Fix**: Introduced `sessionPnl = Σ(SELL fills × price) − Σ(BUY fills × price) − Σ(fees)`. Resets on `start()`, incremented only in `handleFill()`.  
**Public fields**: `sessionPnl`, `sessionFees`, `sessionSellValue`, `sessionBuyValue`  
**File**: `botRunner.ts` lines 109–116, 262–265, 712–719

### FIX-06 — `/markets` → `/logs` (Trading Logs page)
**Was**: Markets page was a placeholder with no useful runtime data.  
**Fix**: Replaced with real-time per-bot log viewer, color-coded by severity (fill=green, error=red, skip=yellow).  
**File**: `artifacts/grid-bot/src/pages/logs.tsx`

### FIX-07 — `logs.tsx` using wrong field (`text` vs `msg`)
**Was**: `log.text` — field does not exist on `LogLine`  
**Fix**: `log.msg` — correct per `LogLine = { ts: number; msg: string }`  
**tsc status before**: 10 errors; after: 0 errors

---

## 3. Signing & Protocol Audit

| Check | Status | Detail |
|-------|--------|--------|
| Nonce in nanoseconds | ✅ | `BigInt(Date.now()) * 1_000_000n` (`signing.ts` line 182) |
| `iso: true` in binary | ✅ | `w.u8(action.iso ? 1 : 0)` — all limit orders pass `iso: true` |
| `iso: true` in JSON | ✅ | `i: action.iso ?? false` in wire format |
| `reduceOnly` in binary | ✅ | `w.u8(action.reduceOnly ? 1 : 0)` |
| `reduceOnly` in JSON | ✅ | `r: action.reduceOnly ?? false` |
| Faucet binary layout | ✅ | 32-byte pubkey + Option tag (`u8`) — matches docs |
| Faucet JSON field name | ✅ | `{ faucet: { u: pubkey } }` — matches docs (`u`, not `user`) |
| Private key never sent to backend | ✅ | Only sent to `buildAndSign()` in browser; proxy routes only forward signed tx |

---

## 4. WS Account Stream Field Mapping Audit

### Fill event — `handleFill()`
| Field used | Doc field | Status |
|-----------|-----------|--------|
| `data.price` | `price` | ✅ |
| `data.size` | `size` | ✅ |
| `data.fee` | `fee` | ✅ |
| `data.isBuy` | `isBuy` | ✅ exists |
| `data.symbol` | `symbol` | ✅ |

⚠️ **`isBuy` direction ambiguity (P2 — verify live)**: Docs define `isBuy = true if taker bought`. For our resting limit BUY orders, the fill counterparty is a taker who SELLS → `isBuy = false` from taker perspective. It is unclear whether the exchange sends `isBuy` from the account's perspective (BUY order filled → `true`) or the taker's perspective (taker sold → `false`). If it is the taker's perspective, the sessionBuyValue/sessionSellValue accumulation is INVERTED — net sessionPnl would be negated. **Must verify with one live fill in staging.**

### OrderUpdate event — `handleOrderUpdate()`
| Field used | Doc field | Status |
|-----------|-----------|--------|
| `data.sym` | `sym` | ✅ (docs confirm compact field name) |
| `data.origSz` (signed) | `origSz` — signed, negative=sell | ✅ |
| `data.sz` | `sz` — signed | ✅ |
| `data.px` | `px` | ✅ |
| `data.oid` | `oid` | ✅ |
| `data.fillSz` | `fillSz` | ✅ |
| `isBuy = origSz > 0` | derived from signed `origSz` | ✅ correct |

### AccountSnapshot openOrders — `parseOpenOrder()`
Snapshot uses long field names (`orderId`, `originalSize`, `symbol`); `parseOpenOrder` handles both aliases (`o.orderId ?? o.oid`, `o.originalSize ?? o.origSz`). ✅

---

## 5. Grid Logic Audit

### `gridEngine.ts`
| Function | Status | Notes |
|----------|--------|-------|
| `calculateGridLevels()` | ✅ | Correct LONG/SHORT/NEUTRAL filtering; levels at current price skipped |
| `allGridLevels()` | ✅ | gridCount+1 points, rounded to 2dp |
| `snapToGridLevel()` | ✅ | Linear scan, correct nearest-snap |
| `sizePerGrid()` | ✅ | `(investment × leverage / gridCount) / price` — correct |

### `computeCurrentLevel()`
Returns floor-based band index, clamped to `[0, gridCount-1]`. ✅

### `computeReduceOnly()`
- LONG + SELL → `true` (close long) ✅  
- LONG + BUY → `false` (open long) ✅  
- SHORT + BUY → `true` (close short) ✅  
- SHORT + SELL → `false` (open short) ✅  
- NEUTRAL → always `false` ✅

### `checkSlTp()`
- LONG/NEUTRAL SL: `price < stopLoss` ✅  
- LONG/NEUTRAL TP: `price > takeProfit` ✅  
- SHORT SL: `price > stopLoss` ✅  
- SHORT TP: `price < takeProfit` ✅

---

## 6. Outstanding Issues

---

### 🔴 P1 — REACTIVE mode: BUY and SELL placed at the same price boundary (zero-profit on level bounces)

**Location**: `botRunner.ts` `runGridCheck()` lines 523–525

**Root cause**: Both the UP (BUY) and DOWN (SELL) formulas resolve to the SAME `levelBasePrice(N)` for the same level N:
```
UP crossing (12→13):   BUY  at levelIdx = prevLevel + i + 1 = 13  → price = L + 13*S
DOWN crossing (13→12): SELL at levelIdx = currentLevel + i + 1 = 13 → price = L + 13*S
```
A round-trip bounce between level 12 and 13 produces:
- BUY @ L+13*S fills when price falls to that boundary
- SELL @ L+13*S placed immediately after → fills when price rises back
- **Net = 0. Only fees lost.**

This also holds for multi-level sweeps: each BUY and SELL for the same level N end up at the same price.

**The SKILL.md specification states**: "On fill: replenish — filled BUY → place SELL one step up; filled SELL → place BUY one step down."  
This fill-based replenishment is NOT implemented. `handleFill()` only tracks session P&L; it does not place any replenishment orders.

**Fix options**:

**Option A (fill-based replenishment — correct per SKILL.md)**:  
In `handleFill()`, after detecting a fill:
- If BUY filled at price P → place resting SELL at `snapToGridLevel(P + gridSpacing, ...)` (one level up)
- If SELL filled at price P → place resting BUY at `snapToGridLevel(P - gridSpacing, ...)` (one level down)
This guarantees spread = 1 spacing → profit = spacing × size − fees per round trip. The crossing-based placement in `runGridCheck()` becomes the initial seeding only.

**Option B (crossing offset fix)**:  
For DOWN crossings, shift levelIdx up by 1:
```typescript
// DOWN: SELL at currentLevel + i + 2 (one level above the BUY position)
const levelIdx = levelsMoved < 0
  ? currentLevel + i + 2   // ← was +1
  : prevLevel + i + 1;
```
Profit = 1 spacing per round trip. Simpler but doesn't handle the case where no crossing happened before a fill.

**Recommended**: Option A (fill-based replenishment) — matches SKILL.md spec, correct for both UPFRONT and REACTIVE modes.

---

### 🔴 P1 — UPFRONT mode: no replenishment after fills

**Location**: `botRunner.ts` — `handleFill()`, `placeAllOrdersUpfront()`

When UPFRONT mode is running:
- All N orders placed immediately at start
- When a fill occurs → no new order is placed
- The grid level that filled is now empty; it will never trade again
- After enough fills, the grid is fully depleted and the bot sits idle with all margin in positions

**Fix**: In `handleFill()`, check `config.orderMode === "UPFRONT"` and apply fill-based replenishment (same as Option A above). This is the standard behavior for all grid bots.

---

### 🔴 P1 — UPFRONT LONG/SHORT places orders at wrong levels

**Location**: `botRunner.ts` `placeAllOrdersUpfront()` lines 357–364

For LONG mode: **all `gridCount` levels** receive BUY orders, including levels ABOVE current price. These orders cross the book immediately as aggressive fills (not resting limit orders). The exchange fills them at market price, wasting spread on entry.

For SHORT mode: same issue — SELL below current price fills immediately.

**Expected behavior** (per `gridEngine.ts`): LONG places BUY only below current price; SHORT places SELL only above current price.

**Fix**:
```typescript
// LONG: only buy below current price (levels below currentLevel)
if (this.config.mode === "LONG" && orderPrice >= currentPrice) { skipped++; continue; }
// SHORT: only sell above current price
if (this.config.mode === "SHORT" && orderPrice <= currentPrice) { skipped++; continue; }
```

---

### 🟡 P2 — `recentOrders` Map grows indefinitely

**Location**: `botRunner.ts` line 89, `isDuplicateOrder()` lines 214–219

The `recentOrders` Map accumulates one entry per level+side pair ever seen. For a bot running for days with many crossings, this could grow to thousands of entries. No pruning mechanism exists.

**Fix**: In `isDuplicateOrder()`, after a successful lookup (or any lookup), prune entries older than `DUP_GUARD_MS`:
```typescript
private isDuplicateOrder(levelIdx: number, side: "BUY" | "SELL"): boolean {
  const now = Date.now();
  // Prune stale entries
  for (const [k, t] of this.recentOrders) {
    if (now - t >= DUP_GUARD_MS) this.recentOrders.delete(k);
  }
  const key = `${levelIdx}:${side}`;
  const last = this.recentOrders.get(key);
  if (last !== undefined && now - last < DUP_GUARD_MS) return true;
  this.recentOrders.set(key, now);
  return false;
}
```

---

### 🟡 P2 — DB `status` enum includes `IDLE` but UI/code uses `STOPPED`

**Location**: `lib/db/src/schema/bots.ts` line 6

```typescript
export const botStatusEnum = pgEnum("bot_status", ["IDLE", "RUNNING", "STOPPED", "ERROR"]);
```
Default is `IDLE`. The SKILL.md and UI badges treat non-running bots as `STOPPED`. When a bot is stopped, the API must explicitly set `STOPPED` or status remains `IDLE`.  
**Verify**: Does `POST /api/bots/:id/stop` set `status = "STOPPED"` or `"IDLE"` in the API route? Check `artifacts/api-server/src/routes/bots.ts`.

---

### 🟡 P2 — `isBuy` in fill event: taker vs account perspective (verify live)

**Location**: `botRunner.ts` `handleFill()` line 706

Documented above in §4. If the exchange sends `isBuy` from the taker's perspective:
- Our resting BUY filled by a taker seller → `isBuy = false`
- Current code: `if (isBuy)` → sessionBuyValue += ... → **never increments for our BUY fills**
- sessionPnl would be inverted

**Action**: Run one real trade in staging and log the raw fill event to confirm `isBuy` value for a known BUY limit order fill.

---

## 7. Architecture Invariants — PASS

| Invariant | Status |
|-----------|--------|
| Private key never sent to backend | ✅ |
| All external calls go through `/api` proxy | ✅ |
| Nonce in nanoseconds | ✅ |
| `iso: true` on all order actions | ✅ |
| Price inputs use `type="text"` + `parseLocaleNumber()` | ✅ |
| Two bots on same account: fill routing correct via `symbol` filter | ✅ |
| `gridCheckInFlight` prevents re-entrant checks | ✅ |
| `lastLevel` persisted to localStorage (survives page refresh) | ✅ |
| WS reconnect on disconnect (3s delay) | ✅ |
| `stop()` cancels all open orders on the symbol | ✅ |
| SL/TP check runs before crossing detection | ✅ |
| `reduceOnly` pre-check verifies matching position before send | ✅ |

---

## 8. Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 P1 Critical | 3 | Zero-profit REACTIVE, UPFRONT no replenishment, UPFRONT wrong levels |
| 🟡 P2 Moderate | 3 | Map leak, IDLE/STOPPED mismatch, isBuy ambiguity |
| ✅ Fixed | 7 | Crossing side, levelIdx, hasOpenOrderAt, totalTrades, sessionPnl, logs page, LogLine.msg |

**Recommended next action**: Implement fill-based replenishment in `handleFill()` — this single change fixes P1-REACTIVE and P1-UPFRONT simultaneously and aligns with the SKILL.md specification.
