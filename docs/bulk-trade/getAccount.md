> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Query Account (Unsigned)

> Query account information. **No signature required** - read-only operation.

Accepts a JSON body with POST request.

**Query types**:

| `type` | Returns |
|---|---|
| `fullAccount` | Complete state (margin + positions + orders + leverage settings) |
| `openOrders` | Resting live orders (includes conditional orders parked in conditional books) |
| `fills` | Trade history (last 5000 fills) |
| `positions` | Closed position history (last 5000 positions) |
| `fundingHistory` | Funding payment history (last 5000 payments) |
| `orderHistory` | Terminal order history (last 5000 orders) |
| `activityHistory` | Account activity history (last 5000; transfers/deposits) |
| `riskHistory` | Liquidation and ADL risk events (last 5000) |
| `feeTier` | Account-only fee-tier quote snapshot (`symbol` optional). For global fee state use `GET /feeState`. |


## Query Targets

`POST /account` is unsigned: pass a **master** or **sub-account** pubkey as `user` and the server returns that account's view.

| Pubkey passed in `user` | What you get back                                                                                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Master**              | Master snapshot. Aggregated views (`fullAccount`, `openOrders`, `fills`, `positions`, `fundingHistory`, `orderHistory`, `activityHistory`, `riskHistory`) include the master's own rows **plus** rows from any per-instrument isolated accounts attached to it (each isolated row carries `iso = true` and `isoPubkey`). |
| **Sub-account**         | Snapshot scoped to that sub-account. `kind = "SubAccount"` and `parent` is the master pubkey. Aggregated views also include any per-instrument isolated-account rows attached to that sub-account.                                                                                                                       |

Isolated accounts and multisig accounts are not query targets. Isolated accounts are managed entirely via the `i` flag on order actions (see [Isolated Margin](/bulk-exchange/isolated-margin)); their pubkeys (`isoPubkey`) appear inline on master/sub-account rows and are only used as `to` in margin [`transfer`](/api-reference/transfer) top-ups. Multisig proposals are queried via [`GET /multisig/{pubkey}/proposals`](/api-reference/getMultisigProposals).

To enumerate sub-accounts on a master, read `subAccounts[]` from its `fullAccount` response.

***

## Request Examples

<CodeGroup>
  ```json Full Account theme={null}
  {
    "type": "fullAccount",
    "user": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Open Orders theme={null}
  {
    "type": "openOrders",
    "user": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Fills theme={null}
  {
    "type": "fills",
    "user": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Closed Positions theme={null}
  {
    "type": "positions",
    "user": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Funding History theme={null}
  {
    "type": "fundingHistory",
    "user": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Order History theme={null}
  {
    "type": "orderHistory",
    "user": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Activity History theme={null}
  {
    "type": "activityHistory",
    "user": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Risk History theme={null}
  {
    "type": "riskHistory",
    "user": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }
  ```

  ```json Fee Tier theme={null}
  {
    "type": "feeTier",
    "user": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
    "symbol": "BTC-USD"
  }
  ```

  ```json Sub-Account theme={null}
  {
    "type": "fullAccount",
    "user": "8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR"
  }
  ```
</CodeGroup>

***

## Response Schemas

Responses are always an **array** of objects; each object has a single key (`fullAccount`, `openOrder`, `fills`, `positions`, `fundingPayment`, `orderHistory`, `activityHistory`, `riskHistory`, or `feeTier`) depending on the query type.

### Full Account Response

For `type: "fullAccount"`. Returns complete state: margin, positions, open orders, and leverage settings.

```json theme={null}
[
  {
    "fullAccount": {
      "kind": "MasterEOA",
      "parent": null,
      "subAccounts": [
        {"pubkey": "8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR"}
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
        "realizedPnl": 1234.0,
        "unrealizedPnl": 500.0,
        "fees": 12.5,
        "funding": -5.0
      },
      "positions": [
        {
          "symbol": "BTC-USD",
          "size": 0.5,
          "price": 100000.0,
          "fairPrice": 100050.0,
          "notional": 50000.0,
          "realizedPnl": 1234.0,
          "unrealizedPnl": 500.0,
          "leverage": 5.0,
          "liquidationPrice": 80000.0,
          "fees": 12.5,
          "funding": -5.0,
          "maintenanceMargin": 2500.0,
          "lambda": 0.05,
          "riskAllocation": 0.8,
          "iso": false,
          "protection": {
            "orders": [
              {
                "orderId": "9fJdDgS8eYq9Dj8YkXTY32tRAb4gk58wEAg2a5kzCL5P",
                "orderType": "stop",
                "trigger": {
                  "px": 98000.0,
                  "lim": 97950.0,
                  "oco": null
                }
              }
            ]
          }
        }
      ],
      "openOrders": [
        {
          "symbol": "BTC-USD",
          "orderId": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
          "price": 100000.0,
          "originalSize": 0.1,
          "size": 0.1,
          "filledSize": 0.0,
          "vwap": 0.0,
          "maker": true,
          "reduceOnly": false,
          "orderType": "limit",
          "trigger": null,
          "tif": "gtc",
          "status": "resting",
          "timestamp": 1704067200000000000,
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
    }
  }
]
```

**Account top-level fields:**

* `kind` - Account kind string. For query responses, this is `MasterEOA` or `SubAccount` (the only pubkeys you can pass as `user`).
* `parent` - Parent master pubkey for sub-accounts; `null` for masters
* `name` - Sub-account display name. Present on responses where `kind: "SubAccount"` (i.e. when you passed the sub-account pubkey as `user`); omitted on master responses.
* `subAccounts` - Children of the master, each `{pubkey}`. The list contains pubkeys only; query a sub-account directly with `type: "fullAccount"` to see its `name`. See [Sub-Accounts](/api-reference/manageSubAccounts)
* `multisigAccounts` - Multisig accounts where this account is the multisig address or a signer member. See [Multisig](/api-reference/manageMultisig)
* `authorizedAgentWallets` - Agent wallets registered on this account that may sign on its behalf. See [Manage Agent Wallets](/api-reference/manageAgentWallet)

**Margin fields:** `totalBalance`, `availableBalance`, `marginUsed`, `notional`, `realizedPnl`, `unrealizedPnl`, `fees`, `funding`

**Position fields:** `symbol`, `size`, `price`, `fairPrice`, `notional`, `realizedPnl`, `unrealizedPnl`, `leverage`, `liquidationPrice`, `fees`, `funding`, `maintenanceMargin`, `lambda`, `riskAllocation`, `iso`

* `iso` - `true` if the position belongs to a per-instrument [isolated account](/bulk-exchange/isolated-margin) attached to this master/sub-account; otherwise `false`
* `isoPubkey` - Present only when `iso=true`; pubkey of the isolated account. Use as `to` in [`transfer`](/api-reference/transfer) to top up isolated-account margin. Isolated-account pubkeys are not valid `user` values for `POST /account`.
* `protection` - Optional attached reduce-only protective orders for this symbol

### Open Orders Response

For `type: "openOrders"`. Returns up to 5000 resting orders; each item is an object with key `openOrder`.

```json theme={null}
[
  {
    "openOrder": {
      "symbol": "BTC-USD",
      "orderId": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
      "price": 99000.0,
      "originalSize": 0.1,
      "size": 0.1,
      "filledSize": 0.0,
      "vwap": 0.0,
      "maker": true,
      "reduceOnly": false,
      "orderType": "limit",
      "trigger": null,
      "tif": "gtc",
      "status": "resting",
      "timestamp": 1699564800000000000,
      "iso": false
    }
  }
]
```

For master/sub accounts, the response also includes per-instrument isolated-account rows (`iso=true`) belonging to that account tree.

### Fills Response

For `type: "fills"`. Returns up to 5000 recent fills; each item has key `fills`. For master/sub accounts, results include both base-account rows and per-instrument isolated-account rows (`iso=true`).

```json theme={null}
[
  {
    "fills": {
      "maker": "maker_pubkey_base58",
      "taker": "taker_pubkey_base58",
      "orderIdMaker": "maker_order_hash",
      "orderIdTaker": "taker_order_hash",
      "isBuy": true,
      "symbol": "BTC-USD",
      "amount": 0.1,
      "price": 100000.0,
      "makerFee": -0.15,
      "takerFee": 0.35,
      "fee": 0.35,
      "reasonCode": 0,
      "iso": false,
      "counterpartyHint": "5Am6..nVux",
      "slot": 12345,
      "timestamp": 1699564800000
    }
  }
]
```

**Fill fields:**

* `reasonCode` - Fill reason code (`0=normal`, `1=liquidation`, `2=adl`, `3=liquidation_sweep`)
* `reason` - Fill reason label (present only if non-normal; `liquidation`, `adl`, or `liquidation_sweep`)
* `counterpartyHint` - Short counterparty key hint for the queried user (`xxxx..yyyy`)
* `iso` - `true` if the row belongs to a per-instrument isolated account, otherwise `false`

### Closed Positions Response

For master/sub accounts, results include both base-account rows and per-instrument isolated-account rows (`iso=true`).

```json theme={null}
[
  {
    "positions": {
      "owner": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "symbol": "BTC-USD",
      "maxQuantity": 0.5,
      "totalVolume": 1.0,
      "avgOpenPrice": 99000.0,
      "avgClosePrice": 101000.0,
      "realizedPnl": 1000.0,
      "fees": 20.0,
      "funding": 5.0,
      "openTime": 1763310000000000000,
      "closeTime": 1763316177219383423,
      "closeReason": "normal",
      "iso": false
    }
  }
]
```

**Close Reason Values:**

* `normal` - Manually closed by user
* `liquidation` - Closed due to liquidation
* `adl` - Closed due to auto-deleveraging
* `liquidation_sweep` - Residual closed by post-liquidation sweep

### Funding History Response

For master/sub accounts, results include both base-account rows and per-instrument isolated-account rows (`iso=true`).

```json theme={null}
[
  {
    "fundingPayment": {
      "owner": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "symbol": "BTC-USD",
      "size": 0.5,
      "payment": 12.50,
      "fundingRate": 0.0001,
      "markPrice": 100000.0,
      "iso": false,
      "slot": 123456789,
      "timestamp": 1763316177219383423
    }
  }
]
```

**Payment Field:**

* Positive = received funding
* Negative = paid funding

### Order History Response

For `type: "orderHistory"`. Returns up to 5000 terminal orders; each item has key `orderHistory`. For master/sub accounts, results include both base-account rows and per-instrument isolated-account rows (`iso=true`).

```json theme={null}
[
  {
    "orderHistory": {
      "orderId": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
      "symbol": "BTC-USD",
      "side": "buy",
      "orderType": "limit",
      "tif": "gtc",
      "price": 100000.0,
      "vwap": 100025.5,
      "originalSize": 0.1,
      "executedSize": 0.1,
      "reduceOnly": false,
      "trigger": null,
      "status": "filled",
      "reason": null,
      "iso": false,
      "slot": 12345,
      "timestamp": 1699564800000000000
    }
  }
]
```

**Terminal Status Values:**

* `filled` - Fully filled
* `partiallyFilled` - Partially filled
* `cancelled` - Cancelled by user
* `cancelledRiskLimit` - Risk limit exceeded
* `cancelledSelfCrossing` - Self-trade prevention
* `cancelledReduceOnly` - Would increase position
* `cancelledIoc` - IOC expired
* `rejectedInvalid` - Invalid parameters
* `rejectedRiskLimit` - Risk limit on submission
* `rejectedCrossing` - Post-only would cross
* `rejectedDuplicate` - Duplicate order ID
* `triggered` - Conditional root fired (non-terminal)
* `siblingCancelled` - OCO sibling auto-cancelled
* `triggerFailed` - Trigger execution failed

**orderType values:** `"limit"`, `"market"`, `"stop"`, `"takeProfit"`, `"range"`, `"trigger"`, or `"trailing"`

### Activity History Response

For `type: "activityHistory"`. Returns up to 5000 account activity rows (transfers, deposits). For master/sub accounts, results include both base-account rows and per-instrument isolated-account rows (`iso=true`).

```json theme={null}
[
  {
    "activityHistory": {
      "activityType": "transferInternal",
      "status": "completed",
      "from": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "to": "8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR",
      "symbol": "USDC",
      "amount": 100.0,
      "reason": null,
      "iso": false,
      "slot": 12345,
      "timestamp": 1699564800000000000,
      "sequence": 7
    }
  }
]
```

**Activity Fields:**

* `activityType` - `transferInternal`, `transferExternal`, `deposit`, `withdrawal`, or `unknown`
* `status` - `completed`, `failed`, `ongoing`, or `unknown`
* `from` / `to` - Source and destination account pubkeys
* `reason` - Optional failure/details string
* `iso` - `true` if the row belongs to a per-instrument isolated account stream

### Risk Event History Response

For `type: "riskHistory"`. Returns up to 5000 liquidation and ADL risk events. For master/sub accounts, results include both base-account rows and per-instrument isolated-account rows (`iso=true`). Use this for historical liquidation/ADL analysis; for live events subscribe to the [account stream](/api-reference/ws-account).

```json theme={null}
[
  {
    "riskHistory": {
      "owner": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "symbol": "BTC-USD",
      "isBuy": false,
      "amount": 0.5,
      "price": 95000.0,
      "eventType": "liquidation",
      "marginPrior": 5000.0,
      "marginAfter": 0.0,
      "reason": "margin shortfall",
      "iso": false,
      "slot": 12345,
      "timestamp": 1699564800000000000,
      "sequence": 18
    }
  },
  {
    "riskHistory": {
      "owner": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "symbol": "BTC-USD",
      "isBuy": true,
      "amount": 0.1,
      "price": 95000.0,
      "eventType": "adl",
      "marginPrior": 4123.25,
      "marginAfter": 4098.75,
      "reason": "underfill residual",
      "iso": false,
      "slot": 12346,
      "timestamp": 1699564801000000000,
      "sequence": 4
    }
  }
]
```

**Risk Event Fields:**

* `eventType` - `liquidation` or `adl`
* `reason` - Optional human-readable reason (e.g. shortfall / underfill tagging)
* `marginPrior` / `marginAfter` - Margin balance snapshot around this risk event
* `iso` - `true` if the row belongs to a per-instrument isolated account

### Fee Tier Response

For `type: "feeTier"`. Returns the account-only fee-tier quote snapshot. For global fee-state (policy, schedules, settlement totals) use [`GET /feeState`](/api-reference/getFeeState).

```json theme={null}
[
  {
    "feeTier": {
      "scopeInstrument": "BTC-USD",
      "rollingVolume": 1200000.0,
      "tierIndex": 1,
      "tierThreshold": 1000000.0,
      "makerBps": 1.8,
      "takerBps": 3.3,
      "windowDays": 14
    }
  }
]
```

**Fee Tier Fields:**

* `scopeInstrument` - Instrument scope resolved for this quote
* `rollingVolume` - Account rolling volume in resolved scope window
* `tierIndex` - Active tier index (0-based)
* `tierThreshold` - Threshold volume of the active tier row
* `makerBps` / `takerBps` - Effective bps at current tier
* `windowDays` - Rolling window length in days

***

## Real-time Updates

For real-time account updates, use the [WebSocket account stream](/api-reference/ws-account).

```json theme={null}
{
  "method": "subscribe",
  "subscription": [{
    "type": "account",
    "user": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
  }]
}
```


## OpenAPI

````yaml POST /account
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
  /account:
    post:
      tags:
        - Account (Unsigned)
      summary: Query account (unsigned)
      description: >
        Query account information. **No signature required** - read-only
        operation.


        Accepts a JSON body with POST request.


        **Query types**:


        | `type` | Returns |

        |---|---|

        | `fullAccount` | Complete state (margin + positions + orders + leverage
        settings) |

        | `openOrders` | Resting live orders (includes conditional orders parked
        in conditional books) |

        | `fills` | Trade history (last 5000 fills) |

        | `positions` | Closed position history (last 5000 positions) |

        | `fundingHistory` | Funding payment history (last 5000 payments) |

        | `orderHistory` | Terminal order history (last 5000 orders) |

        | `activityHistory` | Account activity history (last 5000;
        transfers/deposits) |

        | `riskHistory` | Liquidation and ADL risk events (last 5000) |

        | `feeTier` | Account-only fee-tier quote snapshot (`symbol` optional).
        For global fee state use `GET /feeState`. |
      operationId: getAccount
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AccountQuery'
            examples:
              fullAccount:
                summary: Get full account state
                value:
                  type: fullAccount
                  user: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              openOrders:
                summary: Get open orders only
                value:
                  type: openOrders
                  user: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              fills:
                summary: Get fill history
                value:
                  type: fills
                  user: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              positions:
                summary: Get closed position history
                value:
                  type: positions
                  user: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              fundingHistory:
                summary: Get funding payment history
                value:
                  type: fundingHistory
                  user: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              orderHistory:
                summary: Get terminal order history
                value:
                  type: orderHistory
                  user: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              activityHistory:
                summary: Get account activity history (transfers / deposits)
                value:
                  type: activityHistory
                  user: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              riskHistory:
                summary: Get risk event history (liquidation / ADL)
                value:
                  type: riskHistory
                  user: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              feeTier:
                summary: Get account fee tier quote
                value:
                  type: feeTier
                  user: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  symbol: BTC-USD
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/AccountData'
        '404':
          $ref: '#/components/responses/NotFound'
        '408':
          $ref: '#/components/responses/Timeout'
        '500':
          $ref: '#/components/responses/ServerError'
components:
  schemas:
    AccountQuery:
      type: object
      description: Account query parameters (no signature needed)
      required:
        - type
        - user
      properties:
        type:
          type: string
          enum:
            - fullAccount
            - openOrders
            - fills
            - positions
            - fundingHistory
            - orderHistory
            - activityHistory
            - riskHistory
            - feeTier
          description: >
            Type of account data to retrieve. `feeTier` returns the account-only
            fee-tier quote;

            use `GET /feeState` for global fee policy/schedule snapshots.
        user:
          type: string
          description: User public key (base58)
          example: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
        symbol:
          type: string
          description: >-
            Optional market symbol for scope-specific requests (used by
            `feeTier`)
          example: BTC-USD
    AccountData:
      oneOf:
        - type: object
          properties:
            fullAccount:
              $ref: '#/components/schemas/FullAccount'
        - type: object
          properties:
            openOrder:
              $ref: '#/components/schemas/OrderState'
        - type: object
          properties:
            fills:
              $ref: '#/components/schemas/Fill'
        - type: object
          properties:
            positions:
              $ref: '#/components/schemas/ClosedPosition'
        - type: object
          properties:
            fundingPayment:
              $ref: '#/components/schemas/FundingPayment'
        - type: object
          properties:
            orderHistory:
              $ref: '#/components/schemas/OrderHistoryEntry'
        - type: object
          properties:
            activityHistory:
              $ref: '#/components/schemas/ActivityHistoryEntry'
        - type: object
          properties:
            riskHistory:
              $ref: '#/components/schemas/RiskHistoryEntry'
        - type: object
          properties:
            feeTier:
              $ref: '#/components/schemas/FeeTierAccountQuote'
    FullAccount:
      type: object
      description: >-
        Complete account state with account tree, margin, positions, orders, and
        leverage settings
      properties:
        kind:
          type: string
          enum:
            - MasterEOA
            - SubAccount
            - IsoAccount
            - Multisig
          description: Account kind
        parent:
          type: string
          nullable: true
          description: >-
            Parent account pubkey (present for sub/iso accounts, otherwise
            `null`)
        name:
          type: string
          nullable: true
          description: >
            Sub-account display name. Present on responses where `kind:
            "SubAccount"`

            (i.e. when the sub-account pubkey was passed as `user`); omitted on
            master responses.
        subAccounts:
          type: array
          description: >
            Child sub-accounts owned by this master (empty for non-master
            kinds).

            The list contains pubkeys only; query a sub-account directly with
            `type: "fullAccount"`

            (HTTP) or subscribe to its account stream (WS) to see its `name`.
          items:
            type: object
            required:
              - pubkey
            properties:
              pubkey:
                type: string
                description: Sub-account pubkey (base58)
        multisigAccounts:
          type: array
          description: >-
            Multisig accounts where this account is the multisig address or a
            signer member
          items:
            type: string
        authorizedAgentWallets:
          type: array
          description: >
            Agent wallets registered on this account that may sign on its
            behalf.

            Agents registered on a master are also authorized to sign for any of
            the master's sub-accounts. Sub-accounts can additionally register
            their own agents independently.
          items:
            type: string
        margin:
          $ref: '#/components/schemas/Margin'
        positions:
          type: array
          description: >-
            Open positions with full risk metrics. For master/sub accounts,
            includes per-instrument isolated-account rows (`iso=true`).
          items:
            $ref: '#/components/schemas/Position'
        openOrders:
          type: array
          description: >-
            Resting live orders, including conditional orders parked in
            conditional books. For master/sub accounts, includes per-instrument
            isolated-account rows (`iso=true`).
          items:
            $ref: '#/components/schemas/OrderState'
        pendingOnFill:
          type: array
          description: Registered on-fill plans waiting for parent order fill
          items:
            $ref: '#/components/schemas/PendingOnFillPlan'
        feeTiers:
          type: array
          description: Effective fee tier snapshot rows for global and instrument scopes
          items:
            $ref: '#/components/schemas/FeeTierQuote'
        leverageSettings:
          type: array
          description: Per-symbol leverage settings
          items:
            $ref: '#/components/schemas/LeverageEntry'
    OrderState:
      type: object
      description: Order status and details
      properties:
        symbol:
          type: string
          description: Market symbol
        orderId:
          type: string
          description: Order ID (base58) - use for cancellation
        price:
          type: number
          description: >-
            Order price (for conditional roots this is projected from trigger
            threshold when direct price is not set)
        originalSize:
          type: number
          description: >-
            Original order size (signed; negative values indicate sell-side
            intent)
        size:
          type: number
          description: >-
            Remaining size (signed; negative values indicate sell-side intent;
            `trigger` baskets use `0` because they are action containers, not
            direct sized orders)
        filledSize:
          type: number
          description: Filled size
        vwap:
          type: number
          description: Volume-weighted average fill price (0 if no fills)
        maker:
          type: boolean
          description: true if order is maker (resting on book)
        reduceOnly:
          type: boolean
          description: true if reduce-only order
        orderType:
          type: string
          enum:
            - limit
            - market
            - stop
            - takeProfit
            - range
            - trigger
            - trailing
          description: Inferred order type for snapshots/open-orders
        trigger:
          allOf:
            - $ref: '#/components/schemas/TriggerSpec'
          nullable: true
          description: Trigger metadata for conditional/trigger orders, otherwise `null`
        tif:
          type: string
          enum:
            - gtc
            - ioc
            - postOnly
          description: Time in force
        status:
          type: string
          enum:
            - pending
            - placed
            - resting
            - working
            - modified
            - filled
            - partiallyFilled
            - cancelled
            - cancelledRiskLimit
            - cancelledSelfCrossing
            - cancelledReduceOnly
            - cancelledIoc
            - rejectedInvalid
            - rejectedRiskLimit
            - rejectedCrossing
            - rejectedDuplicate
            - triggered
            - siblingCancelled
            - triggerFailed
          description: Order status
        timestamp:
          type: integer
          format: int64
          description: Order placement time (nanoseconds)
        iso:
          type: boolean
          description: >-
            `true` if this row belongs to a per-instrument isolated account,
            otherwise `false`
    Fill:
      type: object
      description: Trade execution (fill)
      properties:
        maker:
          type: string
          description: Maker public key (base58)
        taker:
          type: string
          description: Taker public key (base58)
        orderIdMaker:
          type: string
          description: Maker order ID (base58)
        orderIdTaker:
          type: string
          description: Taker order ID (base58)
        isBuy:
          type: boolean
          description: Taker side (true=bought, false=sold)
        symbol:
          type: string
        amount:
          type: number
          description: Trade size
        price:
          type: number
          description: Execution price
        makerFee:
          type: number
          description: Maker fee (negative means rebate)
        takerFee:
          type: number
          description: Taker fee (negative means rebate)
        fee:
          type: number
          description: >-
            Effective fee for queried row (`makerFee` for maker row, `takerFee`
            for taker row)
        reasonCode:
          type: integer
          format: int32
          enum:
            - 0
            - 1
            - 2
            - 3
          description: >-
            Fill reason code: `0=normal`, `1=liquidation`, `2=adl`,
            `3=liquidation_sweep`
        reason:
          type: string
          enum:
            - liquidation
            - adl
            - liquidation_sweep
          description: Fill reason label (present only if non-normal)
        counterpartyHint:
          type: string
          description: Short counterparty key hint for the queried user (`xxxx..yyyy`)
        slot:
          type: integer
          format: int64
          description: Slot number
        timestamp:
          type: integer
          format: int64
          description: Execution time (nanoseconds)
        iso:
          type: boolean
          description: >-
            `true` if this row belongs to a per-instrument isolated account,
            otherwise `false`
    ClosedPosition:
      type: object
      description: Closed position history record
      properties:
        owner:
          type: string
          description: Owner public key (base58)
        symbol:
          type: string
          description: Market symbol
        quantity:
          type: number
          description: Closed position size (signed; long=positive, short=negative)
        maxQuantity:
          type: number
          description: Legacy alias of quantity (kept for backward compatibility)
        totalVolume:
          type: number
          description: Total traded volume over position lifetime
        avgOpenPrice:
          type: number
          description: Volume-weighted average entry price
        avgClosePrice:
          type: number
          description: Volume-weighted average exit price
        realizedPnl:
          type: number
          description: Total realized profit/loss
        fees:
          type: number
          description: Total fees paid
        funding:
          type: number
          description: Total funding payments (positive=received, negative=paid)
        openTime:
          type: integer
          format: int64
          description: Position open timestamp (nanoseconds)
        closeTime:
          type: integer
          format: int64
          description: Position close timestamp (nanoseconds)
        closeReason:
          $ref: '#/components/schemas/CloseReason'
        iso:
          type: boolean
          description: >-
            `true` if this row belongs to a per-instrument isolated account,
            otherwise `false`
    FundingPayment:
      type: object
      description: Funding payment record
      properties:
        owner:
          type: string
          description: Owner public key (base58)
        symbol:
          type: string
          description: Market symbol
        size:
          type: number
          description: Position size at time of funding (positive=long, negative=short)
        payment:
          type: number
          description: Funding payment amount in USD (positive=received, negative=paid)
        fundingRate:
          type: number
          description: Applied funding rate
        markPrice:
          type: number
          description: Fair price at time of funding
        slot:
          type: integer
          format: int64
          description: Slot number when funding was applied
        timestamp:
          type: integer
          format: int64
          description: Timestamp (nanoseconds)
        iso:
          type: boolean
          description: >-
            `true` if this row belongs to a per-instrument isolated account,
            otherwise `false`
    OrderHistoryEntry:
      type: object
      description: Terminal order history record
      properties:
        orderId:
          type: string
          description: Order ID (base58)
        symbol:
          type: string
          description: Market symbol
        side:
          type: string
          enum:
            - buy
            - sell
          description: Order side
        orderType:
          type: string
          enum:
            - limit
            - market
            - stop
            - stopLimit
            - takeProfit
            - range
            - trigger
            - trailing
          description: Order type
        tif:
          type: string
          enum:
            - gtc
            - ioc
            - postOnly
          description: Time in force
        price:
          type: number
          description: Order price
        vwap:
          type: number
          description: Volume-weighted average fill price (0 if no fills)
        originalSize:
          type: number
          description: Original order size
        executedSize:
          type: number
          description: Amount filled
        reduceOnly:
          type: boolean
          description: Whether order was reduce-only
        status:
          type: string
          enum:
            - filled
            - partiallyFilled
            - cancelled
            - cancelledRiskLimit
            - cancelledSelfCrossing
            - cancelledReduceOnly
            - cancelledIoc
            - rejectedInvalid
            - rejectedRiskLimit
            - rejectedCrossing
            - rejectedDuplicate
          description: Terminal order status
        trigger:
          allOf:
            - $ref: '#/components/schemas/TriggerSpec'
          nullable: true
          description: Trigger metadata for conditional/trigger orders, otherwise `null`
        reason:
          type: string
          nullable: true
          description: Rejection/cancellation reason (optional)
        slot:
          type: integer
          format: int64
          description: Slot number when order became terminal
        timestamp:
          type: integer
          format: int64
          description: Timestamp (nanoseconds)
        iso:
          type: boolean
          description: >-
            `true` if this row belongs to a per-instrument isolated account,
            otherwise `false`
    ActivityHistoryEntry:
      type: object
      description: Account activity history row (transfers, deposits)
      properties:
        activityType:
          type: string
          enum:
            - transferInternal
            - transferExternal
            - deposit
            - withdrawal
            - unknown
        status:
          type: string
          enum:
            - completed
            - failed
            - ongoing
            - unknown
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
        reason:
          type: string
          nullable: true
          description: Optional failure/details string
        iso:
          type: boolean
          description: '`true` if the row belongs to an implicit isolated-lane owner stream'
        slot:
          type: integer
          format: int64
        timestamp:
          type: integer
          format: int64
          description: Event timestamp (nanoseconds)
        sequence:
          type: integer
          format: int64
    RiskHistoryEntry:
      type: object
      description: 'Liquidation or ADL risk event row (returned by `type: "riskHistory"`)'
      properties:
        owner:
          type: string
          description: Account pubkey on which the event was recorded (base58)
        symbol:
          type: string
        isBuy:
          type: boolean
          description: Direction of the risk fill
        amount:
          type: number
        price:
          type: number
        eventType:
          type: string
          enum:
            - liquidation
            - adl
        marginPrior:
          type: number
          description: Margin balance before this risk event
        marginAfter:
          type: number
          description: Margin balance after this risk event
        reason:
          type: string
          nullable: true
          description: Optional human-readable reason (e.g. shortfall / underfill tagging)
        iso:
          type: boolean
          description: '`true` if the row belongs to a per-instrument isolated account'
        slot:
          type: integer
          format: int64
        timestamp:
          type: integer
          format: int64
          description: Event timestamp (nanoseconds)
        sequence:
          type: integer
          format: int64
    FeeTierAccountQuote:
      type: object
      description: >
        Account-only fee-tier quote returned by `POST /account` with `type:
        "feeTier"`.

        For global fee state (policy/schedule/settlement totals), use `GET
        /feeState`.
      properties:
        scopeInstrument:
          type: string
          description: >-
            Instrument scope resolved for this quote (`global` or a market
            symbol)
        rollingVolume:
          type: number
          description: Account rolling volume in resolved scope window
        tierIndex:
          type: integer
          format: int32
          description: Active tier index (0-based)
        tierThreshold:
          type: number
          description: Threshold volume of the active tier row
        makerBps:
          type: number
        takerBps:
          type: number
        windowDays:
          type: integer
          format: int32
          description: Rolling window length in days
    Margin:
      type: object
      description: Account-level margin and PnL
      properties:
        totalBalance:
          type: number
          description: Total account equity
        availableBalance:
          type: number
          description: Available for new orders (totalBalance - marginUsed)
        marginUsed:
          type: number
          description: Total maintenance margin requirement
        notional:
          type: number
          description: Total position notional value
        realizedPnl:
          type: number
          description: Total realized profit/loss
        unrealizedPnl:
          type: number
          description: Total unrealized profit/loss
        fees:
          type: number
          description: Total fees paid
        funding:
          type: number
          description: Total funding payments
    Position:
      type: object
      properties:
        symbol:
          type: string
          description: Market symbol
        size:
          type: number
          description: Position size (negative=short, positive=long)
        price:
          type: number
          description: Volume-weighted average entry price
        fairPrice:
          type: number
          description: Current fair/mark price
        notional:
          type: number
          description: Position notional value
        realizedPnl:
          type: number
          description: Realized profit/loss
        unrealizedPnl:
          type: number
          description: Unrealized profit/loss at current fair price
        leverage:
          type: number
          description: Effective leverage
        liquidationPrice:
          type: number
          description: Estimated liquidation price
        fees:
          type: number
          description: Fees paid on this position
        funding:
          type: number
          description: Funding payments for this position
        maintenanceMargin:
          type: number
          description: Maintenance margin requirement
        lambda:
          type: number
          description: Risk lambda parameter
        riskAllocation:
          type: number
          description: Fraction of portfolio risk allocated
        iso:
          type: boolean
          description: >-
            `true` if this row belongs to a per-instrument isolated account,
            otherwise `false`
        isoPubkey:
          type: string
          nullable: true
          description: >-
            Present only when `iso=true`; base58 pubkey of the per-instrument
            isolated account. Use **only** as `to` in an internal `transfer`
            action to top up isolated-account margin. Isolated-account pubkeys
            are not valid as `account` on transactions and are not valid `user`
            values for `POST /account`.
        protection:
          allOf:
            - $ref: '#/components/schemas/PositionProtection'
          nullable: true
          description: Optional attached reduce-only protective orders for this symbol
    PendingOnFillPlan:
      type: object
      properties:
        parentOrderId:
          type: string
          description: Parent resting order ID that activates these actions on first fill
        actions:
          type: array
          description: Consequent actions executed when parent order first fills
          items:
            type: object
    FeeTierQuote:
      type: object
      properties:
        symbol:
          type: string
          description: Scope symbol (`global` or market symbol)
        rollingVolume:
          type: number
        tierIndex:
          type: integer
          format: int32
        tierThreshold:
          type: number
        makerBps:
          type: number
        takerBps:
          type: number
        windowDays:
          type: integer
          format: int32
    LeverageEntry:
      type: object
      properties:
        symbol:
          type: string
          description: Market symbol
        leverage:
          type: number
          description: Maximum leverage (1.0 to 50.0)
    TriggerSpec:
      type: object
      properties:
        isAbove:
          type: boolean
          nullable: true
          description: Trigger direction when encoded
        px:
          type: number
          description: Trigger threshold price
        lim:
          type: number
          nullable: true
          description: Optional post-trigger limit price (`null` means market)
        oco:
          type: string
          nullable: true
          description: Optional linked OCO sibling order ID
        pxHi:
          type: number
          nullable: true
          description: Optional upper trigger threshold for range/OCO
        limHi:
          type: number
          nullable: true
          description: Optional upper post-trigger limit for range/OCO
        trb:
          type: integer
          format: uint32
          nullable: true
          description: Trailing distance in bps (trailing orders only)
        stb:
          type: integer
          format: uint32
          nullable: true
          description: Favorable reset step in bps (trailing orders only)
    CloseReason:
      type: string
      description: Reason for position closure
      enum:
        - normal
        - liquidation
        - adl
        - liquidation_sweep
    PositionProtection:
      type: object
      properties:
        orders:
          type: array
          description: Protective order references attached to this position
          items:
            $ref: '#/components/schemas/ProtectionOrderRef'
    ProtectionOrderRef:
      type: object
      properties:
        orderId:
          type: string
          description: Protective order ID (base58)
        orderType:
          type: string
          enum:
            - stop
            - takeProfit
            - range
            - trigger
            - trailing
          description: Conditional root order type
        trigger:
          allOf:
            - $ref: '#/components/schemas/TriggerSpec'
          nullable: true
          description: Conditional trigger metadata for this protective order
  responses:
    NotFound:
      description: Not Found - Symbol or account doesn't exist
    Timeout:
      description: Request Timeout - Executor didn't respond within 2s
    ServerError:
      description: Internal Server Error - Database or channel error

````