> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Get L2 Order Book

> Returns current order book snapshot with optional filtering.


Returns current order book snapshot with optional filtering by price levels and aggregation.

For real-time order book data:

* Use **L2 Snapshot** stream for periodic full snapshots (every 200ms)
* Use **L2 Delta** stream for real-time incremental updates (\< 1ms)


## OpenAPI

````yaml GET /l2book
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
  /l2book:
    get:
      tags:
        - Market Data
      summary: Get L2 order book
      description: |
        Returns current order book snapshot with optional filtering.
      operationId: getL2Book
      parameters:
        - name: type
          in: query
          required: true
          description: Must be "l2book"
          schema:
            type: string
            enum:
              - l2book
        - name: coin
          in: query
          required: true
          description: Market symbol
          schema:
            type: string
            example: BTC-USD
        - name: nlevels
          in: query
          required: false
          description: Number of price levels to return per side
          schema:
            type: integer
            example: 10
        - name: aggregation
          in: query
          required: false
          description: Price increment for aggregation (in quote currency)
          schema:
            type: number
            format: double
            example: 0.5
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BookUpdate'
        '400':
          $ref: '#/components/responses/BadRequest'
        '404':
          $ref: '#/components/responses/NotFound'
        '500':
          $ref: '#/components/responses/ServerError'
components:
  schemas:
    BookUpdate:
      type: object
      description: Order book snapshot or delta
      properties:
        updateType:
          type: string
          enum:
            - snapshot
            - delta
          description: >
            `snapshot` = full order book state (both sides populated).

            `delta` = incremental update (only one side has levels, other is an
            empty array).
        symbol:
          type: string
          description: Market symbol
        levels:
          type: array
          description: >
            Array with exactly 2 elements: `[bids, asks]`

            - Index 0: Bid levels (highest to lowest price)

            - Index 1: Ask levels (lowest to highest price)

            - For deltas: Only one side will have levels, the other will be an
            empty array `[]`
          minItems: 2
          maxItems: 2
          items:
            type: array
            items:
              $ref: '#/components/schemas/Level'
        timestamp:
          type: integer
          format: int64
          description: Timestamp in milliseconds
    Level:
      type: object
      description: Price level in order book
      properties:
        px:
          type: number
          description: Price level
        sz:
          type: number
          description: Total size at this price level
        'n':
          type: integer
          description: |
            Number of orders at this price level.
            - For snapshots: Actual count of orders
            - For deltas: Always `0` (order count not tracked in deltas)
  responses:
    BadRequest:
      description: Bad Request - Invalid parameters or transaction type
    NotFound:
      description: Not Found - Symbol or account doesn't exist
    ServerError:
      description: Internal Server Error - Database or channel error

````