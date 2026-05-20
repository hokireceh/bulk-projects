> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Candles (OHLCV)

> Returns historical candlestick data for charting.

**Supported intervals**: 10s, 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M


Returns historical candlestick data for charting. Supports multiple timeframes from 10 seconds to 1 month.

**Supported intervals**: `10s`, `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `6h`, `8h`, `12h`, `1d`, `3d`, `1w`, `1M`

For real-time candle updates, use the WebSocket candle stream.


## OpenAPI

````yaml GET /klines
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
  /klines:
    get:
      tags:
        - Market Data
      summary: Get candle history (OHLCV)
      description: >
        Returns historical candlestick data for charting.


        **Supported intervals**: 10s, 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h,
        12h, 1d, 3d, 1w, 1M
      operationId: getKlines
      parameters:
        - $ref: '#/components/parameters/SymbolQuery'
        - $ref: '#/components/parameters/Interval'
        - $ref: '#/components/parameters/StartTime'
        - $ref: '#/components/parameters/EndTime'
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Candle'
        '500':
          $ref: '#/components/responses/ServerError'
components:
  parameters:
    SymbolQuery:
      name: symbol
      in: query
      required: true
      description: Market symbol
      schema:
        type: string
        example: BTC-USD
    Interval:
      name: interval
      in: query
      required: true
      description: Candle timeframe
      schema:
        type: string
        enum:
          - 10s
          - 1m
          - 3m
          - 5m
          - 15m
          - 30m
          - 1h
          - 2h
          - 4h
          - 6h
          - 8h
          - 12h
          - 1d
          - 3d
          - 1w
          - 1M
        example: 1m
    StartTime:
      name: startTime
      in: query
      required: false
      description: Start timestamp (milliseconds)
      schema:
        type: integer
        format: int64
    EndTime:
      name: endTime
      in: query
      required: false
      description: End timestamp (milliseconds)
      schema:
        type: integer
        format: int64
  schemas:
    Candle:
      type: object
      description: OHLCV candlestick data
      required:
        - t
        - T
        - o
        - h
        - l
        - c
        - v
        - 'n'
      properties:
        t:
          type: integer
          format: int64
          description: Open timestamp (ms)
        T:
          type: integer
          format: int64
          description: Close timestamp (ms)
        o:
          type: number
          description: Open price
        h:
          type: number
          description: High price
        l:
          type: number
          description: Low price
        c:
          type: number
          description: Close price
        v:
          type: number
          description: Volume
        'n':
          type: integer
          description: Number of trades
  responses:
    ServerError:
      description: Internal Server Error - Database or channel error

````