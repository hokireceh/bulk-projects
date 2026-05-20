> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Exchange Info

> Returns information about all available markets.


Returns information about all available markets including trading rules, precision, leverage limits, and supported order types.

<Note>
  The `timeInForces` array uses internal enum names. `ALO` corresponds to Post-Only orders on the API (`"postOnly"` in WebSocket account stream TIF fields). `STOP` and `TAKE_PROFIT` order types exist in the exchange info but are submitted as trigger orders - see [Conditional Orders](/bulk-exchange/conditional-orders).
</Note>


## OpenAPI

````yaml GET /exchangeInfo
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
  /exchangeInfo:
    get:
      tags:
        - Market Data
      summary: Get exchange info
      description: |
        Returns information about all available markets.
      operationId: getExchangeInfo
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/MarketInfo'
              example:
                - symbol: BTC-USD
                  baseAsset: BTC
                  quoteAsset: USDC
                  status: TRADING
                  pricePrecision: 1
                  sizePrecision: 8
                  tickSize: 0.5
                  lotSize: 0.001
                  minNotional: 10
                  maxLeverage: 10
                  orderTypes:
                    - LIMIT
                    - MARKET
                    - STOP
                    - TAKE_PROFIT
                    - RANGE
                    - TRIGGER
                    - TRAILING
                  timeInForces:
                    - GTC
                    - IOC
        '500':
          description: Internal server error
components:
  schemas:
    MarketInfo:
      type: object
      description: Market configuration and trading rules
      properties:
        symbol:
          type: string
          example: BTC-USD
        baseAsset:
          type: string
          description: Base currency
          example: BTC
        quoteAsset:
          type: string
          description: Quote currency
          example: USDC
        status:
          type: string
          enum:
            - TRADING
            - SUSPENDED
            - CLOSED
        pricePrecision:
          type: integer
          description: Decimal places for price
        sizePrecision:
          type: integer
          description: Decimal places for size
        tickSize:
          type: number
          description: Minimum price increment
        lotSize:
          type: number
          description: Minimum order size
        minNotional:
          type: number
          description: Minimum order value (price × size)
        maxLeverage:
          type: integer
          description: Maximum allowed leverage
        orderTypes:
          type: array
          items:
            type: string
            enum:
              - LIMIT
              - MARKET
              - STOP
              - STOP_LIMIT
              - TAKE_PROFIT
              - RANGE
              - TRIGGER
              - TRAILING
          description: Supported order types for this market.
        timeInForces:
          type: array
          items:
            type: string

````