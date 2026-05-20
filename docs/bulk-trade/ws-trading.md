> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Trading via WebSocket

> Submit orders and other actions through WebSocket using the unified transaction format

<Note>
  All trading operations require Ed25519 signatures and a unique `nonce` for replay protection. See [Transaction Signing](/api-reference/signing) for the canonical message format and [Place & Cancel Orders](/api-reference/placeOrder) for the full transaction envelope.
</Note>

## Post Request Format

All order and trading-related operations use the `post` method with the **unified transaction** payload:

```json theme={null}
{
  "method": "post",
  "request": {
    "type": "action",
    "payload": {
      "actions": [Action, ...],
      "nonce": 1704067200000000000,
      "account": "base58_pubkey",
      "signer": "base58_pubkey",
      "signature": "base58_signature"
    }
  },
  "id": 1
}
```

**Transaction fields:**

| Field       | Description                                                                                |
| ----------- | ------------------------------------------------------------------------------------------ |
| `actions`   | Array of actions to execute atomically (see [Action types](#action-types) below)           |
| `nonce`     | Unique integer (u64) for replay protection (e.g. timestamp in nanoseconds)                 |
| `account`   | Account public key (base58) - whose account is being traded                                |
| `signer`    | Signer public key (base58) - who is signing (usually same as account, or authorized agent) |
| `signature` | Ed25519 signature (base58) over the signed message                                         |

**Signing:** The signed message is `bincode_serialize(actions) + nonce_le_u64 + account_pubkey_bytes`. Signer is not part of the signed message. See [Transaction Signing](/api-reference/signing) for details.

**Offchain signing (optional):** the server also accepts transactions signed with the [v0 Solana offchain envelope](/api-reference/signing#offchain-signing-mode) for any action shape. Set the WebSocket handshake header `x-bulk-sig-mode: offchain` on the upgrade and then send `post` actions normally - the `payload` JSON shape is unchanged, only the `signature` bytes differ. See [Optional Handshake Headers](/api-reference/ws-connection#optional-handshake-headers).

***

## Action Types

Each action in the `actions` array is a single-key object. The key is the action tag, the value is the action payload.

**Order and conditional actions:**

| Action | Description       | Example                                                                                                                             |
| ------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `l`    | Limit order       | `{"l": {"c": "BTC-USD", "b": true, "px": 100000.0, "sz": 0.1, "tif": "GTC", "r": false, "i": false}}`                               |
| `m`    | Market order      | `{"m": {"c": "BTC-USD", "b": true, "sz": 0.1, "r": false, "i": false}}`                                                             |
| `mod`  | Modify order size | `{"mod": {"oid": "base58_hash", "symbol": "BTC-USD", "amount": 0.05}}`                                                              |
| `cx`   | Cancel one order  | `{"cx": {"c": "BTC-USD", "oid": "base58_hash"}}`                                                                                    |
| `cxa`  | Cancel all orders | `{"cxa": {"c": ["BTC-USD"]}}` or `{"cxa": {"c": []}}` for all symbols                                                               |
| `st`   | Stop order        | `{"st": {"c": "BTC-USD", "d": false, "sz": 0.25, "tr": 98000.0, "lim": 97950.0, "i": false}}`                                       |
| `tp`   | Take profit       | `{"tp": {"c": "BTC-USD", "d": true, "sz": 0.25, "tr": 104000.0, "lim": 103950.0, "i": false}}`                                      |
| `rng`  | Range / OCO       | `{"rng": {"c": "BTC-USD", "d": true, "sz": 0.5, "pmin": 96000.0, "pmax": 106000.0, "lmin": 95950.0, "lmax": 105950.0, "i": false}}` |
| `trig` | Trigger basket    | `{"trig": {"c": "BTC-USD", "d": true, "tr": 105000.0, "i": false, "actions": [...]}}`                                               |
| `trl`  | Trailing stop     | `{"trl": {"c": "BTC-USD", "b": true, "sz": 0.25, "trb": 100, "stb": 10, "lim": null, "i": false}}`                                  |
| `of`   | On-fill           | `{"of": {"p": 0, "actions": [...]}}`                                                                                                |

The `i` flag is part of the canonical wincode message for every order/conditional action and must be included explicitly (omitting it produces a bad-signature error). `i=true` routes the order via the implicit per-instrument isolated account; `i=false` (the default in JSON examples) trades from cross margin on the `account` of the transaction.

**Account management actions:**

| Action                | Description                                                       | Example                                                                                                                          |
| --------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `createSubAccount`    | Create a sub-account (optional initial margin transfer)           | `{"createSubAccount": {"name": "desk-1", "marginSymbol": "USDC", "marginAmount": 1000.0}}`                                       |
| `removeSubAccount`    | Remove a sub-account (or auto-created isolated account) by pubkey | `{"removeSubAccount": {"toRemove": "base58_pubkey"}}`                                                                            |
| `renameSubAccount`    | Rename a sub-account                                              | `{"renameSubAccount": {"a": "base58_pubkey", "n": "desk-1"}}`                                                                    |
| `transfer`            | Move margin between accounts (internal/external/iso top-up)       | `{"transfer": {"k": "internal", "from": "base58_pubkey", "to": "base58_pubkey", "marginSymbol": "USDC", "marginAmount": 100.0}}` |
| `agentWalletCreation` | Register or revoke an agent wallet                                | `{"agentWalletCreation": {"a": "agent_pubkey", "d": false}}`                                                                     |
| `updateUserSettings`  | Update per-symbol max leverage                                    | `{"updateUserSettings": {"m": {"BTC-USD": 5.0}}}`                                                                                |
| `faucet`              | Request testnet quote (paper environments only)                   | `{"faucet": {"u": "base58_pubkey"}}`                                                                                             |

**Multisig actions:**

| Action           | Description                                               | Example                                                                                                                                               |
| ---------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createMultisig` | Create a multisig smart account                           | `{"createMultisig": {"signers": ["..."], "threshold": 2, "timeLockSecs": 60, "proposalLifetimeSecs": 604800}}`                                        |
| `msp`            | Propose a multisig action batch                           | `{"msp": {"m": "multisig_pubkey", "a": [{"transfer": {"k": "internal", "from": "...", "to": "...", "marginSymbol": "USDC", "marginAmount": 10.0}}]}}` |
| `msa`            | Approve a proposal                                        | `{"msa": {"m": "multisig_pubkey", "p": 7}}`                                                                                                           |
| `msr`            | Reject a proposal                                         | `{"msr": {"m": "multisig_pubkey", "p": 7}}`                                                                                                           |
| `msc`            | Cancel a proposal (proposer only, while pending)          | `{"msc": {"m": "multisig_pubkey", "p": 7}}`                                                                                                           |
| `mse`            | Execute a ready proposal                                  | `{"mse": {"m": "multisig_pubkey", "p": 7}}`                                                                                                           |
| `msu`            | Update multisig policy (only valid inside an `msp` batch) | `{"msu": {"m": "multisig_pubkey", "signers": ["..."], "threshold": 2, "timeLockSecs": 60, "proposalLifetimeSecs": 604800}}`                           |

For per-instrument isolated-account top-ups, set `transfer.to` to the `isoPubkey` from an `iso=true` open-position row on the [Account Stream](/api-reference/ws-account):

```json theme={null}
{"transfer": {"k": "internal", "from": "master_or_sub_pubkey", "to": "iso_pubkey", "marginSymbol": "USDC", "marginAmount": 100.0}}
```

`k="external"` recipient auto-create applies only to on-curve pubkeys; unknown off-curve recipients are rejected.

<Note>
  * `createSubAccount.marginAmount` and `transfer.marginAmount` must be JSON numbers (unquoted), e.g. `0` or `100.0`, not `"0"` or `"100.0"`.
  * `createMultisig.signers` and `msu.signers` accept base58 strings (preferred); raw `[u8;32]` arrays are also accepted for compatibility.
</Note>

See [Manage Sub-Accounts](/api-reference/manageSubAccounts), [Transfer](/api-reference/transfer), and [Multisig](/api-reference/createMultisig) for full envelope and result-row references; [Manage Agent Wallet](/api-reference/manageAgentWallet), [Update User Settings](/api-reference/updateUserSettings), and [Request Faucet](/api-reference/requestFaucet) cover the other shared envelopes. `updateUserSettings` uses `m` as an object map (e.g. `"m": {"BTC-USD": 10.0}`).

***

## Place Limit Order

<CodeGroup>
  ```json Request theme={null}
  {
    "method": "post",
    "request": {
      "type": "action",
      "payload": {
        "actions": [
          {"l": {"c": "BTC-USD", "b": true, "px": 100000.0, "sz": 0.1, "tif": "GTC", "r": false, "i": false}}
        ],
        "nonce": 1704067200000000000,
        "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signature": "5j7s...base58..."
      }
    },
    "id": 1
  }
  ```

  ```json Response (Resting) theme={null}
  {
    "type": "post",
    "id": 1,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{
              "resting": {
                "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F"
              }
            }]
          }
        }
      }
    }
  }
  ```

  ```json Response (Filled) theme={null}
  {
    "type": "post",
    "id": 1,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{
              "filled": {
                "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
                "totalSz": 0.1,
                "avgPx": 102500.0
              }
            }]
          }
        }
      }
    }
  }
  ```

  ```json Response (Partially Filled) theme={null}
  {
    "type": "post",
    "id": 1,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{
              "partiallyFilled": {
                "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
                "totalSz": 0.05,
                "avgPx": 102500.0
              }
            }]
          }
        }
      }
    }
  }
  ```

  ```json Response (Error) theme={null}
  {
    "type": "post",
    "id": 1,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{
              "error": {
                "message": "Insufficient margin"
              }
            }]
          }
        }
      }
    }
  }
  ```
</CodeGroup>

**Limit order (`l`) fields:** `c` (symbol), `b` (true = buy), `px` (limit price), `sz` (size), `tif` (time in force), `r` (reduce-only), `i` (isolated routing flag, required).

**Time in force:** `GTC` (good till cancel, rests on book), `IOC` (immediate or cancel), `ALO` (add liquidity only / post-only; rejects if would cross).

***

## Place Market Order

```json theme={null}
{
  "method": "post",
  "request": {
    "type": "action",
    "payload": {
      "actions": [
        {"m": {"c": "BTC-USD", "b": true, "sz": 0.1, "r": false, "i": false}}
      ],
      "nonce": 1704067200000000000,
      "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "signature": "5j7s...base58..."
    }
  },
  "id": 2
}
```

**Market order (`m`) fields:** `c` (symbol), `b` (true = buy), `sz` (size), `r` (reduce-only), `i` (isolated routing flag, required).

***

## Modify Order

Change the size of an existing order:

```json theme={null}
{
  "method": "post",
  "request": {
    "type": "action",
    "payload": {
      "actions": [
        {"mod": {"oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F", "symbol": "BTC-USD", "amount": 0.05}}
      ],
      "nonce": 1704067200000000000,
      "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "signature": "5j7s...base58..."
    }
  },
  "id": 3
}
```

**Modify (`mod`) fields:** `oid` (order ID, base58), `symbol`, `amount` (new size).

***

## Cancel Order

<CodeGroup>
  ```json Request theme={null}
  {
    "method": "post",
    "request": {
      "type": "action",
      "payload": {
        "actions": [
          {"cx": {"c": "BTC-USD", "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F"}}
        ],
        "nonce": 1704067200000000000,
        "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signature": "5j7s...base58..."
      }
    },
    "id": 4
  }
  ```

  ```json Response theme={null}
  {
    "type": "post",
    "id": 4,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{
              "cancelled": {
                "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F"
              }
            }]
          }
        }
      }
    }
  }
  ```
</CodeGroup>

***

## Cancel All Orders

**Cancel all in one or more symbols:** use `cxa` with `c` = array of symbols.

**Cancel all across all symbols:** use `cxa` with `c` = `[]`.

<CodeGroup>
  ```json Cancel all in symbol(s) theme={null}
  {
    "method": "post",
    "request": {
      "type": "action",
      "payload": {
        "actions": [{"cxa": {"c": ["BTC-USD"]}}],
        "nonce": 1704067200000000000,
        "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signature": "5j7s...base58..."
      }
    },
    "id": 5
  }
  ```

  ```json Cancel all across all symbols theme={null}
  {
    "method": "post",
    "request": {
      "type": "action",
      "payload": {
        "actions": [{"cxa": {"c": []}}],
        "nonce": 1704067200000000001,
        "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signature": "5j7s...base58..."
      }
    },
    "id": 6
  }
  ```
</CodeGroup>

***

## Stop Order (`st`)

<CodeGroup>
  ```json Request theme={null}
  {
    "method": "post",
    "request": {
      "type": "action",
      "payload": {
        "actions": [
          {"st": {"c": "BTC-USD", "d": false, "sz": 0.25, "tr": 98000.0, "lim": 97950.0}}
        ],
        "nonce": 1704067200000000011,
        "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signature": "5j7s...base58..."
      }
    },
    "id": 11
  }
  ```

  ```json Response (Resting) theme={null}
  {
    "type": "post",
    "id": 11,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"resting": {"oid": "7kR2mQfENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"}}]
          }
        }
      }
    }
  }
  ```
</CodeGroup>

**Stop order (`st`) fields:** `c` (symbol), `d` (trigger direction: `true` = above/equal, `false` = below/equal), `sz` (size), `tr` (trigger price), `lim` (optional limit after trigger; omit for market-style).

***

## Take Profit (`tp`)

<CodeGroup>
  ```json Request theme={null}
  {
    "method": "post",
    "request": {
      "type": "action",
      "payload": {
        "actions": [
          {"tp": {"c": "BTC-USD", "d": true, "sz": 0.25, "tr": 104000.0, "lim": 103950.0}}
        ],
        "nonce": 1704067200000000012,
        "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signature": "5j7s...base58..."
      }
    },
    "id": 12
  }
  ```

  ```json Response (Resting) theme={null}
  {
    "type": "post",
    "id": 12,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"resting": {"oid": "8mT3nQgGPjHFX7vNrAShxnk0hqoc96FhVdAb6Fn5QRi8"}}]
          }
        }
      }
    }
  }
  ```
</CodeGroup>

Same fields as Stop Order (`st`).

***

## Range / OCO (`rng`)

<CodeGroup>
  ```json Request theme={null}
  {
    "method": "post",
    "request": {
      "type": "action",
      "payload": {
        "actions": [
          {"rng": {"c": "BTC-USD", "d": true, "sz": 0.5, "pmin": 96000.0, "pmax": 106000.0, "lmin": 95950.0, "lmax": 105950.0}}
        ],
        "nonce": 1704067200000000013,
        "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signature": "5j7s...base58..."
      }
    },
    "id": 13
  }
  ```

  ```json Response (Resting) theme={null}
  {
    "type": "post",
    "id": 13,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"resting": {"oid": "9nU4oRhHQkIGY8wOrBTiypn1irpd07GiWeBC7Go6RSj9"}}]
          }
        }
      }
    }
  }
  ```

  ```json Response (Triggered) theme={null}
  {
    "type": "post",
    "id": 13,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"triggered": {"oid": "9nU4oRhHQkIGY8wOrBTiypn1irpd07GiWeBC7Go6RSj9"}}]
          }
        }
      }
    }
  }
  ```

  ```json Response (Sibling Cancelled) theme={null}
  {
    "type": "post",
    "id": 13,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"siblingCancelled": {"oid": "ABC123..."}}]
          }
        }
      }
    }
  }
  ```
</CodeGroup>

**Range/OCO (`rng`) fields:** `c` (symbol), `d` (position direction: `true` = long collar, `false` = short), `sz` (size), `pmin`/`pmax` (lower/upper trigger), `lmin`/`lmax` (optional limits for each leg).

When one leg triggers, the sibling leg is auto-cancelled with status `siblingCancelled`.

***

## Trigger Basket (`trig`)

<CodeGroup>
  ```json Request theme={null}
  {
    "method": "post",
    "request": {
      "type": "action",
      "payload": {
        "actions": [
          {"trig": {"c": "BTC-USD", "d": true, "tr": 105000.0, "actions": [
            {"m": {"c": "BTC-USD", "b": true, "sz": 0.1, "r": false}},
            {"cx": {"c": "BTC-USD", "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F"}}
          ]}}
        ],
        "nonce": 1704067200000000014,
        "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signature": "5j7s...base58..."
      }
    },
    "id": 14
  }
  ```

  ```json Response (Resting) theme={null}
  {
    "type": "post",
    "id": 14,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"resting": {"oid": "AoV5pSiIRlJHZ9xPsCUjzqo2jsqe18HjXfCD8Hp7STk0"}}]
          }
        }
      }
    }
  }
  ```

  ```json Response (Triggered) theme={null}
  {
    "type": "post",
    "id": 14,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"triggered": {"oid": "AoV5pSiIRlJHZ9xPsCUjzqo2jsqe18HjXfCD8Hp7STk0"}}]
          }
        }
      }
    }
  }
  ```

  ```json Response (Trigger Failed) theme={null}
  {
    "type": "post",
    "id": 14,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"triggerFailed": {"oid": "AoV5pSiIRlJHZ9xPsCUjzqo2jsqe18HjXfCD8Hp7STk0", "reason": "conditional execution failed: no counterparty"}}]
          }
        }
      }
    }
  }
  ```
</CodeGroup>

**Trigger basket (`trig`) fields:** `c` (symbol), `d` (trigger direction: `true` = above/equal), `tr` (trigger threshold), `actions` (nested actions executed when trigger fires).

Nested actions support: `m`, `l`, `mod`, `cx`, `cxa`, `st`, `tp`, `rng`, `trl`.

***

## Trailing Stop (`trl`)

<CodeGroup>
  ```json Request theme={null}
  {
    "method": "post",
    "request": {
      "type": "action",
      "payload": {
        "actions": [
          {"trl": {"c": "BTC-USD", "b": true, "sz": 0.25, "trb": 100, "stb": 10, "lim": null}}
        ],
        "nonce": 1704067200000000015,
        "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signature": "5j7s...base58..."
      }
    },
    "id": 15
  }
  ```

  ```json Response (Resting) theme={null}
  {
    "type": "post",
    "id": 15,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"resting": {"oid": "BpW6qTjJSkKIA0yQtDVkAro3ktrf29IkYgED9Iq8UUl1"}}]
          }
        }
      }
    }
  }
  ```
</CodeGroup>

**Trailing stop (`trl`) fields:** `c` (symbol), `b` (protected direction: `true` = long), `sz` (size), `trb` (trailing distance in bps), `stb` (favorable reset step in bps), `lim` (optional limit; `null` for market-style).

***

## On-Fill (`of`)

<CodeGroup>
  ```json Request (Limit + On-Fill Stop) theme={null}
  {
    "method": "post",
    "request": {
      "type": "action",
      "payload": {
        "actions": [
          {"l": {"c": "BTC-USD", "b": true, "px": 100000.0, "sz": 0.25, "tif": "GTC", "r": false}},
          {"of": {"p": 0, "actions": [
            {"st": {"c": "BTC-USD", "d": false, "sz": 0.25, "tr": 98000.0, "lim": null}}
          ]}}
        ],
        "nonce": 1704067200000000016,
        "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
        "signature": "5j7s...base58..."
      }
    },
    "id": 16
  }
  ```

  ```json Response (Resting + On-Fill Registered) theme={null}
  {
    "type": "post",
    "id": 16,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [
              {"resting": {"oid": "CqX7rUkKTmLJB1zRuEWlBsp4lusg30JlZhFE0Jr9VVm2"}},
              {"resting": {"oid": "DrY8sVlLUnMKC2ASvFXmCtp5mvth41KmaiGF1Ks0WWn3"}}
            ]
          }
        }
      }
    }
  }
  ```
</CodeGroup>

**On-fill (`of`) fields:** `p` (parent action index, 0-based), `actions` (one-shot consequents executed on first fill of parent).

Nested actions support: `m`, `l`, `mod`, `cx`, `cxa`, `st`, `tp`, `rng`, `trig`, `trl`.

<Note>
  **Cancelling conditional orders**: Use `cx` with the conditional order ID or `cxa` to cancel all orders including conditionals.
</Note>

***

## Batch Actions

Multiple actions can be combined in a single transaction (same `nonce`, `account`, `signer`, `signature`). One status is returned per action/event.

**Example: cancel one order and place two new limit orders**

```json theme={null}
{
  "method": "post",
  "request": {
    "type": "action",
    "payload": {
      "actions": [
        {"cx": {"c": "BTC-USD", "oid": "old_order_id_base58"}},
        {"l": {"c": "BTC-USD", "b": true, "px": 99900.0, "sz": 0.05, "tif": "GTC", "r": false}},
        {"l": {"c": "BTC-USD", "b": false, "px": 100100.0, "sz": 0.05, "tif": "GTC", "r": false}}
      ],
      "nonce": 1704067200000000000,
      "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "signature": "5j7s...base58..."
    }
  },
  "id": 7
}
```

***

## Response Format

| Field                                 | Description                                       |
| ------------------------------------- | ------------------------------------------------- |
| `type`                                | Always `"post"` for trading responses             |
| `id`                                  | Request ID (matches the request)                  |
| `data.type`                           | Always `"action"`                                 |
| `data.payload.status`                 | `"ok"` or `"error"`                               |
| `data.payload.response.type`          | Response type (e.g., `"order"`)                   |
| `data.payload.response.data.statuses` | Array of status objects (one per execution event) |

<Tip>
  Size fields in responses (`totalSz`, `filledSz`, `remainingSz`) are **signed**: negative values indicate sell-side. For example, a fully-filled sell of 0.1 BTC returns `totalSz: -0.1`.
</Tip>

***

## Status Types

### Non-Terminal (Order Still Active)

| Status      | Description                      | Fields                               |
| ----------- | -------------------------------- | ------------------------------------ |
| `resting`   | Order placed and resting on book | `{oid}`                              |
| `working`   | Partial fills, still resting     | `{oid, filledSz, remainingSz, vwap}` |
| `triggered` | Conditional root fired           | `{oid}`                              |

### Terminal (Order Complete)

| Status                  | Description                         | Fields                  |
| ----------------------- | ----------------------------------- | ----------------------- |
| `filled`                | Order fully filled                  | `{oid, totalSz, avgPx}` |
| `partiallyFilled`       | Partially filled and terminal       | `{oid, totalSz, avgPx}` |
| `cancelled`             | Cancelled by user                   | `{oid}`                 |
| `cancelledRiskLimit`    | Cancelled - risk limit              | `{oid, reason?}`        |
| `cancelledSelfCrossing` | Cancelled - self-crossing (STP)     | `{oid}`                 |
| `cancelledReduceOnly`   | Cancelled - would increase position | `{oid}`                 |
| `cancelledIoc`          | IOC expired without full fill       | `{oid, filledSz}`       |
| `rejectedCrossing`      | Post-only rejected for crossing     | `{oid}`                 |
| `rejectedDuplicate`     | Duplicate order ID                  | `{oid}`                 |
| `rejectedRiskLimit`     | Rejected - risk limit               | `{oid, reason?}`        |
| `rejectedInvalid`       | Invalid parameters                  | `{oid, reason?}`        |
| `siblingCancelled`      | OCO sibling auto-cancelled          | `{oid}`                 |
| `triggerFailed`         | Trigger execution failed            | `{oid, reason?}`        |
| `deposit`               | Faucet deposit succeeded            | `{amount}`              |
| `depositFailed`         | Faucet deposit failed               | `{message}`             |
| `agentWallet`           | Agent wallet registered             | `{agentWallet}`         |
| `agentWalletFailed`     | Agent wallet failed                 | `{message}`             |
| `cancelOneRejected`     | Cancel rejected                     | `{oid, reason}`         |
| `cancelAllRejected`     | Cancel all rejected                 | `{reason}`              |
| `error`                 | Generic error                       | `{message}`             |

***

## Response Examples

<CodeGroup>
  ```json Working (partial fill, sell side) theme={null}
  {
    "type": "post",
    "id": 1,
    "data": {
      "type": "action",
      "payload": {
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
    }
  }
  ```

  ```json Filled (buy side) theme={null}
  {
    "type": "post",
    "id": 1,
    "data": {
      "type": "action",
      "payload": {
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
    }
  }
  ```

  ```json Triggered (conditional) theme={null}
  {
    "type": "post",
    "id": 1,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"triggered": {"oid": "9nU4oRhHQkIGY8wOrBTiypn1irpd07GiWeBC7Go6RSj9"}}]
          }
        }
      }
    }
  }
  ```

  ```json Cancelled Risk Limit theme={null}
  {
    "type": "post",
    "id": 1,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{
              "cancelledRiskLimit": {
                "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
                "reason": "Position would exceed max leverage"
              }
            }]
          }
        }
      }
    }
  }
  ```

  ```json IOC Cancelled (partial fill) theme={null}
  {
    "type": "post",
    "id": 1,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{
              "cancelledIoc": {
                "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
                "filledSz": 0.03
              }
            }]
          }
        }
      }
    }
  }
  ```

  ```json Sibling Cancelled (OCO) theme={null}
  {
    "type": "post",
    "id": 1,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"siblingCancelled": {"oid": "DEF..."}}]
          }
        }
      }
    }
  }
  ```

  ```json Trigger Failed theme={null}
  {
    "type": "post",
    "id": 1,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"triggerFailed": {"oid": "GHI...", "reason": "conditional execution failed: no counterparty"}}]
          }
        }
      }
    }
  }
  ```

  ```json Error theme={null}
  {
    "type": "post",
    "id": 1,
    "data": {
      "type": "action",
      "payload": {
        "status": "ok",
        "response": {
          "type": "order",
          "data": {
            "statuses": [{"error": {"message": "Insufficient margin"}}]
          }
        }
      }
    }
  }
  ```
</CodeGroup>

***

## Order Updates (Account Stream)

In addition to the inline `post` response, all order state changes are delivered as `orderUpdate` messages on the [Account Stream](/api-reference/ws-account). These carry the full order state with signed sizes.

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
  "topic": "account.9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt"
}
```

### orderUpdate Fields

| Field           | Description                                                                         |
| --------------- | ----------------------------------------------------------------------------------- |
| `ot`            | Order type: `limit`, `market`, `stop`, `takeProfit`, `range`, `trigger`, `trailing` |
| `status`        | Order status (see [Status Types](#status-types))                                    |
| `sym`           | Market symbol                                                                       |
| `oid`           | Order ID (base58)                                                                   |
| `px`            | Order price (or trigger reference price)                                            |
| `origSz`        | **Signed** original order size (negative = sell)                                    |
| `sz`            | **Signed** current remaining size (negative = sell)                                 |
| `fillSz`        | Amount filled                                                                       |
| `vwap`          | Volume-weighted average fill price                                                  |
| `tif`           | Time in force: `gtc`, `ioc`, `postOnly`                                             |
| `r`             | Reduce-only flag                                                                    |
| `mk`            | Maker/resting flag                                                                  |
| `trigger`       | Trigger metadata for conditionals (see below), or `null`                            |
| `pendingOnFill` | On-fill registration attached to parent while awaiting first fill, or absent        |
| `ts`            | Event timestamp (nanoseconds)                                                       |
| `reason`        | Rejection/cancellation reason (optional)                                            |

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

### orderUpdate Examples

<CodeGroup>
  ```json Sell Limit Resting (signed size) theme={null}
  {
    "type": "account",
    "data": {
      "type": "orderUpdate",
      "ot": "limit",
      "status": "resting",
      "sym": "BTC-USD",
      "oid": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
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
    "topic": "account.9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt"
  }
  ```

  ```json Filled (buy side) theme={null}
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
    "topic": "account.9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt"
  }
  ```

  ```json Stop Resting (with trigger metadata) theme={null}
  {
    "type": "account",
    "data": {
      "type": "orderUpdate",
      "ot": "stop",
      "status": "resting",
      "sym": "BTC-USD",
      "oid": "7kR2mQfENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
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
    "topic": "account.9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt"
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
      "oid": "9nU4oRhHQkIGY8wOrBTiypn1irpd07GiWeBC7Go6RSj9",
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
    "topic": "account.9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt"
  }
  ```

  ```json Sibling Cancelled (OCO) theme={null}
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
    "topic": "account.9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt"
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
    "topic": "account.9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt"
  }
  ```
</CodeGroup>

### Fill Event

Emitted separately on each trade execution (in addition to `orderUpdate`):

```json theme={null}
{
  "type": "account",
  "data": {
    "type": "fill",
    "symbol": "BTC-USD",
    "orderId": "Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F",
    "price": 102000.0,
    "size": 0.05,
    "isBuy": true,
    "timestamp": 1763316177219383423,
    "maker": false
  },
  "topic": "account.FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
}
```

See [Account Stream](/api-reference/ws-account) for the full account stream reference.

***

## Error Handling

<AccordionGroup>
  <Accordion title="Invalid signature">
    Ensure you're using the correct serialization format including `nonce`. Use official SDKs when possible.
  </Accordion>

  <Accordion title="Unauthorized signer">
    `signer` must be one of: the `account` itself, an agent wallet registered on `account`, or (when `account` is a sub-account) an agent wallet registered on the parent master. Agents registered on a master can sign for the master and for any of its sub-accounts and per-instrument isolated accounts. Sub-accounts can also register their own agents. Isolated accounts are never used as `account`; their margin and orders are reached via `i=true` on order actions and the `to` field of a `transfer`. See [Manage Agent Wallet](/api-reference/manageAgentWallet).
  </Accordion>

  <Accordion title="Insufficient margin">
    Check your available balance before placing orders. Consider position size and leverage.
  </Accordion>

  <Accordion title="Duplicate nonce">
    Each nonce can only be used once. Use nanosecond timestamps: `BigInt(Date.now()) * 1_000_000n`.
  </Accordion>

  <Accordion title="Order rejected">
    Verify order parameters meet market requirements (min size, tick size, etc).
  </Accordion>
</AccordionGroup>
