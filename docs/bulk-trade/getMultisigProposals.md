> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Multisig Proposals

> Returns the full proposal list for a multisig account, including pending,
ready, executed, failed, expired, cancelled, and rejected entries.
Proposal `status` is a compact string (`pending`, `ready`, `executed`,
`failed`, `expired`, `cancelled`, `rejected`).
Returns `404` when `pubkey` is not a multisig account.


Returns the full proposal list for a multisig account, including pending, ready, executed, failed, expired, cancelled, and rejected proposals.

This is an **unsigned** read endpoint. Anyone can query proposals for any multisig pubkey.

* `status` is one of `pending`, `ready`, `executed`, `failed`, `expired`, `cancelled`, `rejected`.
* `actions` are the inner actions exactly as they were stored at proposal time.
* `approvals` / `rejections` are the signer pubkeys that voted; `approvalsCount` / `rejectionsCount` are convenience counters.
* `executeAfter` is the wall-clock timestamp (ms) after which a `ready` proposal becomes executable.
* `expiresAt` is the wall-clock timestamp (ms) at which the proposal expires if not executed.
* `error` is `null` unless the proposal terminated with `proposalFailed`.

Returns `404` if `pubkey` is not a multisig account.

For the lifecycle and the actions that drive it, see [Multisig](/api-reference/manageMultisig) and the conceptual [Multisig](/architecture/multisig) page.


## OpenAPI

````yaml GET /multisig/{pubkey}/proposals
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
  /multisig/{pubkey}/proposals:
    get:
      tags:
        - Account (Unsigned)
      summary: Get multisig proposals snapshot (unsigned)
      description: >
        Returns the full proposal list for a multisig account, including
        pending,

        ready, executed, failed, expired, cancelled, and rejected entries.

        Proposal `status` is a compact string (`pending`, `ready`, `executed`,

        `failed`, `expired`, `cancelled`, `rejected`).

        Returns `404` when `pubkey` is not a multisig account.
      operationId: getMultisigProposals
      parameters:
        - name: pubkey
          in: path
          required: true
          description: Multisig account pubkey (base58)
          schema:
            type: string
            example: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MultisigProposalsSnapshot'
              example:
                multisig: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                proposals:
                  - proposalId: 42
                    proposer: 9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt
                    createdAt: 1776700149433
                    executeAfter: 1776700209433
                    expiresAt: 1777304949433
                    approvals:
                      - 9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt
                    rejections: []
                    approvalsCount: 1
                    rejectionsCount: 0
                    status: pending
                    actions:
                      - transfer:
                          k: internal
                          from: 8XJUssn2TxLhJ9XEPwA9pvtVJAtpgEEa2uRQYnKCGJmh
                          to: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                          marginSymbol: USDC
                          marginAmount: 10
                    error: null
        '404':
          description: Not Found - Pubkey is not a multisig account
        '500':
          $ref: '#/components/responses/ServerError'
components:
  schemas:
    MultisigProposalsSnapshot:
      type: object
      description: >
        Full proposal list for a multisig account. Returned by `GET
        /multisig/{pubkey}/proposals`.
      required:
        - multisig
        - proposals
      properties:
        multisig:
          type: string
          description: Multisig account pubkey (base58)
        proposals:
          type: array
          items:
            $ref: '#/components/schemas/MultisigProposalRow'
    MultisigProposalRow:
      type: object
      description: One proposal row in the multisig snapshot
      properties:
        proposalId:
          type: integer
          format: uint64
        proposer:
          type: string
          description: Proposer pubkey (base58)
        createdAt:
          type: integer
          format: int64
          description: Proposal creation timestamp (ms)
        executeAfter:
          type: integer
          format: int64
          description: Earliest execution timestamp (ms) once threshold is met
        expiresAt:
          type: integer
          format: int64
          description: Proposal expiry timestamp (ms)
        approvals:
          type: array
          description: Pubkeys of signers that approved
          items:
            type: string
        rejections:
          type: array
          description: Pubkeys of signers that rejected
          items:
            type: string
        approvalsCount:
          type: integer
          format: uint32
        rejectionsCount:
          type: integer
          format: uint32
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
        actions:
          type: array
          description: Inner proposal actions exactly as stored at creation
          items:
            type: object
        error:
          type: string
          nullable: true
          description: Error message when `status` is `failed`
  responses:
    ServerError:
      description: Internal Server Error - Database or channel error

````