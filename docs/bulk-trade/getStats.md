> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Exchange Statistics

> Returns exchange statistics with optional symbol filtering.

All periods currently return 24h rolling stats. Aggregate queries (`symbol` omitted) are
cached with 600s TTL; symbol-specific queries bypass cache. The markets array is sorted by
`quoteVolume` descending.

**Period aliases accepted by server**:

| Alias | Canonical |
|---|---|
| `24h` | `1d` |
| `1w` | `7d` |
| `1m` | `30d` |
| `3m` | `90d` |
| `365d` | `1y` |


Returns exchange statistics with optional symbol and period filtering. Use for aggregate volume, open interest, funding rates, and per-market stats.

**Notes:**

* All periods currently return 24h rolling stats
* Aggregate queries (no `symbol`) are cached with 600s TTL
* Symbol-specific queries bypass cache
* Period aliases: `24h` → `1d`, `1w` → `7d`, `1m` → `30d`, `3m` → `90d`, `365d` → `1y`


## OpenAPI

````yaml GET /stats
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
  /stats:
    get:
      tags:
        - Market Data
      summary: Get exchange statistics
      description: >
        Returns exchange statistics with optional symbol filtering.


        All periods currently return 24h rolling stats. Aggregate queries
        (`symbol` omitted) are

        cached with 600s TTL; symbol-specific queries bypass cache. The markets
        array is sorted by

        `quoteVolume` descending.


        **Period aliases accepted by server**:


        | Alias | Canonical |

        |---|---|

        | `24h` | `1d` |

        | `1w` | `7d` |

        | `1m` | `30d` |

        | `3m` | `90d` |

        | `365d` | `1y` |
      operationId: getExchangeStats
      parameters:
        - name: period
          in: query
          required: false
          description: |
            Canonical period value.
            If omitted or invalid, defaults to `1d`.
          schema:
            type: string
            enum:
              - 1d
              - 7d
              - 30d
              - 90d
              - 1y
              - all
            default: 1d
          examples:
            default:
              value: 1d
            weekly:
              value: 7d
        - name: symbol
          in: query
          required: false
          description: Optional symbol filter (e.g. BTC-USD)
          schema:
            type: string
            example: BTC-USD
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ExchangeStats'
              examples:
                aggregate:
                  summary: Aggregate stats across all markets
                  value:
                    timestamp: 1704067200000
                    period: 1d
                    volume:
                      totalUsd: 126543210
                    openInterest:
                      totalUsd: 54321000
                    funding:
                      rates:
                        BTC-USD:
                          current: 0.0001
                          annualized: 0.1095
                        ETH-USD:
                          current: 0.00008
                          annualized: 0.0876
                    markets:
                      - symbol: BTC-USD
                        volume: 1234.56
                        quoteVolume: 126543210
                        openInterest: 487.8
                        fundingRate: 0.0001
                        fundingRateAnnualized: 0.1095
                        lastPrice: 102500
                        markPrice: 102480
                symbolFiltered:
                  summary: Symbol-filtered stats
                  value:
                    timestamp: 1704067200000
                    period: 7d
                    volume:
                      totalUsd: 126543210
                    openInterest:
                      totalUsd: 50000000
                    funding:
                      rates:
                        BTC-USD:
                          current: 0.0001
                          annualized: 0.1095
                    markets:
                      - symbol: BTC-USD
                        volume: 1234.56
                        quoteVolume: 126543210
                        openInterest: 487.8
                        fundingRate: 0.0001
                        fundingRateAnnualized: 0.1095
                        lastPrice: 102500
                        markPrice: 102480
                unknownSymbol:
                  summary: Unknown symbol still returns 200 with empty/zero stats
                  value:
                    timestamp: 1704067200000
                    period: 1d
                    volume:
                      totalUsd: 0
                    openInterest:
                      totalUsd: 0
                    funding:
                      rates: {}
                    markets: []
        '500':
          $ref: '#/components/responses/ServerError'
components:
  schemas:
    ExchangeStats:
      type: object
      description: Aggregate exchange statistics
      properties:
        timestamp:
          type: integer
          format: int64
          description: Server timestamp (milliseconds)
        period:
          type: string
          description: Requested period
          example: 1d
        volume:
          type: object
          properties:
            totalUsd:
              type: number
              description: Total volume in USD
        openInterest:
          type: object
          properties:
            totalUsd:
              type: number
              description: >-
                Sum of per-market open interest converted to USD using mark
                prices
        funding:
          type: object
          properties:
            rates:
              type: object
              description: Funding rates by market symbol
              additionalProperties:
                type: object
                properties:
                  current:
                    type: number
                    description: Current 8-hour funding rate
                  annualized:
                    type: number
                    description: Annualized funding rate
        markets:
          type: array
          description: Per-market breakdown (sorted by quoteVolume desc)
          items:
            type: object
            properties:
              symbol:
                type: string
              volume:
                type: number
                description: 24h volume in base currency
              quoteVolume:
                type: number
                description: 24h volume in USD
              openInterest:
                type: number
                description: Open interest in native market units (base/contracts)
              fundingRate:
                type: number
                description: Current 8-hour funding rate
              fundingRateAnnualized:
                type: number
                description: Annualized funding rate
              lastPrice:
                type: number
              markPrice:
                type: number
  responses:
    ServerError:
      description: Internal Server Error - Database or channel error

````