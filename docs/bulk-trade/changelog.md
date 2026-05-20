> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# API Changelog

> API updates and version history

## v1.0.15 (20th May 2026)

<Note>
  **Client updates required.** [`bulk-client`](https://github.com/Bulk-trade/bulk-client) and [`bulk-cli`](https://github.com/Bulk-trade/bulk-cli) have been bumped to **0.1.1** to enable the changes in this release. Update both before exercising the new endpoints / fields below.
</Note>

### New Features

#### Offchain Signing Mode (any transaction shape)

Transactions can now be signed via the **Solana v0 offchain-message envelope** in addition to the default raw canonical-binary path. The signed bytes are the full offchain envelope wrapping a deterministic clear-sign text payload (`Bulk Exchange Transaction`, `Account`, `Nonce`, `Actions`, `Signable-Hash`, plus per-action lines). `format = 0x00` for ASCII payloads and `format = 0x01` for UTF-8.

| Surface             | Header            | Allowed values                  |
| ------------------- | ----------------- | ------------------------------- |
| `POST /order`       | `x-bulk-sig-mode` | `raw` \| `offchain` \| `base58` |
| WebSocket handshake | `x-bulk-sig-mode` | `raw` \| `offchain` \| `base58` |

Header is hint only; signature validity still decides accept/reject. See [Offchain Signing Mode](/api-reference/signing#offchain-signing-mode) and [Optional Handshake Headers](/api-reference/ws-connection#optional-handshake-headers).

The legacy compatibility path for **owner-signed `agentWalletCreation`** (signature over `bs58_encode(canonical_binary_message).as_bytes()`) is retained for older wallet UIs.

#### `POST /account` Query Type: `riskHistory`

New unsigned query returning the last 5000 liquidation + ADL risk events for a master or sub-account. For master/sub queries, results include both base-account rows and per-instrument isolated-account rows (`iso = true`).

| Field                         | Description                                                        |
| ----------------------------- | ------------------------------------------------------------------ |
| `eventType`                   | `liquidation` or `adl`                                             |
| `marginPrior` / `marginAfter` | Margin balance snapshot around the event                           |
| `reason`                      | Optional human-readable reason (e.g. shortfall, underfill tagging) |

See [Risk Event History](/api-reference/getAccount#risk-event-history-response).

### Improvements

#### `feeTier` Query Response Simplified (Account-Only)

`POST /account` with `type: "feeTier"` now returns just the account fee-tier quote (`scopeInstrument`, `rollingVolume`, `tierIndex`, `tierThreshold`, `makerBps`, `takerBps`, `windowDays`). Global fee-state fields (`globalPolicyActive`, `scopes`, `settledFills`, totals, etc.) live on [`GET /feeState`](/api-reference/getFeeState).

#### `liquidation_sweep` Reason Code

A new `3 = liquidation_sweep` value joins the fill `reasonCode` set (`0 = normal`, `1 = liquidation`, `2 = adl`, `3 = liquidation_sweep`) and the closed-position `closeReason` enum. Affected surfaces:

* Trades stream (`reason` label)
* Account stream fill rows (`reasonCode`)
* `POST /account` `fills` / `positions` responses

#### ADL Account-Stream Event: `adl` (lowercase) + `reason`

The `data.type` value on the account stream ADL event changed from `"ADL"` to `"adl"` to match the rest of the stream's casing convention. The liquidation and ADL events now also carry an optional human-readable `reason` field. For historical analysis use [`POST /account` with `type: "riskHistory"`](/api-reference/getAccount#risk-event-history-response).

#### `subAccounts[]` on Master Snapshots, `name` on Sub-Account Snapshots

The `subAccounts` array on a master's `fullAccount` snapshot (both HTTP `POST /account` and the WS account stream) returns rows containing only `{pubkey}`. To resolve a sub-account's display name, query/subscribe to that sub-account directly; its snapshot carries a top-level `name` field when `kind: "SubAccount"`.

#### `signers` Field Compatibility (`createMultisig`, `msu`)

`createMultisig.signers` and `msu.signers` now accept both base58 strings (preferred) and raw `[u8;32]` byte arrays. Base58 remains the recommended form for human-readable payloads.

#### `marginAmount` Must Be JSON Numbers

`createSubAccount.marginAmount` and `transfer.marginAmount` must be unquoted JSON numbers (e.g. `100.0`, not `"100.0"`). Strings are rejected.

***

## v1.0.14 (28th April 2026)

### New Features

#### Sub-Accounts (`createSubAccount`, `removeSubAccount`, `renameSubAccount`)

Master accounts can now create, rename, and remove sub-accounts via the unified `POST /order` endpoint. Sub-accounts are off-curve, protocol-derived accounts under a master with their own margin, positions, and risk profile.

| Action             | Description                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `createSubAccount` | Create a named sub-account, optionally seeded with margin atomically                         |
| `removeSubAccount` | Remove a flat sub-account (or auto-created isolated account) and sweep margin back to master |
| `renameSubAccount` | Rename an existing sub-account (`{a, n}`); pubkey is preserved                               |

See [Sub-Accounts API](/api-reference/manageSubAccounts).

#### Native Margin Transfers (`transfer`)

Move margin between accounts directly inside the protocol, with no external bridge or wrapper.

| Kind       | Scope                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `internal` | Master and its sub-accounts, including topping up a per-instrument isolated account via `isoPubkey` |
| `external` | Any account on the network                                                                          |

External transfers to off-curve addresses that are not protocol accounts are rejected; no implicit account creation.

See [Transfer API](/api-reference/transfer).

#### Multisig (`createMultisig`, `msp`, `msa`, `msr`, `msc`, `mse`, `msu`)

Protocol-native multisig accounts with M-of-N approvals and time-lock.

| Tag              | Fields                                                                        |
| ---------------- | ----------------------------------------------------------------------------- |
| `createMultisig` | `{signers, threshold, timeLockSecs, proposalLifetimeSecs}`                    |
| `msp`            | `{m, a}` propose inner actions                                                |
| `msa`            | `{m, p}` approve                                                              |
| `msr`            | `{m, p}` reject                                                               |
| `msc`            | `{m, p}` cancel                                                               |
| `mse`            | `{m, p}` execute                                                              |
| `msu`            | `{m, signers, threshold, timeLockSecs, proposalLifetimeSecs}` (proposal-only) |

See [Multisig API](/api-reference/manageMultisig).

#### Get Multisig Proposals (`GET /multisig/{pubkey}/proposals`)

New unsigned read endpoint that returns all proposal rows for a multisig, including `pending`, `ready`, `executed`, `failed`, `expired`, `cancelled`, and `rejected` states with full inner-action payloads.

See [Get Multisig Proposals](/api-reference/getMultisigProposals).

#### Isolated Account Routing (`i` flag on `l`, `m`, `st`, `tp`, `rng`, `trig`, `trl`)

Order actions that produce a position now carry a **required** `i` boolean. Setting `i = true` routes the order into a per-instrument **isolated account** (`IsoAccount`) auto-derived from the signing account and the instrument. Isolated-account positions and history rows are flagged with `iso = true` and expose an `isoPubkey` for direct margin top-up via `transfer`. Isolated accounts are torn down via `removeSubAccount` against the isolated-account pubkey.

<Warning>
  `i` is part of the canonical signed binary message. Always include it in the JSON (`true` or `false`); omitting it will produce a `bad signature` error.
</Warning>

See [Isolated Margin](/bulk-exchange/isolated-margin) and [Place & Cancel Orders](/api-reference/placeOrder#isolated-account-routing-i).

#### Trading From a Sub-Account

Every signed action (orders, modify, cancel, conditional baskets, on-fill, transfers, user settings) now works on a sub-account by setting the transaction `account` field to the sub-account pubkey while the master, the sub-account itself, or an [agent wallet](/api-reference/manageAgentWallet) registered on either signs. There is no separate sub-account endpoint or action variant. Agents registered on a master are automatically authorized for that master's sub-accounts; sub-accounts can additionally register their own agents independently.

See [Sub-Accounts: Trading From a Sub-Account](/api-reference/manageSubAccounts#trading-from-a-sub-account).

### Improvements

#### `fullAccount` Top-Level Fields

The full-account snapshot now exposes account hierarchy and authorization state:

| Field                    | Description                                                                     |
| ------------------------ | ------------------------------------------------------------------------------- |
| `kind`                   | `MasterEOA` or `SubAccount` (the account kinds that `POST /account` can return) |
| `parent`                 | Parent master pubkey for sub-accounts, `null` for masters                       |
| `subAccounts`            | List of `{pubkey, name?}` children of a master                                  |
| `multisigAccounts`       | Multisig pubkeys this account is the multisig of, or a signer member of         |
| `authorizedAgentWallets` | Agent wallets registered on this account                                        |

See [Query Account](/api-reference/getAccount).

#### `iso` Flag on Account Rows

Positions, open orders, fills, closed positions, funding payments, and order history rows all carry an `iso` boolean. When `iso=true`, position rows additionally expose `isoPubkey`, the per-instrument isolated account's pubkey. Master/sub `POST /account` queries return both base-account rows and per-instrument isolated-account rows in one response. `isoPubkey` is used solely as the `to` target of an internal `transfer` for margin top-ups; isolated-account pubkeys are not valid `user` values for `POST /account` or `account` on transactions.

#### New Response Status Types

`POST /order` now emits dedicated status rows for the new actions:

| Status                                                                                                                                                               | Source action                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `transfer` / `transferFailed`                                                                                                                                        | `transfer`                          |
| `createSubAccount` / `createSubAccountFailed`                                                                                                                        | `createSubAccount`                  |
| `removeSubAccount` / `removeSubAccountFailed`                                                                                                                        | `removeSubAccount`                  |
| `renameSubAccount` / `renameSubAccountFailed`                                                                                                                        | `renameSubAccount`                  |
| `multisigCreated` / `multisigCreatedFailed`                                                                                                                          | `createMultisig`                    |
| `proposalCreated`, `proposalApproved`, `proposalReadyForExecution`, `proposalExecuted`, `proposalFailed`, `proposalExpired`, `proposalCancelled`, `proposalRejected` | `msp`/`msa`/`msr`/`msc`/`mse`/`msu` |

See [Place & Cancel Orders](/api-reference/placeOrder) for the full status table.

***

## v1.0.13 (16th April 2026)

### New Features

#### Conditional Order Types (`st`, `tp`, `rng`, `trig`, `trl`, `of`)

Six conditional order types are now fully documented with request/response examples across HTTP and WebSocket:

| Action | Type           | Description                                         |
| ------ | -------------- | --------------------------------------------------- |
| `st`   | Stop           | Trigger when price crosses against position         |
| `tp`   | Take Profit    | Trigger when price moves in favor                   |
| `rng`  | Range / OCO    | Two-leg stop + take-profit pair (one-cancels-other) |
| `trig` | Trigger Basket | Arbitrary nested actions on threshold cross         |
| `trl`  | Trailing Stop  | Stop that follows favorable price movement          |
| `of`   | On-Fill        | One-shot follow-up actions on parent fill           |

See [Place & Cancel Orders](/api-reference/placeOrder) and [Trading via WebSocket](/api-reference/ws-trading) for full examples.

#### Conditional Response Statuses

New status types for conditional order lifecycle:

| Status              | Description                                     |
| ------------------- | ----------------------------------------------- |
| `triggered`         | Conditional root fired (non-terminal)           |
| `siblingCancelled`  | OCO sibling auto-cancelled when other leg fires |
| `triggerFailed`     | Trigger execution failed (e.g. no counterparty) |
| `depositFailed`     | Faucet deposit failed                           |
| `agentWalletFailed` | Agent wallet operation failed                   |

### Breaking Changes

<Warning>
  These changes affect response parsing.
</Warning>

#### Signed Sizes in Order Responses

Size fields in order responses are now **signed**: negative values indicate sell-side intent.

Affected fields:

* `totalSz` in `filled` / `partiallyFilled` statuses
* `filledSz` / `remainingSz` in `working` status
* `filledSz` in `cancelledIoc` status
* `origSz` / `sz` in WebSocket `orderUpdate` messages

**Example:**

```json theme={null}
{"filled": {"oid": "...", "totalSz": -0.1, "avgPx": 100025.5}}
```

A `totalSz` of `-0.1` means 0.1 BTC was sold. Previously all sizes were positive with direction inferred from `isBuy`.

#### WebSocket `orderUpdate` Compact Format

The `orderUpdate` message uses compact field names and includes trigger metadata for conditional orders:

| Old Field      | New Field                        |
| -------------- | -------------------------------- |
| `symbol`       | `sym`                            |
| `orderId`      | `oid`                            |
| `originalSize` | `origSz`                         |
| `size`         | `sz`                             |
| `filledSize`   | `fillSz`                         |
| `isBuy`        | *(removed; use signed `origSz`)* |

New fields: `ot` (order type), `mk` (maker flag), `trigger` (trigger metadata object with `isAbove`, `px`, `lim`, `oco`, `pxHi`, `limHi`, `trb`, `stb`), `pendingOnFill`.

See [Account Stream](/api-reference/ws-account) for the full `orderUpdate` reference.

***

## v1.0.12 (March 2026)

### Breaking Changes

<Warning>
  These changes require updates to your integration.
</Warning>

#### Unified Transaction Envelope (POST /order and WebSocket trading)

All signed requests now use a single envelope. The previous nested `action` / `orders` structure is no longer used.

**Before:**

```json theme={null}
{
  "action": {
    "type": "order",
    "orders": [...],
    "nonce": 1704067200000000000
  },
  "account": "...",
  "signer": "...",
  "signature": "..."
}
```

**After:**

```json theme={null}
{
  "actions": [{"l": {"c": "BTC-USD", "b": true, "px": 100000.0, "sz": 0.1, "tif": "GTC", "r": false}}],
  "nonce": 1704067200000000000,
  "account": "...",
  "signer": "...",
  "signature": "..."
}
```

**Action tags:** `l` (limit), `m` (market), `mod` (modify), `cx` (cancel one), `cxa` (cancel all). Other actions (faucet, updateUserSettings, agentWalletCreation) use the same envelope.

Affected: `POST /order`, WebSocket `post` requests for trading.

#### Signed Message Format (signer excluded)

The bytes that get signed no longer include the signer public key.

**Message to sign:**

```
bincode_serialize(actions) + nonce_le_u64 + account_pubkey_bytes
```

**Do not include** `signer` or `signature` in the signed message. `signer` remains in the JSON payload for authorization.

See [Transaction Signing](/api-reference/signing) for the full specification.

#### WebSocket: Ping-Pong Keepalive Required

The server sends a WebSocket **ping** frame every **30 seconds**. The client **must** reply with a **pong** frame. If no pong is received within **10 seconds**, the server closes the connection.

Ping and pong are transport-level WebSocket frames, not JSON application messages. Clients that do not respond to ping will be disconnected.

#### WebSocket: Risk Metrics Stream Structure

The risk stream payload has changed to the **asset risk** format.

**New structure:**

* `leverage` - Knot list (e.g. 1.0 … 50.0)
* `notionals` - Notional knot points
* `buy` / `sell` - 2D arrays indexed by `[notional_idx][leverage_idx]`, each cell `{ mmrO, mmrE, p }`
* `corrs` - Array of `[pair, correlation]`
* `regime` - Integer -12 to 12

Previous power-law style fields (`lambdaBuy`, `lambdaSell`, `buyCoefA/B`, `sellCoefA/B`) are no longer used.

#### POST /account: fullAccount Response Shape

The `fullAccount` response now returns:

* `margin` - Object with `totalBalance`, `availableBalance`, `marginUsed`, `notional`, `realizedPnl`, `unrealizedPnl`, `fees`, `funding`
* `positions` - Array with full position fields (e.g. `fairPrice`, `notional`, `liquidationPrice`, `maintenanceMargin`, `lambda`, `riskAllocation`, `allocMargin`)
* `openOrders` - Array of order state objects
* `leverageSettings` - Array of `{ symbol, leverage }`

Previous `marginSummary` / `settings.maxLeverage` shape is no longer used. Response body is an array of single-key objects (e.g. `[{ "fullAccount": { ... } }]`).

***

### New Features

#### GET /stats (Market Data)

New endpoint for exchange statistics.

**Endpoint:** `GET /stats`

**Query parameters:** `period` (1d, 7d, 30d, 90d, 1y, all), `symbol` (optional filter)

Returns aggregate volume, open interest, funding rates, and per-market stats. See [Get Exchange Statistics](/api-reference/getStats).

#### Deterministic Order IDs

Order IDs are derived from the transaction (action, account, nonce, action index). No client order ID is required. You can compute the order ID before or after sending; use [bulk-keychain](https://github.com/Bulk-trade/bulk-keychain) (Node, browser, Python, Rust) to compute them. See [Order IDs](/api-reference/orderIds).

#### WebSocket Ticker: Regime and Fair Price Fields

Ticker stream now includes:

| Field        | Description                     |
| ------------ | ------------------------------- |
| `regime`     | Market regime indicator         |
| `regimeDt`   | Regime duration (10s intervals) |
| `regimeVol`  | Regime-adjusted volatility      |
| `regimeMv`   | Regime mean value               |
| `fairBookPx` | Fair price from order book      |
| `fairVol`    | Fair volatility estimate        |
| `fairBias`   | Fair price bias                 |

Timestamp is in nanoseconds.

#### WebSocket Candles: Additional Intervals

Candle stream supports additional intervals: `3m`, `30m`, `2h`, `6h`, `8h`, `12h`, `3d`, `1w`, `1M`.

#### WebSocket Trades: reason Field

Trade messages may include optional `reason` when not a normal trade: e.g. `"liquidation"`, `"adl"`.

#### WebSocket Account Stream: allocMargin and New Events

* **Position field:** `allocMargin` (allocated margin for the position) added to snapshot and position updates.
* **New event types:** `liquidation`, `ADL`, `cancelOneRejected`, `cancelAllRejected` with full payloads. See [Account stream](/api-reference/ws-account).

Legacy `order` messages with `status: "placed"` or `"cancelled"` may still be sent; new integrations should use `orderUpdate` only.

#### WebSocket Trading: deposit and agentWallet Status Types

Response status types for faucet and agent-wallet flows: `deposit`, `agentWallet`.

#### Official Signing Library: bulk-keychain

[bulk-keychain](https://github.com/Bulk-trade/bulk-keychain) is the official signing library for Node.js, browser (WASM), Python, and Rust. It produces the correct canonical encoding and supports order ID computation. See [Transaction Signing](/api-reference/signing) and [Order IDs](/api-reference/orderIds).

***

### Improvements

#### Wincode and Bincode Compatibility

On the wire, wincode and bincode are the same (bincode-compatible encoding). See [wincode](https://docs.rs/wincode/latest/wincode/) for the Rust crate.

#### POST /account: Open Orders and Fills Response Examples

Documentation now includes explicit response examples and field descriptions for `openOrders` and `fills` query types (array of objects with keys `openOrder` and `fills` respectively).

***

## v1.0.11 (January 2026)

### Breaking Changes

<Warning>
  This is a **critical signing update**. Existing signing implementations must be updated.
</Warning>

#### Signing Implementation Update (wincode format)

The transaction signing has been updated with the correct **wincode** serialization format:

**Key Changes:**

* Action types now use **u32 enum discriminants** (not length-prefixed strings)
* Order items (`order`, `cancel`, `cancelAll`) use u32 discriminants
* Pubkeys and Hashes are serialized as **raw 32 bytes** (decoded from base58)
* Added support for `cloid` (client order ID) as `Option<Hash>`
* Faucet user field is now raw 32-byte pubkey (not string)

**Action Discriminants:**

```typescript theme={null}
const ACTION_CODES = {
  order: 0,
  oracle: 1,
  faucet: 2,
  updateUserSettings: 3,
  agentWalletCreation: 4,
};
```

**Order Item Discriminants:**

```typescript theme={null}
const ORDER_ITEM_CODES = {
  order: 0,
  cancel: 1,
  cancelAll: 2,
};
```

See [Transaction Signing](/api-reference/signing) for the complete implementation with binary layout reference.

***

## v1.0.10 (January 2026)

### Breaking Changes

<Warning>
  These changes require updates to your integration.
</Warning>

#### Nonce Requirement for Signed Transactions

All signed transactions now require a `nonce` field (u64) for replay protection.

**Before:**

```json theme={null}
{
  "action": {
    "type": "order",
    "orders": [...]
  },
  "account": "...",
  "signer": "...",
  "signature": "..."
}
```

**After:**

```json theme={null}
{
  "action": {
    "type": "order",
    "orders": [...],
    "nonce": 1704067200000000000
  },
  "account": "...",
  "signer": "...",
  "signature": "..."
}
```

**Recommendation:** Use nanosecond timestamps: `BigInt(Date.now()) * 1_000_000n`

Affected endpoints:

* `POST /order` - Place/cancel orders
* `POST /agent-wallet` - Manage agent wallets
* `POST /user-settings` - Update user settings
* `POST /private/faucet` - Request testnet funds

***

### New Features

#### WebSocket: Subscription Response Format

Subscription confirmations now return topic strings instead of numeric IDs.

**New Format:**

```json theme={null}
{
  "type": "subscriptionResponse",
  "topics": ["ticker.BTC-USD", "trades.BTC-USD"]
}
```

#### WebSocket: Unsubscription via Topic String

```json theme={null}
{
  "method": "unsubscribe",
  "topic": "ticker.BTC-USD"
}
```

#### WebSocket: Batched Account Subscriptions

Subscribe to multiple accounts in a single request:

```json theme={null}
{
  "method": "subscribe",
  "subscription": [{
    "type": "account",
    "user": ["pubkey1", "pubkey2", "pubkey3"]
  }]
}
```

#### WebSocket: Unified `orderUpdate` Message

All order state changes now use a single `orderUpdate` message type with comprehensive state information.

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "orderUpdate",
    "status": "filled",
    "symbol": "BTC-USD",
    "orderId": "...",
    "price": 100000.0,
    "originalSize": 0.1,
    "size": 0.0,
    "filledSize": 0.1,
    "vwap": 100025.5,
    "isBuy": true,
    "maker": false,
    "timestamp": 1763316177219383423,
    "reason": null
  },
  "topic": "account.pubkey"
}
```

#### Account Query: New Query Types

Three new query types added to `POST /account`:

* `positions` - Closed position history (last 5000)
* `fundingHistory` - Funding payment history (last 5000)
* `orderHistory` - Terminal order history (last 5000)

```json theme={null}
{"type": "positions", "user": "..."}
{"type": "fundingHistory", "user": "..."}
{"type": "orderHistory", "user": "..."}
```

#### WebSocket: Frontend Context Stream

New stream for aggregated market data across all symbols:

```json theme={null}
{
  "method": "subscribe",
  "subscription": [{"type": "frontendContext"}]
}
```

Returns summary data for all markets every 2 seconds.

#### WebSocket: Risk Metrics Stream

Subscribe to coin-based risk metrics:

```json theme={null}
{
  "method": "subscribe",
  "subscription": [{
    "type": "risk",
    "symbol": "BTC-USD"
  }]
}
```

***

### Improvements

#### Expanded Order Status Types

Added granular status types for better order tracking:

| Status                  | Description                         |
| ----------------------- | ----------------------------------- |
| `placed`                | Order placed and resting on book    |
| `working`               | Partial fills, still resting        |
| `filled`                | Fully filled                        |
| `partiallyFilled`       | Partially filled and terminal       |
| `cancelled`             | Cancelled by user                   |
| `cancelledRiskLimit`    | Cancelled - risk limit exceeded     |
| `cancelledSelfCrossing` | Cancelled - self-trade prevention   |
| `cancelledReduceOnly`   | Cancelled - would increase position |
| `cancelledIOC`          | IOC expired without full fill       |
| `rejectedCrossing`      | Post-only rejected for crossing     |
| `rejectedDuplicate`     | Duplicate order ID                  |
| `rejectedRiskLimit`     | Rejected - risk limit on submission |
| `rejectedInvalid`       | Invalid order parameters            |

#### L2 Delta Stream Behavior

L2 Delta provides an initial snapshot (latest cached book state) on subscription, followed by real-time delta updates for every price level change.

#### Enhanced Account Snapshot

Account snapshot now includes additional fields:

* `originalSize` - Original order size
* `vwap` - Volume-weighted average fill price
* `maker` - Maker/taker indicator
* `reduceOnly` - Reduce-only flag
* `tif` - Time in force

***

## Migration Guide

### 1. Add Nonce to Signed Transactions

```typescript theme={null}
const nonce = BigInt(Date.now()) * 1_000_000n;

const action = {
  type: "order",
  orders: [...],
  nonce: nonce  // Required
};
```

Update your bincode serialization to include nonce.

### 2. Update WebSocket Subscription Handling

```javascript theme={null}
// Old way (deprecated)
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.channel === 'subscriptionResponse') {
    // Handle numeric IDs
  }
});

// New way
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'subscriptionResponse') {
    console.log('Subscribed to:', msg.topics);
  }
});
```

### 3. Handle New Order Status Types

```javascript theme={null}
switch(orderUpdate.status) {
  case 'placed':
  case 'working':
    // Non-terminal - order is active
    break;
  case 'filled':
  case 'partiallyFilled':
  case 'cancelled':
  case 'cancelledRiskLimit':
  case 'cancelledSelfCrossing':
  case 'cancelledReduceOnly':
  case 'cancelledIOC':
  case 'rejectedCrossing':
  case 'rejectedDuplicate':
  case 'rejectedRiskLimit':
  case 'rejectedInvalid':
    // Terminal - order is complete
    break;
}
```

***

## Previous Versions

### v1.0.0

* Initial public API release
* HTTP REST API
* WebSocket streaming
* Ed25519 transaction signing
