> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Risk Surfaces

> Returns the complete risk configuration surface set for one market across all regimes.
This is a read-only snapshot endpoint and does not mutate state.


Returns the full risk-surface configuration for a market across all regimes, including margin requirements at different leverage levels and notional sizes.

* `market` accepts both coin and perp alias (`BTC` and `BTC-USD` are both valid)
* `surfaces` are sorted by `regime` ascending
* `corrs` are sorted by pair key for deterministic output

**Margin cell fields**: `mmrO` (maintenance margin ratio for opening), `mmrE` (for existing), `p` (portfolio margining penalty factor).


## OpenAPI

````yaml GET /riskSurfaces
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
  /riskSurfaces:
    get:
      tags:
        - Market Data
      summary: Get all regime risk surfaces for a market
      description: >
        Returns the complete risk configuration surface set for one market
        across all regimes.

        This is a read-only snapshot endpoint and does not mutate state.
      operationId: getRiskSurfaces
      parameters:
        - name: market
          in: query
          required: true
          description: Market symbol or coin symbol (for example `BTC-USD` or `BTC`)
          schema:
            type: string
            example: BTC-USD
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RiskSurfaces'
        '400':
          $ref: '#/components/responses/BadRequest'
        '404':
          $ref: '#/components/responses/NotFound'
        '408':
          $ref: '#/components/responses/Timeout'
        '500':
          $ref: '#/components/responses/ServerError'
components:
  schemas:
    RiskSurfaces:
      type: object
      description: Complete risk surfaces for a market across all regimes
      properties:
        symbol:
          type: string
          description: Market symbol
          example: BTC-USD
        liveRegime:
          type: integer
          description: Currently active regime index
        surfaces:
          type: array
          description: Regime surfaces sorted by regime ascending
          items:
            $ref: '#/components/schemas/RiskSurface'
        corrs:
          type: array
          description: Correlation tuples [pair, rho]
          items:
            type: array
            minItems: 2
            maxItems: 2
            items:
              oneOf:
                - type: string
                - type: number
    RiskSurface:
      type: object
      description: Risk surface for one regime
      properties:
        regime:
          type: integer
          description: Regime index
        leverage:
          type: array
          items:
            type: number
          description: Leverage knot points
        notionals:
          type: array
          items:
            type: number
          description: Notional knot points
        buy:
          type: array
          description: 2D buy-side grid [notional_idx][leverage_idx]
          items:
            type: array
            items:
              $ref: '#/components/schemas/RiskPoint'
        sell:
          type: array
          description: 2D sell-side grid [notional_idx][leverage_idx]
          items:
            type: array
            items:
              $ref: '#/components/schemas/RiskPoint'
    RiskPoint:
      type: object
      description: Risk point at a specific notional/leverage grid coordinate
      properties:
        mmrO:
          type: number
          description: Start-of-regime maintenance margin ratio
        mmrE:
          type: number
          description: End-of-regime maintenance margin ratio
        p:
          type: number
          description: Probability of remaining in regime
  responses:
    BadRequest:
      description: Bad Request - Invalid parameters or transaction type
    NotFound:
      description: Not Found - Symbol or account doesn't exist
    Timeout:
      description: Request Timeout - Executor didn't respond within 2s
    ServerError:
      description: Internal Server Error - Database or channel error

````