> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Place & Cancel Orders (Signed)

> Place limit/market orders, cancel, and modify via the unified transaction endpoint

All order operations use the **unified** `POST /order` endpoint. Send a transaction with an `actions` array; each action is a tagged object (e.g. `{"l": {...}}` for a limit order).

<Note>
  See [Transaction Signing](/api-reference/signing) for how to sign requests. Use a unique **nonce** (e.g. nanoseconds): `BigInt(Date.now()) * 1_000_000n`.
</Note>

***

## Transaction Envelope

Every request to `POST /order` has this shape:

```json theme={null}
{
  "actions": [Action, ...],
  "nonce": 1704067200000,
  "account": "base58_pubkey",
  "signer": "base58_pubkey",
  "signature": "base58_signature"
}
```

| Field       | Description                                                                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions`   | Array of action objects (see below). Order/cancel/modify use `l`, `m`, `mod`, `cx`, `cxa`, `st`, `tp`, `rng`, `trig`, `trl`, `of`.                                                                                                |
| `nonce`     | Unique value for replay protection (e.g. timestamp in nanoseconds).                                                                                                                                                               |
| `account`   | Account public key (base58); whose account is traded. Set this to a [sub-account](/api-reference/manageSubAccounts) pubkey to trade on a sub-account, with its master (or an agent wallet authorized on either) as `signer`.      |
| `signer`    | Signer public key (base58); who is signing. Either the `account` itself, or an authorized [agent wallet](/api-reference/manageAgentWallet) registered on the `account` (or on the parent master when `account` is a sub-account). |
| `signature` | Ed25519 signature (base58).                                                                                                                                                                                                       |

### Optional Request Header

`POST /order` accepts an optional `x-bulk-sig-mode: raw | offchain | base58` header that hints which signature verifier path to try first. The header is a hint only; signature validity still decides accept/reject. Omit it for the default raw canonical-binary path. See [Offchain Signing Mode](/api-reference/signing#offchain-signing-mode).

<Tip>
  **Trading on a sub-account**: every action on this page (orders, modify, cancel, conditional baskets, on-fill) works on a sub-account exactly the same way. Just set `account` to the sub-account pubkey while its master (or an authorized agent wallet) signs. See [Sub-Accounts: Trading From a Sub-Account](/api-reference/manageSubAccounts#trading-from-a-sub-account).
</Tip>

***

## Isolated Account Routing (`i`)

Order actions that produce a position (`l`, `m`, `st`, `tp`, `rng`, `trig`, `trl`) carry a required `i` boolean. When `i = true`, the order is routed into a per-instrument **isolated account** under the signing `account` instead of its base account. Isolated accounts are managed entirely through this flag; they are never set as `account` on a transaction.

```json theme={null}
{"l": {"c": "BTC-USD", "b": true, "px": 100000.0, "sz": 0.1, "tif": "GTC", "r": false, "i": true}}
```

Behaviour:

* The isolated account is auto-derived from the signing `account` and the instrument; no separate "create" call is required. The protocol attaches it under the signing master/sub-account on first use.
* Resulting fills, positions, fees, and risk live on the isolated account, not the base account. Isolated-account rows in account snapshots and history carry `iso = true` and expose the isolated account's pubkey as `isoPubkey`.
* A liquidation on the isolated account only touches that account's margin. The signing master/sub-account is unaffected.
* Top up isolated-account margin by sending a `transfer` action with `to = isoPubkey`. This is the **only** place an isolated-account pubkey is used directly. See [Transfer](/api-reference/transfer).
* Set `i = false` to keep base-account routing.

For full conceptual background and lifecycle, see [Isolated Margin](/bulk-exchange/isolated-margin).

***

## Place Limit Order (`l`)

### GTC (Good Till Cancel)

Standard limit order that rests on the book.

```json theme={null}
{
  "actions": [
    {"l": {"c": "BTC-USD", "b": true, "px": 100000.0, "sz": 0.1, "tif": "GTC", "r": false, "i": false}}
  ],
  "nonce": 1704067200000,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7sVt3k2YxPqH4w..."
}
```

### IOC (Immediate or Cancel)

Fills immediately or cancels the unfilled portion.

```json theme={null}
{"l": {"c": "BTC-USD", "b": true, "px": 105000.0, "sz": 0.1, "tif": "IOC", "r": false, "i": false}}
```

### ALO (Add Liquidity Only / Post-Only)

Maker only; rejected if it would cross the spread.

```json theme={null}
{"l": {"c": "BTC-USD", "b": true, "px": 99000.0, "sz": 0.1, "tif": "ALO", "r": false, "i": false}}
```

### Limit Order Fields

| Field | Type    | Description                                                                                                                                                                 |
| ----- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c`   | string  | Symbol (e.g. "BTC-USD")                                                                                                                                                     |
| `b`   | boolean | `true` = buy, `false` = sell                                                                                                                                                |
| `px`  | number  | Limit price                                                                                                                                                                 |
| `sz`  | number  | Size/quantity                                                                                                                                                               |
| `tif` | string  | Time in force: `"GTC"`, `"IOC"`, `"ALO"`                                                                                                                                    |
| `r`   | boolean | Reduce-only                                                                                                                                                                 |
| `i`   | boolean | Required. `true` routes the order into the per-instrument [isolated account](/bulk-exchange/isolated-margin) under the signing account; `false` keeps base-account routing. |

***

## Place Market Order (`m`)

Executes at best available price immediately.

```json theme={null}
{
  "actions": [
    {"m": {"c": "BTC-USD", "b": true, "sz": 0.1, "r": false, "i": false}}
  ],
  "nonce": 1704067200001,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7sVt3k2YxPqH4w..."
}
```

| Field | Type    | Description                                                                                                                                                                 |
| ----- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c`   | string  | Symbol                                                                                                                                                                      |
| `b`   | boolean | `true` = buy, `false` = sell                                                                                                                                                |
| `sz`  | number  | Size/quantity                                                                                                                                                               |
| `r`   | boolean | Reduce-only                                                                                                                                                                 |
| `i`   | boolean | Required. `true` routes the order into the per-instrument [isolated account](/bulk-exchange/isolated-margin) under the signing account; `false` keeps base-account routing. |

***

## Modify Order (`mod`)

Change the size of an existing resting order.

```json theme={null}
{
  "actions": [
    {"mod": {"oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F", "symbol": "BTC-USD", "amount": 0.05}}
  ],
  "nonce": 1704067200008,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

| Field    | Type   | Description            |
| -------- | ------ | ---------------------- |
| `oid`    | string | Order ID (base58 hash) |
| `symbol` | string | Symbol                 |
| `amount` | number | New order size         |

***

## Cancel Single Order (`cx`)

Cancel a specific order by ID.

```json theme={null}
{
  "actions": [
    {"cx": {"c": "BTC-USD", "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F"}}
  ],
  "nonce": 1704067200002,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

| Field | Description                 |
| ----- | --------------------------- |
| `c`   | Symbol                      |
| `oid` | Order ID to cancel (base58) |

***

## Cancel All Orders (`cxa`)

### Cancel all in one symbol

```json theme={null}
{"cxa": {"c": ["BTC-USD"]}}
```

### Cancel all across all symbols

```json theme={null}
{"cxa": {"c": []}}
```

| Field | Description                                       |
| ----- | ------------------------------------------------- |
| `c`   | Array of symbols; use `[]` to cancel all symbols. |

***

## Batch Actions

Send multiple actions in one transaction (e.g. cancel + place).

```json theme={null}
{
  "actions": [
    {"cx": {"c": "BTC-USD", "oid": "old_order_hash_base58"}},
    {"l": {"c": "BTC-USD", "b": true, "px": 99000.0, "sz": 0.05, "tif": "GTC", "r": false}},
    {"l": {"c": "BTC-USD", "b": false, "px": 101000.0, "sz": 0.05, "tif": "GTC", "r": false}}
  ],
  "nonce": 1704067200007,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

***

## Stop Order (`st`)

Place a conditional stop order that triggers when price crosses a threshold.

```json theme={null}
{
  "actions": [
    {"st": {"c": "BTC-USD", "d": false, "sz": 0.25, "tr": 98000.0, "lim": 97950.0, "i": false}}
  ],
  "nonce": 1704067200011,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

| Field | Type    | Description                                                                                                                                                                           |
| ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c`   | string  | Symbol                                                                                                                                                                                |
| `d`   | boolean | Trigger direction (`true` = above/equal, `false` = below/equal)                                                                                                                       |
| `sz`  | number  | Size to execute on trigger                                                                                                                                                            |
| `tr`  | number  | Trigger threshold price                                                                                                                                                               |
| `lim` | number? | Optional limit price after trigger. Omit for market-style                                                                                                                             |
| `i`   | boolean | Required. `true` routes the triggered order into the per-instrument [isolated account](/bulk-exchange/isolated-margin) under the signing account; `false` keeps base-account routing. |

***

## Take Profit Order (`tp`)

Place a conditional take-profit order.

```json theme={null}
{
  "actions": [
    {"tp": {"c": "BTC-USD", "d": true, "sz": 0.25, "tr": 104000.0, "lim": 103950.0, "i": false}}
  ],
  "nonce": 1704067200012,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

Same fields as Stop Order (`st`).

***

## Range / OCO Order (`rng`)

Place a range collar (one-cancels-the-other stop + take-profit pair).

```json theme={null}
{
  "actions": [
    {"rng": {"c": "BTC-USD", "d": true, "sz": 0.5, "pmin": 96000.0, "pmax": 106000.0, "lmin": 95950.0, "lmax": 105950.0, "i": false}}
  ],
  "nonce": 1704067200013,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

| Field  | Type    | Description                                                                                                                                                                          |
| ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `c`    | string  | Symbol                                                                                                                                                                               |
| `d`    | boolean | Position direction (`true` = long collar, `false` = short)                                                                                                                           |
| `sz`   | number  | Size to protect/exit                                                                                                                                                                 |
| `pmin` | number  | Lower trigger threshold                                                                                                                                                              |
| `pmax` | number  | Upper trigger threshold                                                                                                                                                              |
| `lmin` | number? | Optional limit for lower trigger leg                                                                                                                                                 |
| `lmax` | number? | Optional limit for upper trigger leg                                                                                                                                                 |
| `i`    | boolean | Required. `true` routes the triggered legs into the per-instrument [isolated account](/bulk-exchange/isolated-margin) under the signing account; `false` keeps base-account routing. |

***

## Trigger Basket (`trig`)

Place a trigger that executes a list of actions when threshold is crossed.

```json theme={null}
{
  "actions": [
    {"trig": {"c": "BTC-USD", "d": true, "tr": 105000.0, "actions": [
      {"m": {"c": "BTC-USD", "b": true, "sz": 0.1, "r": false, "i": false}},
      {"cx": {"c": "BTC-USD", "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F"}}
    ], "i": false}}
  ],
  "nonce": 1704067200014,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

| Field     | Type      | Description                                                                                                                                                                         |
| --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c`       | string    | Symbol                                                                                                                                                                              |
| `d`       | boolean   | Trigger direction (`true` = above/equal, `false` = below/equal)                                                                                                                     |
| `tr`      | number    | Trigger threshold                                                                                                                                                                   |
| `actions` | Action\[] | Actions executed when trigger fires                                                                                                                                                 |
| `i`       | boolean   | Required. `true` routes trigger execution into the per-instrument [isolated account](/bulk-exchange/isolated-margin) under the signing account; `false` keeps base-account routing. |

Nested actions support: `m`, `l`, `mod`, `cx`, `cxa`, `st`, `tp`, `rng`, `trl`.

***

## Trailing Stop (`trl`)

Place a trailing conditional that adjusts with favorable price movement.

```json theme={null}
{
  "actions": [
    {"trl": {"c": "BTC-USD", "b": true, "sz": 0.25, "trb": 100, "stb": 10, "lim": null, "i": false}}
  ],
  "nonce": 1704067200015,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

| Field | Type    | Description                                                                                                                                                                          |
| ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `c`   | string  | Symbol                                                                                                                                                                               |
| `b`   | boolean | Protected position direction (`true` = long, `false` = short)                                                                                                                        |
| `sz`  | number  | Size to protect/exit                                                                                                                                                                 |
| `trb` | integer | Trailing distance in bps                                                                                                                                                             |
| `stb` | integer | Favorable reset step in bps                                                                                                                                                          |
| `lim` | number? | Optional limit price. `null` for market-style trigger                                                                                                                                |
| `i`   | boolean | Required. `true` routes trailing execution into the per-instrument [isolated account](/bulk-exchange/isolated-margin) under the signing account; `false` keeps base-account routing. |

***

## On-Fill (`of`)

Register one-shot follow-up actions that execute on the first fill of a parent action.

```json theme={null}
{
  "actions": [
    {"l": {"c": "BTC-USD", "b": true, "px": 100000.0, "sz": 0.25, "tif": "GTC", "r": false, "i": false}},
    {"of": {"p": 0, "actions": [
      {"st": {"c": "BTC-USD", "d": false, "sz": 0.25, "tr": 98000.0, "lim": null, "i": false}}
    ]}}
  ],
  "nonce": 1704067200016,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

| Field     | Type      | Description                                           |
| --------- | --------- | ----------------------------------------------------- |
| `p`       | integer   | Parent action index in the same transaction (0-based) |
| `actions` | Action\[] | One-shot consequents executed on first fill of parent |

Nested actions support: `m`, `l`, `mod`, `cx`, `cxa`, `st`, `tp`, `rng`, `trig`, `trl`.

<Note>
  **Cancelling conditional orders**: Use `cx` with the conditional order ID or `cxa` to cancel all orders including conditionals.
</Note>

***

## Response Format

All submissions return an `OrderResponse` with one status per execution event:

```json theme={null}
{
  "status": "ok",
  "response": {
    "type": "order",
    "data": {
      "statuses": [Status, ...]
    }
  }
}
```

<Tip>
  Size fields in responses (`totalSz`, `filledSz`, `remainingSz`) are **signed**: negative values indicate sell-side. For example, a fully-filled sell of 0.1 BTC returns `totalSz: -0.1`.
</Tip>

Authentication failures are returned as HTTP 200 with `status: "error"` and `statuses: [{"error":{"message":"bad signature"}}]` or `statuses: [{"error":{"message":"unauthorized signer"}}]`.

### Non-Terminal (order still active)

| Status      | Description                      | Fields                               |
| ----------- | -------------------------------- | ------------------------------------ |
| `resting`   | Order placed and resting on book | `{oid}`                              |
| `working`   | Partial fills, still resting     | `{oid, filledSz, remainingSz, vwap}` |
| `triggered` | Conditional root fired           | `{oid}`                              |

### Terminal (order complete)

| Status                      | Description                                                               | Fields                                                                 |
| --------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `filled`                    | Order fully filled                                                        | `{oid, totalSz, avgPx}`                                                |
| `partiallyFilled`           | Partially filled and terminal                                             | `{oid, totalSz, avgPx}`                                                |
| `cancelled`                 | Cancelled by user                                                         | `{oid}`                                                                |
| `cancelledRiskLimit`        | Cancelled - risk limit                                                    | `{oid, reason?}`                                                       |
| `cancelledSelfCrossing`     | Cancelled - self-crossing (STP)                                           | `{oid}`                                                                |
| `cancelledReduceOnly`       | Cancelled - would not reduce position                                     | `{oid}`                                                                |
| `cancelledIoc`              | IOC expired without full fill                                             | `{oid, filledSz}`                                                      |
| `rejectedCrossing`          | Post-only rejected for crossing                                           | `{oid}`                                                                |
| `rejectedDuplicate`         | Duplicate order ID                                                        | `{oid}`                                                                |
| `rejectedRiskLimit`         | Rejected - risk limit                                                     | `{oid, reason?}`                                                       |
| `rejectedInvalid`           | Invalid parameters                                                        | `{oid, reason?}`                                                       |
| `siblingCancelled`          | OCO sibling auto-cancelled                                                | `{oid}`                                                                |
| `triggerFailed`             | Trigger execution failed                                                  | `{oid, reason?}`                                                       |
| `deposit`                   | Faucet deposit succeeded                                                  | `{amount}`                                                             |
| `depositFailed`             | Faucet deposit failed                                                     | `{message}`                                                            |
| `agentWallet`               | Agent wallet registered                                                   | `{agentWallet}`                                                        |
| `agentWalletFailed`         | Agent wallet failed                                                       | `{message}`                                                            |
| `transfer`                  | Margin transfer succeeded. See [Transfer](/api-reference/transfer)        | `{from, to, symbol, amount}`                                           |
| `transferFailed`            | Margin transfer failed                                                    | `{message}`                                                            |
| `createSubAccount`          | Sub-account created. See [Sub-Accounts](/api-reference/manageSubAccounts) | `{master, sub, name, margin}`                                          |
| `createSubAccountFailed`    | Sub-account creation failed                                               | `{message}`                                                            |
| `removeSubAccount`          | Sub-account removed                                                       | `{account, marginMoved}`                                               |
| `removeSubAccountFailed`    | Sub-account removal failed                                                | `{message}`                                                            |
| `multisigCreated`           | Multisig created. See [Multisig](/api-reference/manageMultisig)           | `{pubkey, threshold, signersLen, timeLockSecs, lifetimeSecs, creator}` |
| `multisigCreatedFailed`     | Multisig creation failed                                                  | `{message}`                                                            |
| `proposalCreated`           | Multisig proposal opened                                                  | `MultisigProposalEvent`                                                |
| `proposalApproved`          | Multisig signer approved                                                  | `MultisigProposalEvent`                                                |
| `proposalReadyForExecution` | Threshold reached, awaiting time-lock                                     | `MultisigProposalEvent`                                                |
| `proposalExecuted`          | Proposal executed atomically                                              | `MultisigProposalEvent`                                                |
| `proposalFailed`            | Proposal execution rolled back                                            | `MultisigProposalEvent + {message}`                                    |
| `proposalExpired`           | Proposal expired without execution                                        | `MultisigProposalEvent`                                                |
| `proposalCancelled`         | Proposer cancelled proposal                                               | `MultisigProposalEvent`                                                |
| `proposalRejected`          | Proposal blocked by rejections                                            | `MultisigProposalEvent`                                                |
| `cancelOneRejected`         | Cancel rejected                                                           | `{oid, reason}`                                                        |
| `cancelAllRejected`         | Cancel all rejected                                                       | `{reason}`                                                             |
| `error`                     | Generic error                                                             | `{message}`                                                            |

`MultisigProposalEvent` carries: `{multisig, proposalId, status, approvals, rejections, threshold, executeAfter, expiresAt}` plus optional `signer`, `proposer`, and `message` fields where applicable.

***

## Response Examples

<CodeGroup>
  ```json Resting theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [{"resting": {"oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F"}}]
      }
    }
  }
  ```

  ```json Working (sell side, signed) theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [{
          "working": {
            "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
            "filledSz": -0.05,
            "remainingSz": -0.05,
            "vwap": 100000.0
          }
        }]
      }
    }
  }
  ```

  ```json Filled (buy side) theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [{
          "filled": {
            "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
            "totalSz": 0.1,
            "avgPx": 100025.5
          }
        }]
      }
    }
  }
  ```

  ```json Filled (sell side, signed) theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [{
          "filled": {
            "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
            "totalSz": -0.1,
            "avgPx": 100025.5
          }
        }]
      }
    }
  }
  ```

  ```json Triggered (conditional) theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [{"triggered": {"oid": "9nU4oRhHQkIGY8wOrBTiypn1irpd07GiWeBC7Go6RSj9"}}]
      }
    }
  }
  ```

  ```json Sibling Cancelled (OCO) theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [{"siblingCancelled": {"oid": "DEF..."}}]
      }
    }
  }
  ```

  ```json Trigger Failed theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [{"triggerFailed": {"oid": "GHI...", "reason": "conditional execution failed: no counterparty"}}]
      }
    }
  }
  ```

  ```json Cancelled theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [{"cancelled": {"oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F"}}]
      }
    }
  }
  ```

  ```json Error theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [{"error": {"message": "Insufficient margin"}}]
      }
    }
  }
  ```
</CodeGroup>


## OpenAPI

````yaml /api-reference/openapi.yaml POST /order
openapi: 3.0.3
info:
  title: Bulk Trade API
  description: >
    # BULK TRADE (HTTP & WebSocket) API


    One Exchange Infinite Markets.


    ## API Structure


    This API is divided into three main sections:


    ### 1. Market Data Endpoints (Public, Read-only)

    - Exchange information and symbols

    - Market statistics and tickers

    - Historical candles (OHLCV)

    - Order book snapshots

    - **HTTP**: REST endpoints for queries

    - **WebSocket**: Real-time streams for live data


    ### 2. Account Endpoints (Public, Unsigned)

    - Query account state (positions, orders, margin)

    - Query fill history

    - **No signature required** - read-only operations

    - Does not mutate state


    ### 3. Transaction Endpoint (Signed, State-Mutating)

    - Single `POST /order` endpoint for all operations

    - Place orders (limit, market), cancel, faucet, settings, agent wallets

    - Unified `Transaction` model with `actions` array

    - **Signature required** - Ed25519 signature of transaction

    - Mutates account state


    ## Base URLs


    > **Trading competition in progress.** Production endpoints
    (`exchange-api.bulk.trade`,

    > `exchange-ws1.bulk.trade`) are paused for the duration of the competition.
    Use the

    > staging endpoints below and trade from
    [staging.bulk.trade](https://staging.bulk.trade).


    - **HTTP REST**: `https://staging-api.bulk.trade/api/v1`

    - **WebSocket**: `wss://staging-ws.bulk.trade`


    ## Glossary


    ### Field Notation


    Bulk uses compact field names to minimize bandwidth (critical for HFT):


    | Short | Full Name | Description |

    |-------|-----------|-------------|

    | `s` | symbol | Market symbol (e.g., BTC-USD) |

    | `c` | coin | Market symbol in orders / cancel |

    | `px` | price | Price level |

    | `sz` | size | Order/position size |

    | `b` | is_buy | Buy/sell direction (true=buy, false=sell) |

    | `r` | reduce_only | Order only reduces position |

    | `tif` | time_in_force | Order lifetime (GTC/IOC/ALO) |

    | `o` | open | Open price (candles) |

    | `h` | high | High price (candles) |

    | `l` | low | Low price (candles) |

    | `v` | volume | Trading volume |

    | `n` | count | Number of trades/orders |

    | `T` | close_time | Close timestamp |

    | `oid` | order_id | Order identifier (base58) |

    | `u` | user | User public key |

    | `a` | agent | Agent public key |

    | `d` | delete | Delete flag |

    | `m` | max_leverage | Leverage settings map |

    | `reason` | reason | Fill reason (normal/liquidation/adl) |


    ### Order Types


    | Action Type | TIF | Description | Use Case |

    |-------------|-----|-------------|----------|

    | `l` | **GTC** | Good Till Cancel | Standard limit order, rests on book |

    | `l` | **IOC** | Immediate or Cancel | Fill or kill (aggressive price) |

    | `l` | **ALO** | Add Liquidity Only | Maker-only (post-only) |

    | `m` | N/A | Market Order | Immediate execution at best price |


    ### Market Terminology


    - **Perpetual**: Perpetual futures contract (no expiry)

    - **Mark Price**: Fair value price (used for margin calculations)

    - **Oracle Price**: External reference price

    - **Open Interest**: Total notional value of open positions

    - **Funding Rate**: Periodic payment between longs and shorts

    - **Maker**: Liquidity provider (resting order)

    - **Taker**: Liquidity consumer (aggressive order)

    - **Tick Size**: Minimum price increment

    - **Lot Size**: Minimum order size


    ### Timestamp Formats


    - **HTTP API**: Milliseconds since Unix epoch (int64)

    - **WebSocket**: Milliseconds since Unix epoch (int64)

    - **Internal**: Nanoseconds (converted at API boundary)
  version: 3.0.10
  contact:
    name: Junbug
    url: https://x.com/junbug_sol
  license:
    name: Custom
    url: https://www.custom.com/license
servers:
  - url: https://staging-api.bulk.trade/api/v1
    description: Staging (trading competition)
  - url: https://exchange-api.bulk.trade/api/v1
    description: Production (paused during trading competition)
security: []
tags:
  - name: Market Data
    description: |
      **Public, read-only endpoints**

      Real-time and historical market data. No authentication required.

      **HTTP**: Query historical data
      **WebSocket**: Subscribe to real-time updates
  - name: Account (Unsigned)
    description: |
      **Public, read-only, no signature required**

      Query account information. Does not mutate state.
      Anyone can query any account's public data.
  - name: Trading (Signed)
    description: |
      **Authenticated, state-mutating endpoints**

      Place and cancel orders. Requires Ed25519 signature.
      See "Transaction Signing" section for details.
paths:
  /order:
    post:
      tags:
        - Trading (Signed)
      summary: Submit transaction (signed)
      description: >
        Unified endpoint for all state-mutating operations. **Requires Ed25519
        signature**.


        Uses a unified `Transaction` model with an `actions` array containing
        any combination of

        action types. Each action is a tagged object in the `actions` array.


        **Action types**:


        | Tag | Action |

        |---|---|

        | `l` | Place a resting limit order (GTC, IOC, ALO) |

        | `m` | Execute at market price |

        | `mod` | Modify an existing order |

        | `cx` | Cancel a specific order by ID |

        | `cxa` | Cancel all orders (by symbol or all) |

        | `st` | Place stop conditional order |

        | `tp` | Place take-profit conditional order |

        | `rng` | Place range/OCO conditional order |

        | `trig` | Place trigger basket order |

        | `trl` | Place trailing-stop conditional order |

        | `of` | Register on-fill consequents for a parent action in the same
        transaction |

        | `faucet` | Request testnet funds |

        | `agentWalletCreation` | Register/remove agent wallet |

        | `updateUserSettings` | Update leverage settings |

        | `createSubAccount` | Create a sub-account under the signing master |

        | `removeSubAccount` | Remove a sub-account and sweep margin back |

        | `renameSubAccount` | Rename an existing sub-account |

        | `transfer` | Transfer margin between accounts (internal/external;
        per-instrument isolated-account top-up) |

        | `createMultisig` | Create a protocol-native multisig account |

        | `msp` / `msa` / `msr` / `msc` / `mse` / `msu` | Multisig propose /
        approve / reject / cancel / execute / update-policy |

        | `whitelistFaucet` | Whitelist account for faucet (admin) |

        | `px` | Submit price action (admin) |

        | `o` | Batch Pyth oracle prices (admin) |


        **Batch example**: Cancel an existing order and place new ones:

        ```json

        {"actions": [{"cx": {"c": "BTC-USD", "oid": "..."}}, {"l": {...}}, {"l":
        {...}}], "nonce": ..., "account": "...", "signer": "...", "signature":
        "..."}

        ```


        **Signing**: See [Transaction Signing](/api-reference/signing) for
        complete wincode serialization and signing details.


        **Optional header**: `x-bulk-sig-mode: raw | offchain | base58` hints
        which signature verifier path to try first. Hint only; signature
        validity still decides accept/reject. Omit for the default raw
        canonical-binary path. See [Offchain Signing
        Mode](/api-reference/signing#offchain-signing-mode).
      operationId: submitTransaction
      parameters:
        - in: header
          name: x-bulk-sig-mode
          required: false
          description: >
            Optional signature-mode hint. Hint only - signature validity still
            decides accept/reject.

            Omit to use the default raw canonical-binary verification path. Set
            to `offchain` when the

            transaction was signed using the [v0 Solana offchain
            envelope](/api-reference/signing#offchain-signing-mode).
          schema:
            type: string
            enum:
              - raw
              - offchain
              - base58
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Transaction'
            examples:
              limitGTC:
                summary: GTC Limit Order
                value:
                  actions:
                    - l:
                        c: BTC-USD
                        b: true
                        px: 100000
                        sz: 0.1
                        tif: GTC
                        r: false
                        i: false
                  nonce: 1704067200000
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              limitIsolated:
                summary: >-
                  GTC Limit Order routed into the per-instrument isolated
                  account
                value:
                  actions:
                    - l:
                        c: BTC-USD
                        b: true
                        px: 100000
                        sz: 0.1
                        tif: GTC
                        r: false
                        i: true
                  nonce: 1704067200030
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              limitFromSubAccount:
                summary: >-
                  GTC Limit Order placed from a sub-account (master signs,
                  account = sub pubkey)
                value:
                  actions:
                    - l:
                        c: BTC-USD
                        b: true
                        px: 100000
                        sz: 0.1
                        tif: GTC
                        r: false
                        i: false
                  nonce: 1704067200031
                  account: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              marketOrder:
                summary: Market Order
                value:
                  actions:
                    - m:
                        c: BTC-USD
                        b: true
                        sz: 0.1
                        r: false
                        i: false
                  nonce: 1704067200001
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              modifyOrder:
                summary: Modify Order Size
                value:
                  actions:
                    - mod:
                        oid: Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F
                        symbol: BTC-USD
                        amount: 0.05
                  nonce: 1704067200008
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              cancelSingle:
                summary: Cancel Single Order
                value:
                  actions:
                    - cx:
                        c: BTC-USD
                        oid: order_hash_base58
                  nonce: 1704067200002
                  account: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                  signer: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                  signature: >-
                    rpkxJezRft2xqfFxaqYRCTRtoobV4Z2Btqj6P52bEcAKczLn5Rgf2Yfm37UN4HGJwywR4QkuDjJUkwZ93DB2Fw9
              cancelAll:
                summary: Cancel All Orders
                value:
                  actions:
                    - cxa:
                        c:
                          - BTC-USD
                  nonce: 1704067200003
                  account: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                  signer: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                  signature: >-
                    rpkxJezRft2xqfFxaqYRCTRtoobV4Z2Btqj6P52bEcAKczLn5Rgf2Yfm37UN4HGJwywR4QkuDjJUkwZ93DB2Fw9
              stopOrder:
                summary: Stop Conditional Order
                value:
                  actions:
                    - st:
                        c: BTC-USD
                        d: false
                        sz: 0.25
                        tr: 98000
                        lim: 97950
                        i: false
                  nonce: 1704067200011
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              takeProfitOrder:
                summary: Take-Profit Conditional Order
                value:
                  actions:
                    - tp:
                        c: BTC-USD
                        d: true
                        sz: 0.25
                        tr: 104000
                        lim: 103950
                        i: false
                  nonce: 1704067200012
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              rangeOrder:
                summary: Range / OCO Conditional Order
                value:
                  actions:
                    - rng:
                        c: BTC-USD
                        d: true
                        sz: 0.5
                        pmin: 96000
                        pmax: 106000
                        lmin: 95950
                        lmax: 105950
                        i: false
                  nonce: 1704067200013
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              triggerBasket:
                summary: Trigger Basket Order
                value:
                  actions:
                    - trig:
                        c: BTC-USD
                        d: true
                        tr: 105000
                        actions:
                          - m:
                              c: BTC-USD
                              b: true
                              sz: 0.1
                              r: false
                              i: false
                          - cx:
                              c: BTC-USD
                              oid: old_order_hash_base58
                        i: false
                  nonce: 1704067200014
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              faucet:
                summary: Request Faucet Funds
                value:
                  actions:
                    - faucet:
                        u: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  nonce: 1704067200004
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: >-
                    rpkxJezRft2xqfFxaqYRCTRtoobV4Z2Btqj6P52bEcAKczLn5Rgf2Yfm37UN4HGJwywR4QkuDjJUkwZ93DB2Fw9
              agentWallet:
                summary: Register Agent Wallet
                value:
                  actions:
                    - agentWalletCreation:
                        a: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                        d: false
                  nonce: 1704067200005
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: >-
                    5JX7N4f2r2qsLheHyvCpwzs4iXQjLPp1UZH1Ec4a7B4wJQi8Np4ncn3tDrEVW9BLjLVWm2nqFaGgk9T3o4WdTgpx
              updateSettings:
                summary: Update Leverage Settings
                value:
                  actions:
                    - updateUserSettings:
                        m:
                          BTC-USD: 5
                          ETH-USD: 3
                  nonce: 1704067200006
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: >-
                    5JXWgp1fW6px2Gjhw6YHhQ4wEqb6FqMam6m4yg4uRcCksH9WxSv9dVjizGfD4StGtv1z9gR71unZY6tQ6dNDdJ3K
              batch:
                summary: Batch (Cancel + Place)
                value:
                  actions:
                    - cx:
                        c: BTC-USD
                        oid: old_order_hash_base58
                    - l:
                        c: BTC-USD
                        b: true
                        px: 100000
                        sz: 0.1
                        tif: GTC
                        r: false
                  nonce: 1704067200007
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              whitelistFaucet:
                summary: Whitelist Faucet (Admin)
                value:
                  actions:
                    - whitelistFaucet:
                        target: 9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt
                        whitelist: true
                  nonce: 1704067200009
                  account: ADMIN_PUBKEY_BASE58
                  signer: ADMIN_PUBKEY_BASE58
                  signature: 5j7s...base58...
              oraclePrice:
                summary: Oracle Price Update (Admin)
                value:
                  actions:
                    - px:
                        t: 1704067200000000000
                        c: BTC-USD
                        px: 102500
                  nonce: 1704067200010
                  account: ORACLE_PUBKEY_BASE58
                  signer: ORACLE_PUBKEY_BASE58
                  signature: 5j7s...base58...
              createSubAccountMinimal:
                summary: Create Sub-Account (no initial margin)
                value:
                  actions:
                    - createSubAccount:
                        name: desk-1
                  nonce: 1704067200019
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              createSubAccount:
                summary: Create Sub-Account (with initial margin)
                value:
                  actions:
                    - createSubAccount:
                        name: desk-1
                        marginSymbol: USDC
                        marginAmount: 1000
                  nonce: 1704067200020
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              removeSubAccount:
                summary: Remove Sub-Account
                value:
                  actions:
                    - removeSubAccount:
                        toRemove: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                  nonce: 1704067200021
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              renameSubAccount:
                summary: Rename Sub-Account
                value:
                  actions:
                    - renameSubAccount:
                        a: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                        'n': desk-2
                  nonce: 1704067200022
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              transferInternal:
                summary: Transfer (internal, master to sub-account)
                value:
                  actions:
                    - transfer:
                        k: internal
                        from: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                        to: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                        marginSymbol: USDC
                        marginAmount: 100
                  nonce: 1704067200022
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              transferIsoTopUp:
                summary: >-
                  Transfer (top up a per-instrument isolated account via
                  isoPubkey)
                value:
                  actions:
                    - transfer:
                        k: internal
                        from: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                        to: ISO_ACCOUNT_PUBKEY_BASE58
                        marginSymbol: USDC
                        marginAmount: 100
                  nonce: 1704067200023
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              transferExternal:
                summary: Transfer (external, to any account on the network)
                value:
                  actions:
                    - transfer:
                        k: external
                        from: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                        to: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                        marginSymbol: USDC
                        marginAmount: 50
                  nonce: 1704067200024
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              createMultisig:
                summary: Create Multisig
                value:
                  actions:
                    - createMultisig:
                        signers:
                          - FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                          - 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                        threshold: 2
                        timeLockSecs: 60
                        proposalLifetimeSecs: 604800
                  nonce: 1704067200025
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              multisigPropose:
                summary: Multisig Propose (transfer)
                value:
                  actions:
                    - msp:
                        m: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                        a:
                          - transfer:
                              k: internal
                              from: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                              to: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                              marginSymbol: USDC
                              marginAmount: 10
                  nonce: 1704067200026
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              multisigApprove:
                summary: Multisig Approve
                value:
                  actions:
                    - msa:
                        m: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                        p: 7
                  nonce: 1704067200027
                  account: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                  signer: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                  signature: 5j7s...base58...
              multisigExecute:
                summary: Multisig Execute (after time-lock)
                value:
                  actions:
                    - mse:
                        m: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                        p: 7
                  nonce: 1704067200028
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
              multisigUpdatePolicy:
                summary: Multisig Update Policy (proposal-only)
                value:
                  actions:
                    - msu:
                        m: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                        signers:
                          - FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                          - 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                        threshold: 2
                        timeLockSecs: 30
                        proposalLifetimeSecs: 604800
                  nonce: 1704067200029
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...base58...
      responses:
        '200':
          description: >
            Transaction response.


            Note: authentication failures are returned as HTTP 200 with

            `status: "error"` and `statuses: [{"error":{"message":"bad
            signature"}}]`

            or `statuses: [{"error":{"message":"unauthorized signer"}}]`.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderResponse'
              examples:
                accepted:
                  summary: Accepted transaction (resting order)
                  value:
                    status: ok
                    response:
                      type: order
                      data:
                        statuses:
                          - resting:
                              oid: Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F
                authBadSignature:
                  summary: Authentication reject - bad signature
                  value:
                    status: error
                    response:
                      type: order
                      data:
                        statuses:
                          - error:
                              message: bad signature
                authUnauthorizedSigner:
                  summary: Authentication reject - unauthorized signer
                  value:
                    status: error
                    response:
                      type: order
                      data:
                        statuses:
                          - error:
                              message: unauthorized signer
        '408':
          $ref: '#/components/responses/Timeout'
        '500':
          $ref: '#/components/responses/ServerError'
components:
  schemas:
    Transaction:
      type: object
      description: >
        Unified signed transaction. All state-mutating operations use this
        model.


        The `actions` array can contain any combination of action types,
        executed atomically.


        **Must be signed** - see [Transaction Signing](/api-reference/signing)
        for signing details.
      required:
        - actions
        - nonce
        - account
        - signer
        - signature
      properties:
        actions:
          type: array
          description: >
            Array of actions to execute atomically. Each action is a tagged
            object where the key is the compact action tag.


            Action types: `l`, `m`, `mod`, `cx`, `cxa`, `st`, `tp`, `rng`,
            `trig`, `trl`, `of`, `faucet`, `agentWalletCreation`,
            `updateUserSettings`, `createSubAccount`, `removeSubAccount`,
            `renameSubAccount`, `transfer`, `createMultisig`, `msp`, `msa`,
            `msr`, `msc`, `mse`, `msu`, `whitelistFaucet` (admin), `px` (admin),
            `o` (admin)
          items:
            $ref: '#/components/schemas/Action'
        nonce:
          type: integer
          format: int64
          description: >-
            Unique nonce for replay protection (use timestamp in nanoseconds or
            incrementing counter)
        account:
          type: string
          description: >
            Account public key (base58) whose account is being acted on. Must be
            a master pubkey or a sub-account pubkey. Per-instrument isolated
            accounts are managed implicitly via the `i` flag on order actions
            and are never set as `account`.
          example: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
        signer:
          type: string
          description: >
            Signer public key (base58); who is signing. One of:

            - the `account` itself;

            - when `account` is a sub-account: the parent master, or an [agent
            wallet](/api-reference/manageAgentWallet) registered on the parent
            master (automatically authorized for its sub-accounts);

            - an agent wallet registered directly on `account`.
          example: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
        signature:
          type: string
          description: >-
            Ed25519 signature of wincode_serialize(actions + nonce + account)
            (base58)
          example: 5j7sVt3k2YxPqH4w...
    OrderResponse:
      type: object
      required:
        - status
        - response
      description: >
        Transaction accepted. One status per execution event in
        `response.data.statuses`.


        Response from `POST /order`. One entry in `response.data.statuses` per
        execution

        event (e.g. one per order placed, or one for faucet/agent/settings).

        Status variants: resting, working, filled, partiallyFilled, cancelled,
        cancelledRiskLimit,

        cancelledSelfCrossing, cancelledReduceOnly, cancelledIoc,

        rejectedCrossing, rejectedDuplicate, rejectedRiskLimit, rejectedInvalid,
        deposit, depositFailed, agentWallet, agentWalletFailed,

        cancelOneRejected, cancelAllRejected, triggered, siblingCancelled,
        triggerFailed,

        transfer, transferFailed, createSubAccount, createSubAccountFailed,

        removeSubAccount, removeSubAccountFailed,

        renameSubAccount, renameSubAccountFailed,

        multisigCreated, multisigCreatedFailed, proposalCreated,
        proposalApproved,

        proposalReadyForExecution, proposalExecuted, proposalFailed,
        proposalExpired,

        proposalCancelled, proposalRejected, error.
      properties:
        status:
          type: string
          enum:
            - ok
            - error
          description: >-
            Top-level status (ok when request was accepted; check each item in
            statuses for per-action result)
        response:
          type: object
          required:
            - type
            - data
          properties:
            type:
              type: string
              description: Always "order"
            data:
              type: object
              required:
                - statuses
              properties:
                statuses:
                  type: array
                  description: One status object per execution event
                  items:
                    oneOf:
                      - title: resting
                        type: object
                        description: Order placed and resting on book (non-terminal)
                        properties:
                          resting:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                      - title: working
                        type: object
                        description: Order resting with partial fills (non-terminal)
                        properties:
                          working:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                              filledSz:
                                type: number
                                description: >-
                                  Filled size so far (signed; negative for
                                  sell-side)
                              remainingSz:
                                type: number
                                description: >-
                                  Remaining size (signed; negative for
                                  sell-side)
                              vwap:
                                type: number
                                description: Volume-weighted average price
                      - title: filled
                        type: object
                        description: Order fully filled (terminal)
                        properties:
                          filled:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                              totalSz:
                                type: number
                                description: >-
                                  Total filled size (signed; negative for
                                  sell-side)
                              avgPx:
                                type: number
                                description: Average fill price (VWAP)
                      - title: partiallyFilled
                        type: object
                        description: Order partially filled and terminal
                        properties:
                          partiallyFilled:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                              totalSz:
                                type: number
                                description: >-
                                  Total filled size (signed; negative for
                                  sell-side)
                              avgPx:
                                type: number
                                description: Average fill price (VWAP)
                      - title: cancelled
                        type: object
                        description: Order cancelled by user
                        properties:
                          cancelled:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                      - title: cancelledRiskLimit
                        type: object
                        description: Cancelled due to risk limit violation
                        properties:
                          cancelledRiskLimit:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                              reason:
                                type: string
                                nullable: true
                      - title: cancelledSelfCrossing
                        type: object
                        description: Cancelled due to self-crossing (STP)
                        properties:
                          cancelledSelfCrossing:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                      - title: cancelledReduceOnly
                        type: object
                        description: Cancelled - would not reduce position
                        properties:
                          cancelledReduceOnly:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                      - title: cancelledIoc
                        type: object
                        description: IOC expired without full fill
                        properties:
                          cancelledIoc:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                              filledSz:
                                type: number
                                description: >-
                                  Size filled before expiry (signed; negative
                                  for sell-side)
                      - title: rejectedCrossing
                        type: object
                        description: Post-only rejected for crossing
                        properties:
                          rejectedCrossing:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                      - title: rejectedDuplicate
                        type: object
                        description: Duplicate order ID
                        properties:
                          rejectedDuplicate:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                      - title: rejectedRiskLimit
                        type: object
                        description: Rejected due to risk limit on submission
                        properties:
                          rejectedRiskLimit:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                              reason:
                                type: string
                                nullable: true
                      - title: rejectedInvalid
                        type: object
                        description: Invalid order parameters
                        properties:
                          rejectedInvalid:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                              reason:
                                type: string
                                nullable: true
                      - title: deposit
                        type: object
                        description: Faucet deposit succeeded
                        properties:
                          deposit:
                            type: object
                            properties:
                              amount:
                                type: number
                      - title: depositFailed
                        type: object
                        description: Faucet deposit failed
                        properties:
                          depositFailed:
                            type: object
                            properties:
                              message:
                                type: string
                      - title: agentWallet
                        type: object
                        description: Agent wallet registered
                        properties:
                          agentWallet:
                            type: object
                            properties:
                              agentWallet:
                                type: string
                      - title: agentWalletFailed
                        type: object
                        description: Agent wallet operation failed
                        properties:
                          agentWalletFailed:
                            type: object
                            properties:
                              message:
                                type: string
                      - title: cancelOneRejected
                        type: object
                        description: Single cancel rejected
                        properties:
                          cancelOneRejected:
                            type: object
                            properties:
                              oid:
                                type: string
                              reason:
                                type: string
                      - title: cancelAllRejected
                        type: object
                        description: Cancel-all rejected
                        properties:
                          cancelAllRejected:
                            type: object
                            properties:
                              reason:
                                type: string
                      - title: triggered
                        type: object
                        description: Conditional root fired (non-terminal)
                        properties:
                          triggered:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                      - title: siblingCancelled
                        type: object
                        description: OCO sibling auto-cancelled
                        properties:
                          siblingCancelled:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                      - title: triggerFailed
                        type: object
                        description: Trigger execution failed
                        properties:
                          triggerFailed:
                            type: object
                            properties:
                              oid:
                                type: string
                                description: Order ID (base58)
                              reason:
                                type: string
                                nullable: true
                      - title: transfer
                        type: object
                        description: Margin transfer succeeded
                        properties:
                          transfer:
                            type: object
                            properties:
                              from:
                                type: string
                                description: Source account pubkey (base58)
                              to:
                                type: string
                                description: Destination account pubkey (base58)
                              symbol:
                                type: string
                                description: Margin asset symbol
                              amount:
                                type: number
                      - title: transferFailed
                        type: object
                        description: Margin transfer failed
                        properties:
                          transferFailed:
                            type: object
                            properties:
                              message:
                                type: string
                      - title: createSubAccount
                        type: object
                        description: Sub-account creation succeeded
                        properties:
                          createSubAccount:
                            type: object
                            properties:
                              master:
                                type: string
                                description: Owning master account pubkey (base58)
                              sub:
                                type: string
                                description: Newly created sub-account pubkey (base58)
                              name:
                                type: string
                                description: Display name
                              margin:
                                type: number
                                description: >-
                                  Initial margin transferred from master at
                                  creation (0 when none requested)
                      - title: createSubAccountFailed
                        type: object
                        description: Sub-account creation failed
                        properties:
                          createSubAccountFailed:
                            type: object
                            properties:
                              message:
                                type: string
                      - title: removeSubAccount
                        type: object
                        description: >-
                          Sub-account removal succeeded; remaining margin is
                          swept back to master
                        properties:
                          removeSubAccount:
                            type: object
                            properties:
                              account:
                                type: string
                                description: Removed sub-account pubkey (base58)
                              marginMoved:
                                type: number
                                description: Margin amount returned to the master account
                      - title: removeSubAccountFailed
                        type: object
                        description: Sub-account removal failed
                        properties:
                          removeSubAccountFailed:
                            type: object
                            properties:
                              message:
                                type: string
                      - title: renameSubAccount
                        type: object
                        description: Sub-account rename succeeded
                        properties:
                          renameSubAccount:
                            type: object
                            properties:
                              master:
                                type: string
                                description: Owning master account pubkey (base58)
                              account:
                                type: string
                                description: Sub-account pubkey that was renamed (base58)
                              name:
                                type: string
                                description: New display name
                      - title: renameSubAccountFailed
                        type: object
                        description: Sub-account rename failed
                        properties:
                          renameSubAccountFailed:
                            type: object
                            properties:
                              message:
                                type: string
                      - title: multisigCreated
                        type: object
                        description: Multisig account created
                        properties:
                          multisigCreated:
                            type: object
                            properties:
                              pubkey:
                                type: string
                                description: New multisig account pubkey (base58)
                              threshold:
                                type: integer
                                format: uint32
                              signersLen:
                                type: integer
                                format: uint32
                              timeLockSecs:
                                type: integer
                                format: uint32
                              lifetimeSecs:
                                type: integer
                                format: uint32
                              creator:
                                type: string
                      - title: multisigCreatedFailed
                        type: object
                        description: Multisig creation failed
                        properties:
                          multisigCreatedFailed:
                            type: object
                            properties:
                              message:
                                type: string
                      - title: proposalCreated
                        type: object
                        description: Multisig proposal created (non-terminal)
                        properties:
                          proposalCreated:
                            $ref: '#/components/schemas/MultisigProposalEvent'
                      - title: proposalApproved
                        type: object
                        description: Multisig proposal approved (non-terminal)
                        properties:
                          proposalApproved:
                            $ref: '#/components/schemas/MultisigProposalEvent'
                      - title: proposalReadyForExecution
                        type: object
                        description: >-
                          Multisig proposal reached threshold and is awaiting
                          time-lock (non-terminal)
                        properties:
                          proposalReadyForExecution:
                            $ref: '#/components/schemas/MultisigProposalEvent'
                      - title: proposalExecuted
                        type: object
                        description: Multisig proposal executed atomically (terminal)
                        properties:
                          proposalExecuted:
                            $ref: '#/components/schemas/MultisigProposalEvent'
                      - title: proposalFailed
                        type: object
                        description: >-
                          Multisig proposal execution failed and was rolled back
                          (terminal)
                        properties:
                          proposalFailed:
                            allOf:
                              - $ref: '#/components/schemas/MultisigProposalEvent'
                              - type: object
                                properties:
                                  message:
                                    type: string
                      - title: proposalExpired
                        type: object
                        description: Multisig proposal expired before execution (terminal)
                        properties:
                          proposalExpired:
                            $ref: '#/components/schemas/MultisigProposalEvent'
                      - title: proposalCancelled
                        type: object
                        description: Multisig proposal cancelled by proposer (terminal)
                        properties:
                          proposalCancelled:
                            $ref: '#/components/schemas/MultisigProposalEvent'
                      - title: proposalRejected
                        type: object
                        description: >-
                          Multisig proposal rejected: threshold can no longer be
                          met (terminal)
                        properties:
                          proposalRejected:
                            $ref: '#/components/schemas/MultisigProposalEvent'
                      - title: error
                        type: object
                        description: Generic error
                        properties:
                          error:
                            type: object
                            properties:
                              message:
                                type: string
    Action:
      description: >
        Tagged action object. Each action type is an externally tagged enum
        using compact action tags.
      oneOf:
        - title: Limit order (l)
          type: object
          description: Place a resting limit order
          required:
            - l
          properties:
            l:
              type: object
              required:
                - c
                - b
                - px
                - sz
                - tif
                - r
                - i
              properties:
                c:
                  type: string
                  description: Symbol
                  example: BTC-USD
                b:
                  type: boolean
                  description: true = buy, false = sell
                px:
                  type: number
                  description: Limit price
                  example: 100000
                sz:
                  type: number
                  description: Size / quantity
                  example: 0.1
                tif:
                  type: string
                  enum:
                    - GTC
                    - IOC
                    - ALO
                  description: >-
                    Time in force (GTC = rests on book, IOC = immediate or
                    cancel, ALO = post-only)
                r:
                  type: boolean
                  description: Reduce only
                i:
                  type: boolean
                  description: >
                    Required. `true` routes the order into the per-instrument
                    isolated account under the signing account; `false` keeps
                    base-account routing.

                    Must be present in the JSON; the field is part of the
                    canonical wincode binary message and omitting it produces a
                    `bad signature`.
        - title: Market order (m)
          type: object
          description: Execute at market price immediately
          required:
            - m
          properties:
            m:
              type: object
              required:
                - c
                - b
                - sz
                - r
                - i
              properties:
                c:
                  type: string
                  description: Symbol
                  example: BTC-USD
                b:
                  type: boolean
                  description: true = buy, false = sell
                sz:
                  type: number
                  description: Size / quantity
                  example: 0.1
                r:
                  type: boolean
                  description: Reduce only
                i:
                  type: boolean
                  description: >
                    Required. `true` routes the order into the per-instrument
                    isolated account under the signing account; `false` keeps
                    base-account routing.

                    Must be present in the JSON; the field is part of the
                    canonical wincode binary message and omitting it produces a
                    `bad signature`.
        - title: Modify order (mod)
          type: object
          description: Modify the size of an existing resting order
          required:
            - mod
          properties:
            mod:
              type: object
              required:
                - oid
                - symbol
                - amount
              properties:
                oid:
                  type: string
                  description: Order ID (base58 hash)
                  example: Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F
                symbol:
                  type: string
                  description: Symbol
                  example: BTC-USD
                amount:
                  type: number
                  description: New order size
                  example: 0.05
        - title: Cancel order (cx)
          type: object
          description: Cancel a specific order by ID
          required:
            - cx
          properties:
            cx:
              type: object
              required:
                - c
                - oid
              properties:
                c:
                  type: string
                  description: Symbol
                  example: BTC-USD
                oid:
                  type: string
                  description: Order ID (base58 hash)
                  example: Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F
        - title: Cancel all (cxa)
          type: object
          description: Cancel all orders (optionally filtered by symbol)
          required:
            - cxa
          properties:
            cxa:
              type: object
              required:
                - c
              properties:
                c:
                  type: array
                  description: Symbols to cancel. Empty array `[]` cancels all symbols.
                  items:
                    type: string
                  example:
                    - BTC-USD
        - title: Stop (st)
          type: object
          description: Place a conditional stop order
          required:
            - st
          properties:
            st:
              type: object
              required:
                - c
                - d
                - sz
                - tr
                - i
              properties:
                c:
                  type: string
                  description: Symbol
                  example: BTC-USD
                d:
                  type: boolean
                  description: >-
                    Trigger direction (`true` = trigger above/equal threshold,
                    `false` = below/equal)
                sz:
                  type: number
                  description: Size to execute on trigger
                  example: 0.25
                tr:
                  type: number
                  description: Trigger threshold
                  example: 98000
                lim:
                  type: number
                  nullable: true
                  description: >-
                    Optional triggered limit price. Omit for market-style
                    trigger
                  example: 97950
                i:
                  type: boolean
                  description: >
                    Required. `true` routes the triggered order into the
                    per-instrument isolated account under the signing account;
                    `false` keeps base-account routing.

                    Must be present in the JSON; the field is part of the
                    canonical wincode binary message and omitting it produces a
                    `bad signature`.
        - title: Take profit (tp)
          type: object
          description: Place a conditional take-profit order
          required:
            - tp
          properties:
            tp:
              type: object
              required:
                - c
                - d
                - sz
                - tr
                - i
              properties:
                c:
                  type: string
                  description: Symbol
                  example: BTC-USD
                d:
                  type: boolean
                  description: >-
                    Trigger direction (`true` = trigger above/equal threshold,
                    `false` = below/equal)
                sz:
                  type: number
                  description: Size to execute on trigger
                  example: 0.25
                tr:
                  type: number
                  description: Trigger threshold
                  example: 104000
                lim:
                  type: number
                  nullable: true
                  description: >-
                    Optional triggered limit price. Omit for market-style
                    trigger
                  example: 103950
                i:
                  type: boolean
                  description: >
                    Required. `true` routes the triggered order into the
                    per-instrument isolated account under the signing account;
                    `false` keeps base-account routing.

                    Must be present in the JSON; the field is part of the
                    canonical wincode binary message and omitting it produces a
                    `bad signature`.
        - title: Range / OCO (rng)
          type: object
          description: Place a range collar (OCO) conditional order
          required:
            - rng
          properties:
            rng:
              type: object
              required:
                - c
                - d
                - sz
                - pmin
                - pmax
                - i
              properties:
                c:
                  type: string
                  description: Symbol
                  example: BTC-USD
                d:
                  type: boolean
                  description: >-
                    Position direction (`true` = buy/long collar, `false` =
                    sell/short collar)
                sz:
                  type: number
                  description: Size to protect/exit
                  example: 0.5
                pmin:
                  type: number
                  description: Lower trigger threshold
                  example: 96000
                pmax:
                  type: number
                  description: Upper trigger threshold
                  example: 106000
                lmin:
                  type: number
                  nullable: true
                  description: Optional limit for the lower-trigger leg
                  example: 95950
                lmax:
                  type: number
                  nullable: true
                  description: Optional limit for the upper-trigger leg
                  example: 105950
                i:
                  type: boolean
                  description: >
                    Required. `true` routes the triggered legs into the
                    per-instrument isolated account under the signing account;
                    `false` keeps base-account routing.

                    Must be present in the JSON; the field is part of the
                    canonical wincode binary message and omitting it produces a
                    `bad signature`.
        - title: Trigger basket (trig)
          type: object
          description: >-
            Place a trigger basket order that executes nested actions when
            threshold is crossed
          required:
            - trig
          properties:
            trig:
              type: object
              required:
                - c
                - d
                - tr
                - actions
                - i
              properties:
                c:
                  type: string
                  description: Symbol
                  example: BTC-USD
                d:
                  type: boolean
                  description: >-
                    Trigger direction (`true` = trigger above/equal threshold,
                    `false` = below/equal)
                tr:
                  type: number
                  description: Trigger threshold
                  example: 105000
                actions:
                  type: array
                  description: >
                    Nested actions executed when trigger fires.

                    Allowed today: `m`, `l`, `mod`, `cx`, `cxa`, `st`, `tp`,
                    `rng`, `trl`.
                  items:
                    type: object
                    description: >-
                      Nested action object using the same compact action tags as
                      top-level actions
                i:
                  type: boolean
                  description: >
                    Required. `true` routes trigger execution into the
                    per-instrument isolated account under the signing account;
                    `false` keeps base-account routing.

                    Must be present in the JSON; the field is part of the
                    canonical wincode binary message and omitting it produces a
                    `bad signature`.
        - title: Trailing stop (trl)
          type: object
          description: Place a trailing-stop conditional root
          required:
            - trl
          properties:
            trl:
              type: object
              required:
                - c
                - b
                - sz
                - trb
                - stb
                - i
              properties:
                c:
                  type: string
                  description: Symbol
                  example: BTC-USD
                b:
                  type: boolean
                  description: >-
                    Protected position direction (`true` = long protection,
                    `false` = short protection)
                sz:
                  type: number
                  description: Size to protect/exit
                  example: 0.25
                trb:
                  type: integer
                  format: int32
                  description: Trailing distance in bps
                  example: 100
                stb:
                  type: integer
                  format: int32
                  description: Favorable reset step in bps
                  example: 10
                lim:
                  type: number
                  nullable: true
                  description: >-
                    Optional triggered limit price. Omit for market-style
                    trigger
                  example: null
                i:
                  type: boolean
                  description: >
                    Required. `true` routes trailing execution into the
                    per-instrument isolated account under the signing account;
                    `false` keeps base-account routing.

                    Must be present in the JSON; the field is part of the
                    canonical wincode binary message and omitting it produces a
                    `bad signature`.
        - title: On-fill (of)
          type: object
          description: >-
            Register one-shot consequents to fire on the first fill of a parent
            action in the same transaction
          required:
            - of
          properties:
            of:
              type: object
              required:
                - p
                - actions
              properties:
                p:
                  type: integer
                  format: int32
                  minimum: 0
                  description: >-
                    Parent action seqno in the same transaction. In normal
                    processing this seqno is assigned from action position
                    (0..n-1), so it is usually the parent action index.
                  example: 0
                actions:
                  type: array
                  description: >
                    One-shot consequents executed on first fill of the parent.

                    Allowed today: `m`, `l`, `mod`, `cx`, `cxa`, `st`, `tp`,
                    `rng`, `trig`, `trl`.

                    Parent candidates for `of` are `m`, `l`, `st`, `tp`, `rng`,
                    `trl` (`trig` is not a parent candidate).
                  items:
                    type: object
                    description: >-
                      Nested action object using the same compact action tags as
                      top-level actions
        - title: Faucet (faucet)
          type: object
          description: >-
            Request testnet faucet funds (fixed 10,000 per claim; once per 24
            hours per account)
          required:
            - faucet
          properties:
            faucet:
              type: object
              required:
                - u
              properties:
                u:
                  type: string
                  description: Recipient public key (base58)
                  example: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                amount:
                  type: number
                  description: >-
                    Optional; ignored for testnet. Each claim credits a fixed
                    10,000.
                  nullable: true
        - title: Agent wallet (agentWalletCreation)
          type: object
          description: Register or remove an agent wallet
          required:
            - agentWalletCreation
          properties:
            agentWalletCreation:
              type: object
              required:
                - a
                - d
              properties:
                a:
                  type: string
                  description: Agent public key (base58)
                d:
                  type: boolean
                  description: true = remove agent, false = add agent
        - title: Update user settings (updateUserSettings)
          type: object
          description: Update per-symbol leverage settings
          required:
            - updateUserSettings
          properties:
            updateUserSettings:
              type: object
              required:
                - m
              properties:
                m:
                  type: object
                  description: Map of symbol to max leverage (1.0–50.0)
                  additionalProperties:
                    type: number
                  example:
                    BTC-USD: 5
                    ETH-USD: 3
        - title: Whitelist faucet (admin)
          type: object
          description: Whitelist or un-whitelist an account for faucet access (admin)
          required:
            - whitelistFaucet
          properties:
            whitelistFaucet:
              type: object
              required:
                - target
                - whitelist
              properties:
                target:
                  type: string
                  description: Target account public key (base58)
                  example: 9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt
                whitelist:
                  type: boolean
                  description: true = whitelist, false = un-whitelist
        - title: Oracle price (px, admin)
          type: object
          description: Submit a price action update (admin/oracle feeder)
          required:
            - px
          properties:
            px:
              type: object
              required:
                - t
                - c
                - px
              properties:
                t:
                  type: integer
                  format: int64
                  description: Timestamp (nanoseconds)
                c:
                  type: string
                  description: Asset symbol
                  example: BTC-USD
                px:
                  type: number
                  description: Oracle price
                  example: 102500
        - title: Pyth oracle batch (o, admin)
          type: object
          description: Batch Pyth oracle price updates (admin/oracle feeder)
          required:
            - o
          properties:
            o:
              type: object
              required:
                - oracles
              properties:
                oracles:
                  type: array
                  description: Array of Pyth price updates
                  items:
                    type: object
                    required:
                      - t
                      - fi
                      - px
                      - e
                    properties:
                      t:
                        type: integer
                        format: int64
                        description: Timestamp (nanoseconds)
                      fi:
                        type: integer
                        format: int64
                        description: Pyth feed ID
                      px:
                        type: integer
                        format: int64
                        description: Price (raw integer, apply exponent)
                      e:
                        type: integer
                        format: int16
                        description: Price exponent (e.g., -8 means price * 10^-8)
        - title: Create sub-account (createSubAccount)
          type: object
          description: >
            Create a named sub-account under the signing master account.
            Sub-accounts hold

            their own margin, positions, and orders evaluated independently by
            the risk engine.

            See [Sub-Accounts (Signed)](/api-reference/manageSubAccounts).
          required:
            - createSubAccount
          properties:
            createSubAccount:
              type: object
              required:
                - name
              properties:
                name:
                  type: string
                  description: Sub-account display name (1-32 chars, `A-Z a-z 0-9 - _`)
                  example: desk-1
                marginSymbol:
                  type: string
                  nullable: true
                  description: >-
                    Optional margin asset symbol to seed the sub-account with.
                    Must be present when `marginAmount` is non-zero.
                  example: USDC
                marginAmount:
                  type: number
                  nullable: true
                  description: >-
                    Optional initial margin amount transferred from master at
                    creation time. Default `0.0`. Must be a JSON number
                    (unquoted), e.g. `0` or `1000.0`, not `"0"` or `"1000.0"`.
                  example: 1000
        - title: Remove sub-account (removeSubAccount)
          type: object
          description: >
            Remove a flat sub-account and sweep any remaining margin back to the
            parent. Also used to remove an auto-created per-instrument [isolated
            account](/bulk-exchange/isolated-margin) by passing its `isoPubkey`
            as `toRemove` (margin is swept back to the master/sub-account that
            owns it).

            The target must have no open positions and no open orders.
          required:
            - removeSubAccount
          properties:
            removeSubAccount:
              type: object
              required:
                - toRemove
              properties:
                toRemove:
                  type: string
                  description: >-
                    Sub-account or isolated-account public key (base58) to
                    remove
                  example: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
        - title: Rename sub-account (renameSubAccount)
          type: object
          description: >
            Rename an existing sub-account owned by the signing master. The
            pubkey is unchanged,

            so cached references and isolated-account links keep working.

            See [Sub-Accounts (Signed)](/api-reference/manageSubAccounts).
          required:
            - renameSubAccount
          properties:
            renameSubAccount:
              type: object
              required:
                - a
                - 'n'
              properties:
                a:
                  type: string
                  description: >-
                    Sub-account public key (base58) to rename. Must belong to
                    the signing master.
                  example: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                'n':
                  type: string
                  description: >-
                    New display name (1-32 chars, `A-Z a-z 0-9 - _`). Must be
                    unique within the master tree.
                  example: desk-2
        - title: Transfer (transfer)
          type: object
          description: >
            Transfer margin between accounts (`internal` between master and its
            sub-accounts / per-instrument isolated accounts,

            `external` to any account on the network). Use `internal` with `to =
            isoPubkey`

            to top up a per-instrument isolated account. See [Transfer
            (Signed)](/api-reference/transfer).
          required:
            - transfer
          properties:
            transfer:
              type: object
              required:
                - from
                - to
                - marginSymbol
                - marginAmount
              properties:
                k:
                  type: string
                  enum:
                    - internal
                    - external
                  description: Transfer kind. Defaults to `internal`.
                  default: internal
                from:
                  type: string
                  description: Source account public key (base58)
                  example: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                to:
                  type: string
                  description: >-
                    Destination account public key (base58). Use the position
                    row's `isoPubkey` to top up a per-instrument isolated
                    account.
                  example: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                marginSymbol:
                  type: string
                  description: Margin asset symbol
                  example: USDC
                marginAmount:
                  type: number
                  description: >-
                    Margin amount to transfer. Must be a JSON number (unquoted),
                    e.g. `100.0` not `"100.0"`.
                  example: 100
        - title: Create multisig (createMultisig)
          type: object
          description: >
            Create a protocol-native multisig smart account with M-of-N
            threshold,

            time-lock, and proposal lifetime policy. See [Multisig
            (Signed)](/api-reference/manageMultisig).
          required:
            - createMultisig
          properties:
            createMultisig:
              type: object
              required:
                - signers
                - threshold
                - timeLockSecs
                - proposalLifetimeSecs
              properties:
                signers:
                  type: array
                  description: >-
                    Authorized signer pubkeys (1-32, no duplicates). Base58
                    preferred; raw `[u8;32]` arrays also accepted for
                    compatibility.
                  items:
                    type: string
                  example:
                    - FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                    - 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                threshold:
                  type: integer
                  format: uint32
                  description: >-
                    Required approvals to execute (1 ≤ threshold ≤
                    signers.length)
                  example: 2
                timeLockSecs:
                  type: integer
                  format: uint32
                  description: >-
                    Mandatory delay between threshold-reached and execution, in
                    seconds (0–30 days)
                  example: 60
                proposalLifetimeSecs:
                  type: integer
                  format: uint32
                  description: Proposal lifetime in seconds (1 hour to 90 days)
                  example: 604800
        - title: Multisig propose (msp)
          type: object
          description: >-
            Submit a new proposal containing one or more inner actions. The
            proposer's signature counts as the first approval.
          required:
            - msp
          properties:
            msp:
              type: object
              required:
                - m
                - a
              properties:
                m:
                  type: string
                  description: Multisig account pubkey (base58)
                  example: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                a:
                  type: array
                  description: Inner actions to execute when the proposal is approved
                  items:
                    type: object
                    description: >-
                      Nested action object (same compact tags as top-level
                      actions)
        - title: Multisig approve (msa)
          type: object
          description: Approve an open proposal as a signer of the multisig.
          required:
            - msa
          properties:
            msa:
              type: object
              required:
                - m
                - p
              properties:
                m:
                  type: string
                  description: Multisig account pubkey (base58)
                p:
                  type: integer
                  format: uint64
                  description: Proposal ID
                  example: 7
        - title: Multisig reject (msr)
          type: object
          description: >-
            Reject an open proposal. Reaches terminal `rejected` once enough
            rejections accumulate that the threshold can no longer be met.
          required:
            - msr
          properties:
            msr:
              type: object
              required:
                - m
                - p
              properties:
                m:
                  type: string
                  description: Multisig account pubkey (base58)
                p:
                  type: integer
                  format: uint64
                  description: Proposal ID
        - title: Multisig cancel (msc)
          type: object
          description: Cancel an open proposal you created (proposer-only).
          required:
            - msc
          properties:
            msc:
              type: object
              required:
                - m
                - p
              properties:
                m:
                  type: string
                  description: Multisig account pubkey (base58)
                p:
                  type: integer
                  format: uint64
                  description: Proposal ID
        - title: Multisig execute (mse)
          type: object
          description: >-
            Trigger execution of a `ready` proposal once its time-lock has
            elapsed.
          required:
            - mse
          properties:
            mse:
              type: object
              required:
                - m
                - p
              properties:
                m:
                  type: string
                  description: Multisig account pubkey (base58)
                p:
                  type: integer
                  format: uint64
                  description: Proposal ID
        - title: Multisig update policy (msu)
          type: object
          description: >-
            Update the multisig signer set, threshold, time-lock, or proposal
            lifetime. Policy updates can only happen through the proposal flow.
          required:
            - msu
          properties:
            msu:
              type: object
              required:
                - m
                - signers
                - threshold
                - timeLockSecs
                - proposalLifetimeSecs
              properties:
                m:
                  type: string
                  description: Multisig account pubkey (base58)
                signers:
                  type: array
                  items:
                    type: string
                  description: >-
                    New signer set. Base58 preferred; raw `[u8;32]` arrays also
                    accepted for compatibility.
                threshold:
                  type: integer
                  format: uint32
                  description: New approval threshold
                timeLockSecs:
                  type: integer
                  format: uint32
                  description: New time-lock in seconds
                proposalLifetimeSecs:
                  type: integer
                  format: uint32
                  description: New proposal lifetime in seconds
    MultisigProposalEvent:
      type: object
      description: Snapshot of a multisig proposal at the time of an event
      properties:
        multisig:
          type: string
          description: Multisig account pubkey (base58)
        proposalId:
          type: integer
          format: uint64
        status:
          type: string
          enum:
            - pending
            - ready
            - executed
            - failed
            - expired
            - cancelled
            - rejected
        approvals:
          type: integer
          format: uint32
          description: Approval count
        rejections:
          type: integer
          format: uint32
          description: Rejection count
        threshold:
          type: integer
          format: uint32
        executeAfter:
          type: integer
          format: int64
          description: Earliest execution timestamp (ms) once threshold is met
        expiresAt:
          type: integer
          format: int64
          description: Proposal expiry timestamp (ms)
        signer:
          type: string
          nullable: true
          description: Signer that triggered this event (when applicable)
        proposer:
          type: string
          nullable: true
          description: Original proposer of the proposal
  responses:
    Timeout:
      description: Request Timeout - Executor didn't respond within 2s
    ServerError:
      description: Internal Server Error - Database or channel error

````