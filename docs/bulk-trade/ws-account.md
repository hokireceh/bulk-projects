> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Account Stream

> Real-time account updates including positions, orders, margin, and comprehensive risk metrics. No signature required for subscribing (public data)

## Subscribe

### Single Account

```json theme={null}
{
  "method": "subscribe",
  "subscription": [{
    "type": "account",
    "user": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }]
}
```

### Multiple Accounts (Batched)

Subscribe to multiple accounts in a single request:

```json theme={null}
{
  "method": "subscribe",
  "subscription": [{
    "type": "account",
    "user": [
      "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux",
      "9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt"
    ]
  }]
}
```

### Response

```json theme={null}
{
  "type": "subscriptionResponse",
  "topics": [
    "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
    "account.5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux",
    "account.9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt"
  ]
}
```

**Parameters:**

* `user` (String or Array): User public key(s) in base58 format
  * Single: `"user": "9J8T..."`
  * Multiple: `"user": ["9J8T...", "5Am6...", "ABC..."]`

***

## Initial Snapshot

On subscription, you receive a unified `accountSnapshot` message with complete account state. For master and sub accounts, `positions` and `openOrders` include implicit per-instrument isolated-account rows tagged by `iso=true`:

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "accountSnapshot",
    "kind": "MasterEOA",
    "parent": null,
    "subAccounts": [
      { "pubkey": "8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR" }
    ],
    "multisigAccounts": [
      "6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK"
    ],
    "authorizedAgentWallets": [
      "6pJ8vnrWofWgrn9doYBBRjijV5e6YJ2yN1U2EMRk4cLQ"
    ],
    "margin": {
      "totalBalance": 100000.0,
      "availableBalance": 95000.0,
      "marginUsed": 5000.0,
      "notional": 50000.0,
      "realizedPnl": 1234.5,
      "unrealizedPnl": 567.8,
      "fees": 12.34,
      "funding": 5.67
    },
    "positions": [
      {
        "symbol": "BTC-USD",
        "size": 0.5,
        "price": 100000.0,
        "fairPrice": 101000.0,
        "notional": 50500.0,
        "realizedPnl": 500.0,
        "unrealizedPnl": 500.0,
        "leverage": 5.0,
        "liquidationPrice": 95000.0,
        "fees": 10.0,
        "funding": 2.5,
        "maintenanceMargin": 1000.0,
        "lambda": 0.05,
        "riskAllocation": 5000.0,
        "iso": false,
        "protection": {
          "orders": [
            {
              "orderId": "6v8h8LC7eXv8W2af5nYvXn1Wuk3KdAy8pwkE2fFvR8w4",
              "orderType": "stop",
              "trigger": {
                "px": 98000.0,
                "lim": 97950.0,
                "oco": null
              }
            }
          ]
        }
      },
      {
        "symbol": "ETH-USD",
        "size": 2.0,
        "price": 3500.0,
        "fairPrice": 3505.0,
        "notional": 7010.0,
        "realizedPnl": 0.0,
        "unrealizedPnl": 10.0,
        "leverage": 5.0,
        "liquidationPrice": 3000.0,
        "fees": 1.0,
        "funding": 0.0,
        "maintenanceMargin": 350.0,
        "lambda": 0.04,
        "riskAllocation": 350.0,
        "iso": true,
        "isoPubkey": "C7vR3xC5vR7n6Qx2mY5s9wH1rJ4cE8pV2kB3dL6tP9fU",
        "protection": null
      }
    ],
    "openOrders": [
      {
        "symbol": "BTC-USD",
        "orderId": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
        "price": 102000.0,
        "originalSize": 0.1,
        "size": 0.1,
        "filledSize": 0.0,
        "vwap": 0.0,
        "maker": true,
        "reduceOnly": false,
        "orderType": "limit",
        "trigger": null,
        "tif": "gtc",
        "status": "placed",
        "timestamp": 1763316177219383423,
        "iso": false
      }
    ],
    "feeTiers": [
      {
        "symbol": "global",
        "rollingVolume": 1200000.0,
        "tierIndex": 1,
        "tierThreshold": 1000000.0,
        "makerBps": 1.8,
        "takerBps": 3.3,
        "windowDays": 14
      }
    ],
    "leverageSettings": [
      { "symbol": "BTC-USD", "leverage": 5.0 },
      { "symbol": "ETH-USD", "leverage": 3.0 }
    ]
  },
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```

### Account Snapshot Fields

**Top-level:**

| Field                    | Description                                                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`                   | Account kind: `MasterEOA`, `SubAccount`, `IsoAccount`, or `Multisig`. `POST /account` only resolves master and sub-accounts; isolated and multisig accounts are surfaced as rows under their parent.                              |
| `parent`                 | Parent account pubkey for sub/iso rows (otherwise `null`)                                                                                                                                                                         |
| `name`                   | Sub-account display name (present on snapshots where `kind: "SubAccount"`, i.e. when you subscribed with the sub-account pubkey as `user`). Omitted on master snapshots.                                                          |
| `subAccounts`            | Child sub-accounts as `{pubkey}`. The list under a master contains pubkeys only; subscribe to a sub-account directly (or query it via [`POST /account`](/api-reference/getAccount) with `type: "fullAccount"`) to see its `name`. |
| `multisigAccounts`       | Multisig accounts where this account is the multisig address or a signer member                                                                                                                                                   |
| `authorizedAgentWallets` | Agent wallets directly registered on this account. Agents registered on a master can sign for the master and any of its sub-accounts and isolated accounts; sub-accounts may register their own agents too.                       |

**Margin:**

| Field              | Description                                   |
| ------------------ | --------------------------------------------- |
| `totalBalance`     | Total margin balance                          |
| `availableBalance` | Available margin (total - maintenance margin) |
| `marginUsed`       | Maintenance margin used                       |
| `notional`         | Total notional value of all positions         |
| `realizedPnl`      | Realized profit/loss                          |
| `unrealizedPnl`    | Unrealized profit/loss                        |
| `fees`             | Total fees paid                               |
| `funding`          | Total funding paid/received                   |

**Positions:**

| Field               | Description                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `symbol`            | Market symbol                                                                                                                                                                                                 |
| `size`              | Position size (positive=long, negative=short)                                                                                                                                                                 |
| `price`             | VWAP entry price                                                                                                                                                                                              |
| `fairPrice`         | Current fair/mark price                                                                                                                                                                                       |
| `notional`          | Notional value (size × fair\_price)                                                                                                                                                                           |
| `realizedPnl`       | Realized P\&L for this position                                                                                                                                                                               |
| `unrealizedPnl`     | Unrealized P\&L for this position                                                                                                                                                                             |
| `leverage`          | Position leverage                                                                                                                                                                                             |
| `liquidationPrice`  | Liquidation price                                                                                                                                                                                             |
| `fees`              | Fees paid for this position                                                                                                                                                                                   |
| `funding`           | Funding paid/received                                                                                                                                                                                         |
| `maintenanceMargin` | Required maintenance margin                                                                                                                                                                                   |
| `lambda`            | Lambda (risk parameter)                                                                                                                                                                                       |
| `riskAllocation`    | Risk allocation (C\_i)                                                                                                                                                                                        |
| `iso`               | `true` when the row belongs to an implicit per-instrument isolated account, otherwise `false`                                                                                                                 |
| `isoPubkey`         | Present only when `iso=true`; base58 pubkey of the implicit isolated account. Use as `to` in a `transfer` to top up its margin. Cannot be used as `account` in a transaction or as `user` in `POST /account`. |
| `protection`        | Optional attached reduce-only protective orders                                                                                                                                                               |

**Open Orders:**

| Field          | Description                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------- |
| `symbol`       | Market symbol                                                                                 |
| `orderId`      | Order ID (base58, use for cancellation)                                                       |
| `price`        | Order price                                                                                   |
| `originalSize` | Original order size                                                                           |
| `size`         | Current remaining size                                                                        |
| `filledSize`   | Filled size                                                                                   |
| `vwap`         | VWAP fill price (0 if no fills)                                                               |
| `maker`        | `true` if maker order                                                                         |
| `reduceOnly`   | `true` if reduce-only                                                                         |
| `orderType`    | Order type: `limit`, `market`, `stop`, `takeProfit`, `range`, `trigger`, `trailing`           |
| `trigger`      | Trigger metadata for conditional orders, otherwise `null`                                     |
| `tif`          | Time in force (`gtc`, `ioc`, `postOnly`)                                                      |
| `status`       | Order status (`placed`, `working`, etc.)                                                      |
| `timestamp`    | Order placement time (nanoseconds)                                                            |
| `iso`          | `true` when the row belongs to an implicit per-instrument isolated account, otherwise `false` |

**Leverage Settings** (included in initial snapshot only):

| Field      | Description                    |
| ---------- | ------------------------------ |
| `symbol`   | Market symbol                  |
| `leverage` | Maximum leverage (1.0 to 50.0) |

**Fee Tiers** (included in initial snapshot only):

| Field           | Description                                                         |
| --------------- | ------------------------------------------------------------------- |
| `symbol`        | `"global"` for global scope, market symbol for per-instrument scope |
| `rollingVolume` | Current rolling volume in that scope window                         |
| `tierIndex`     | Active tier index (0-based)                                         |
| `tierThreshold` | Threshold volume of the active tier row                             |
| `makerBps`      | Active maker bps for that scope                                     |
| `takerBps`      | Active taker bps for that scope                                     |
| `windowDays`    | Rolling window length in days                                       |

**Pending OnFill** (included in initial snapshot only):

| Field           | Description                                             |
| --------------- | ------------------------------------------------------- |
| `parentOrderId` | Resting parent order that activates on first fill       |
| `actions`       | Consequent actions executed when the parent first fills |

***

## Real-time Delta Updates

After the initial snapshot, you receive delta updates for changes:

### Margin Update

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "marginUpdate",
    "totalBalance": 100500.0,
    "availableBalance": 95500.0,
    "marginUsed": 5000.0,
    "notional": 50500.0,
    "realizedPnl": 1234.5,
    "unrealizedPnl": 567.8,
    "fees": 12.34,
    "funding": 5.67
  },
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```

<Note>
  `transfer`, `createSubAccount` (when seeded with margin), and `removeSubAccount` trigger same-tick margin recompute on touched accounts. WS delivery is asynchronous, so the `post` acknowledgment can arrive before the `marginUpdate` is broadcast.
</Note>

### Position Update

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "positionUpdate",
    "symbol": "BTC-USD",
    "size": 0.5,
    "price": 100000.0,
    "realizedPnl": 500.0,
    "unrealizedPnl": 500.0,
    "leverage": 5.0,
    "liquidationPrice": 95000.0,
    "fairPrice": 101000.0,
    "notional": 50500.0,
    "fees": 10.0,
    "funding": 2.5,
    "maintenanceMargin": 1000.0,
    "lambda": 0.05,
    "riskAllocation": 5000.0,
    "protection": null
  },
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```

***

## Order Update

<Note>
  All order state changes are delivered via unified `orderUpdate` messages with full state information.
</Note>

<Warning>
  `origSz` and `sz` are **signed**: negative values indicate sell-side intent. For example, a sell order for 0.25 BTC has `origSz: -0.25`.
  For `ot: "trigger"` baskets, `origSz` and `sz` are `0` (trigger baskets carry nested actions, not a direct sized order).
</Warning>

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "orderUpdate",
    "ot": "limit",
    "status": "resting",
    "sym": "BTC-USD",
    "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
    "px": 102000.0,
    "origSz": 0.1,
    "sz": 0.1,
    "fillSz": 0.0,
    "vwap": 0.0,
    "tif": "gtc",
    "r": false,
    "mk": true,
    "trigger": null,
    "ts": 1763316177219383423,
    "reason": null
  },
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```

### Order Update Fields

| Field           | Description                                                                          |
| --------------- | ------------------------------------------------------------------------------------ |
| `ot`            | Order type (`limit`, `market`, `stop`, `takeProfit`, `range`, `trigger`, `trailing`) |
| `status`        | Order status (see table below)                                                       |
| `sym`           | Market symbol                                                                        |
| `oid`           | Order ID (base58)                                                                    |
| `px`            | Order price (or trigger reference price)                                             |
| `origSz`        | **Signed** original order size (negative = sell)                                     |
| `sz`            | **Signed** current remaining size (negative = sell)                                  |
| `fillSz`        | Amount filled                                                                        |
| `vwap`          | VWAP fill price                                                                      |
| `tif`           | Time in force (`gtc`, `ioc`, `postOnly`)                                             |
| `r`             | Reduce-only flag                                                                     |
| `mk`            | Maker/resting flag                                                                   |
| `trigger`       | Trigger metadata for conditional orders, otherwise `null` (see below)                |
| `pendingOnFill` | On-fill registration attached to parent while awaiting first fill, or absent         |
| `ts`            | Event timestamp (nanoseconds)                                                        |
| `reason`        | Rejection/cancellation reason (optional)                                             |

### Trigger Metadata

When `trigger` is present (conditional orders):

| Field     | Description                                                                            |
| --------- | -------------------------------------------------------------------------------------- |
| `isAbove` | Trigger direction (`true` = above/equal, `false` = below/equal, `null` if not encoded) |
| `px`      | Trigger threshold price                                                                |
| `lim`     | Post-trigger limit price (`null` = market)                                             |
| `oco`     | Linked OCO order ID (if any)                                                           |
| `pxHi`    | Upper trigger threshold (range upper band / trailing sentinel)                         |
| `limHi`   | Upper post-trigger limit (range upper leg)                                             |
| `trb`     | Trailing distance in bps (trailing only)                                               |
| `stb`     | Favorable reset step in bps (trailing only)                                            |

### Order Status Values

| Status                  | Terminal | Description                            |
| ----------------------- | -------- | -------------------------------------- |
| `pending`               | No       | Accepted but not yet placed            |
| `placed`                | No       | Order placed and resting on book       |
| `resting`               | No       | Resting on book / conditional book     |
| `working`               | No       | Order has partial fills, still resting |
| `modified`              | No       | Order was modified                     |
| `filled`                | Yes      | Order fully filled                     |
| `partiallyFilled`       | Yes      | Order partially filled and terminal    |
| `cancelled`             | Yes      | Order cancelled by user                |
| `cancelledRiskLimit`    | Yes      | Cancelled due to risk limit            |
| `cancelledSelfCrossing` | Yes      | Cancelled due to self-crossing (STP)   |
| `cancelledReduceOnly`   | Yes      | Cancelled - would not reduce position  |
| `cancelledIoc`          | Yes      | IOC expired without full fill          |
| `rejectedCrossing`      | Yes      | Post-only rejected for crossing        |
| `rejectedDuplicate`     | Yes      | Duplicate order ID                     |
| `rejectedRiskLimit`     | Yes      | Rejected due to risk limit             |
| `rejectedInvalid`       | Yes      | Invalid order parameters               |
| `triggered`             | No       | Conditional root fired                 |
| `siblingCancelled`      | Yes      | OCO sibling auto-cancelled             |
| `triggerFailed`         | Yes      | Trigger execution failed               |

### Order Update Examples

<CodeGroup>
  ```json Buy Limit Placed theme={null}
  {
    "type": "account",
    "data": {
      "type": "orderUpdate",
      "ot": "limit",
      "status": "placed",
      "sym": "BTC-USD",
      "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
      "px": 100000.0,
      "origSz": 0.1,
      "sz": 0.1,
      "fillSz": 0.0,
      "vwap": 0.0,
      "tif": "gtc",
      "r": false,
      "mk": true,
      "trigger": null,
      "ts": 1763316177219383423,
      "reason": null
    },
    "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Sell Limit Resting (signed) theme={null}
  {
    "type": "account",
    "data": {
      "type": "orderUpdate",
      "ot": "limit",
      "status": "resting",
      "sym": "BTC-USD",
      "oid": "7kR2mQfENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "px": 105000.0,
      "origSz": -0.25,
      "sz": -0.25,
      "fillSz": 0.0,
      "vwap": 0.0,
      "tif": "gtc",
      "r": false,
      "mk": true,
      "trigger": null,
      "ts": 1763316177219383423,
      "reason": null
    },
    "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Working (partial fill) theme={null}
  {
    "type": "account",
    "data": {
      "type": "orderUpdate",
      "ot": "limit",
      "status": "working",
      "sym": "BTC-USD",
      "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
      "px": 100000.0,
      "origSz": 0.1,
      "sz": 0.05,
      "fillSz": 0.05,
      "vwap": 100000.0,
      "tif": "gtc",
      "r": false,
      "mk": true,
      "trigger": null,
      "ts": 1763316177219383423,
      "reason": null
    },
    "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Order Filled theme={null}
  {
    "type": "account",
    "data": {
      "type": "orderUpdate",
      "ot": "limit",
      "status": "filled",
      "sym": "BTC-USD",
      "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
      "px": 100000.0,
      "origSz": 0.1,
      "sz": 0.0,
      "fillSz": 0.1,
      "vwap": 100025.5,
      "tif": "gtc",
      "r": false,
      "mk": false,
      "trigger": null,
      "ts": 1763316177219383423,
      "reason": null
    },
    "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Cancelled Risk Limit theme={null}
  {
    "type": "account",
    "data": {
      "type": "orderUpdate",
      "ot": "limit",
      "status": "cancelledRiskLimit",
      "sym": "BTC-USD",
      "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
      "px": 100000.0,
      "origSz": 0.1,
      "sz": 0.05,
      "fillSz": 0.05,
      "vwap": 100000.0,
      "tif": "gtc",
      "r": false,
      "mk": false,
      "trigger": null,
      "ts": 1763316177219383423,
      "reason": "Position would exceed max leverage"
    },
    "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Stop Resting (with trigger) theme={null}
  {
    "type": "account",
    "data": {
      "type": "orderUpdate",
      "ot": "stop",
      "status": "resting",
      "sym": "BTC-USD",
      "oid": "8mT3nQgGPjHFX7vNrAShxnk0hqoc96FhVdAb6Fn5QRi8",
      "px": 0.0,
      "origSz": -0.25,
      "sz": -0.25,
      "fillSz": 0.0,
      "vwap": 0.0,
      "tif": "gtc",
      "r": false,
      "mk": false,
      "trigger": {
        "isAbove": false,
        "px": 98000.0,
        "lim": 97950.0,
        "oco": null,
        "pxHi": null,
        "limHi": null,
        "trb": null,
        "stb": null
      },
      "ts": 1763316177219383423,
      "reason": null
    },
    "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Range/OCO Triggered theme={null}
  {
    "type": "account",
    "data": {
      "type": "orderUpdate",
      "ot": "range",
      "status": "triggered",
      "sym": "BTC-USD",
      "oid": "ABC...",
      "px": 0.0,
      "origSz": 0.0,
      "sz": 0.0,
      "fillSz": 0.0,
      "vwap": 0.0,
      "tif": "gtc",
      "r": true,
      "mk": false,
      "trigger": null,
      "ts": 1763316177219383423
    },
    "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json OCO Sibling Cancelled theme={null}
  {
    "type": "account",
    "data": {
      "type": "orderUpdate",
      "ot": "range",
      "status": "siblingCancelled",
      "sym": "BTC-USD",
      "oid": "DEF...",
      "px": 0.0,
      "origSz": 0.0,
      "sz": 0.0,
      "fillSz": 0.0,
      "vwap": 0.0,
      "tif": "gtc",
      "r": false,
      "mk": false,
      "trigger": null,
      "ts": 1763316177219383423,
      "reason": "oco sibling cancelled"
    },
    "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Trigger Failed theme={null}
  {
    "type": "account",
    "data": {
      "type": "orderUpdate",
      "ot": "stop",
      "status": "triggerFailed",
      "sym": "BTC-USD",
      "oid": "GHI...",
      "px": 0.0,
      "origSz": 0.0,
      "sz": 0.0,
      "fillSz": 0.0,
      "vwap": 0.0,
      "tif": "gtc",
      "r": true,
      "mk": false,
      "trigger": null,
      "ts": 1763316177219383423,
      "reason": "conditional execution failed: no counterparty"
    },
    "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```
</CodeGroup>

<Note>
  **Legacy order messages:** For backwards compatibility, `order` messages with `status: "placed"` or `status: "cancelled"` may still be emitted alongside `orderUpdate`. New integrations should use `orderUpdate` messages exclusively.
</Note>

***

## Fill Update

Emitted on each trade execution (in addition to `orderUpdate`):

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "fill",
    "symbol": "BTC-USD",
    "orderId": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
    "price": 102000.0,
    "size": 0.05,
    "fee": 0.35,
    "isBuy": true,
    "reasonCode": 0,
    "counterpartyHint": "5Am6..nVux",
    "timestamp": 1763316177219383423,
    "maker": false
  },
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```

**Fill Fields:**

* `symbol` - Market symbol
* `orderId` - Your order ID for this row
* `price` - Execution price
* `size` - Executed size
* `fee` - Effective fee for this row
* `isBuy` - `true` if taker bought, `false` if taker sold
* `reasonCode` - Fill reason code (`0=normal`, `1=liquidation`, `2=adl`, `3=liquidation_sweep`)
* `reason` - Optional reason label (non-normal only; `liquidation`, `adl`, or `liquidation_sweep`)
* `counterpartyHint` - Short counterparty key hint (`xxxx..yyyy`)
* `timestamp` - Fill timestamp (nanoseconds)
* `maker` - `true` if this row is the maker side

***

## Liquidation Event

Emitted when the account is liquidated:

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "liquidation",
    "symbol": "BTC-USD",
    "price": 95000.0,
    "size": 0.5,
    "isBuy": false,
    "marginPrior": 5000.0,
    "marginAfter": 0.0,
    "reason": "margin shortfall",
    "timestamp": 1763316177219383423
  },
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```

| Field         | Description                                |
| ------------- | ------------------------------------------ |
| `symbol`      | Market symbol                              |
| `price`       | Liquidation price                          |
| `size`        | Position size that was liquidated          |
| `isBuy`       | Direction of the liquidation fill          |
| `marginPrior` | Margin balance before liquidation          |
| `marginAfter` | Margin balance after liquidation           |
| `reason`      | Optional human-readable liquidation reason |
| `timestamp`   | Timestamp (nanoseconds)                    |

***

## ADL (Auto-Deleveraging) Event

Emitted when the account is auto-deleveraged:

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "adl",
    "symbol": "BTC-USD",
    "price": 95000.0,
    "size": 0.5,
    "isBuy": false,
    "reason": "underfill residual",
    "timestamp": 1763316177219383423
  },
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```

| Field       | Description                             |
| ----------- | --------------------------------------- |
| `symbol`    | Market symbol                           |
| `price`     | ADL price                               |
| `size`      | Position size that was auto-deleveraged |
| `isBuy`     | Direction of the ADL fill               |
| `reason`    | Optional human-readable ADL reason      |
| `timestamp` | Timestamp (nanoseconds)                 |

<Tip>
  For historical liquidation / ADL analysis, query [`POST /account`](/api-reference/getAccount) with `type: "riskHistory"`.
</Tip>

***

## Cancel Rejected

Emitted when a single-order cancel is rejected (e.g. order not found):

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "cancelOneRejected",
    "symbol": "BTC-USD",
    "orderId": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
    "reason": "Order not found",
    "timestamp": 1763316177219383423
  },
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```

***

## Cancel All Rejected

Emitted when cancel-all is rejected (e.g. no open orders):

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "cancelAllRejected",
    "symbol": "BTC-USD",
    "reason": "No open orders",
    "timestamp": 1763316177219383423
  },
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```

***

## Leverage Update

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "leverageUpdate",
    "leverage": [
      { "symbol": "BTC-USD", "leverage": 5.0 }
    ]
  },
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```

***

## Fee Tier Update

Emitted when the account's fee tier changes:

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "feeTierUpdate",
    "feeTiers": [
      {
        "symbol": "global",
        "rollingVolume": 1260000.0,
        "tierIndex": 1,
        "tierThreshold": 1000000.0,
        "makerBps": 1.8,
        "takerBps": 3.3,
        "windowDays": 14
      }
    ],
    "ts": 1775550000123456789
  },
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```

***

## Update Frequency

* **Initial Snapshot**: Sent immediately on subscription (single unified `accountSnapshot` message).
* **Event-driven**: Margin, positions, and leverage settings are sent when they change.
* **Real-time**: Immediately on all order state changes (`orderUpdate`), including:
  * Order placement (placed, resting)
  * Partial fills (working)
  * Full fills (filled)
  * Cancellations (cancelled, cancelledRiskLimit, cancelledIoc, etc.)
  * Rejections (rejectedCrossing, rejectedRiskLimit, etc.)

***

## Example: Monitor Account

<CodeGroup>
  ```javascript Node.js theme={null}
  const WebSocket = require('ws');

  const PUBLIC_KEY = 'FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7';
  const ws = new WebSocket('wss://exchange-ws1.bulk.trade');

  ws.on('open', () => {
    console.log('Connected');
    
    // Subscribe to account updates
    ws.send(JSON.stringify({
      method: 'subscribe',
      subscription: [{
        type: 'account',
        user: PUBLIC_KEY
      }]
    }));
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data);
    
    if (message.type === 'subscriptionResponse') {
      console.log('Subscribed to:', message.topics);
      return;
    }
    
    if (message.type === 'account') {
      const { type, ...details } = message.data;
      
      switch(type) {
        case 'accountSnapshot':
          console.log('Account snapshot:', details);
          console.log('Positions:', details.positions);
          console.log('Open orders:', details.openOrders);
          break;
        case 'marginUpdate':
          console.log('Margin update:', details);
          break;
        case 'positionUpdate':
          console.log('Position update:', details);
          break;
        case 'orderUpdate':
          console.log(`Order ${details.status}:`, details);
          break;
        case 'fill':
          console.log('Fill:', details);
          break;
        case 'leverageUpdate':
          console.log('Leverage updated:', details);
          break;
        case 'feeTierUpdate':
          console.log('Fee tier updated:', details);
          break;
        case 'liquidation':
          console.log('Liquidation:', details);
          break;
        case 'adl':
          console.log('ADL:', details);
          break;
        case 'cancelOneRejected':
          console.log('Cancel rejected:', details);
          break;
        case 'cancelAllRejected':
          console.log('Cancel all rejected:', details);
          break;
      }
    }
  });
  ```

  ```python Python theme={null}
  import websocket
  import json

  PUBLIC_KEY = 'FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7'

  def on_message(ws, message):
      data = json.loads(message)
      
      if data.get('type') == 'subscriptionResponse':
          print(f"Subscribed to: {data['topics']}")
          return
      
      if data.get('type') == 'account':
          msg_type = data['data']['type']
          
          if msg_type == 'accountSnapshot':
              print(f"Account snapshot: {data['data']}")
              print(f"Positions: {data['data']['positions']}")
              print(f"Open orders: {data['data']['openOrders']}")
          elif msg_type == 'marginUpdate':
              print(f"Margin update: {data['data']}")
          elif msg_type == 'positionUpdate':
              print(f"Position update: {data['data']}")
          elif msg_type == 'orderUpdate':
              print(f"Order {data['data']['status']}: {data['data']}")
          elif msg_type == 'fill':
              print(f"Fill: {data['data']}")
          elif msg_type == 'leverageUpdate':
              print(f"Leverage updated: {data['data']}")
          elif msg_type == 'feeTierUpdate':
              print(f"Fee tier updated: {data['data']}")
          elif msg_type == 'liquidation':
              print(f"Liquidation: {data['data']}")
          elif msg_type == 'adl':
              print(f"ADL: {data['data']}")
          elif msg_type == 'cancelOneRejected':
              print(f"Cancel rejected: {data['data']}")
          elif msg_type == 'cancelAllRejected':
              print(f"Cancel all rejected: {data['data']}")

  def on_open(ws):
      print('Connected')
      
      ws.send(json.dumps({
          'method': 'subscribe',
          'subscription': [{
              'type': 'account',
              'user': PUBLIC_KEY
          }]
      }))

  ws = websocket.WebSocketApp(
      'wss://exchange-ws1.bulk.trade',
      on_message=on_message,
      on_open=on_open
  )

  ws.run_forever()
  ```
</CodeGroup>

***

## Unsubscribe

```json theme={null}
{
  "method": "unsubscribe",
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```
