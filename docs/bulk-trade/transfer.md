> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Transfer (Signed)

> Move margin between accounts (internal, external, isolated-account top-up) via the unified transaction endpoint

Transfers use the **unified** `POST /order` endpoint. Send a transaction with a single `transfer` action. Conceptual background lives on the [Protocol Native Asset Transfer](/architecture/transfers) page.

<Note>
  A transfer is rejected if it would push the source account into liquidation territory. The protocol bounds withdrawable amount by `min(equity − 1.05 × MM, marginPnl)`.
</Note>

***

## Transaction Envelope

```json theme={null}
{
  "actions": [Action],
  "nonce": 1704067200000,
  "account": "authorizing_pubkey_base58",
  "signer": "authorizing_pubkey_base58",
  "signature": "base58_signature"
}
```

The `account` and `signer` must be the authorizing account:

* `internal`: must be the master account that owns both `from` and `to`.
* `external`: must be the account that owns the source.

***

## Transfer Action (`transfer`)

```json theme={null}
{
  "actions": [
    {"transfer": {
      "k": "internal",
      "from": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
      "to": "8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR",
      "marginSymbol": "USDC",
      "marginAmount": 100.0
    }}
  ],
  "nonce": 1704067200000,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

| Field          | Type   | Description                                                                                                                          |
| -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `k`            | string | Transfer kind: `"internal"` (default) or `"external"`.                                                                               |
| `from`         | string | Source account pubkey (base58).                                                                                                      |
| `to`           | string | Destination account pubkey (base58). For per-instrument isolated-account top-ups, use the `isoPubkey` of an `iso=true` position row. |
| `marginSymbol` | string | Margin asset symbol (e.g. `"USDC"`).                                                                                                 |
| `marginAmount` | number | Margin amount to transfer. **Must be a JSON number (unquoted)**, e.g. `100.0` not `"100.0"`.                                         |

***

## Transfer Kinds

### Internal

Move margin between accounts that share the same master (master to sub-account, sub-account to sub-account, master to a per-instrument isolated account, and back). No minimum amount.

```json theme={null}
{"transfer": {
  "k": "internal",
  "from": "MASTER_PUBKEY",
  "to": "SUB_OR_ISO_PUBKEY",
  "marginSymbol": "USDC",
  "marginAmount": 100.0
}}
```

### Isolated-account top-up

To add margin to a per-instrument [isolated account](/bulk-exchange/isolated-margin), set `to` to the `isoPubkey` returned on `iso=true` rows in the `fullAccount`/`positions` snapshot.

```json theme={null}
{"transfer": {
  "k": "internal",
  "from": "MASTER_OR_SUB_PUBKEY",
  "to": "ISO_ACCOUNT_PUBKEY",
  "marginSymbol": "USDC",
  "marginAmount": 100.0
}}
```

### External

Move margin to any account on the network. Subject to a per-symbol minimum amount.

```json theme={null}
{"transfer": {
  "k": "external",
  "from": "MASTER_PUBKEY",
  "to": "ANY_OTHER_PUBKEY",
  "marginSymbol": "USDC",
  "marginAmount": 50.0
}}
```

Notes:

* `external` supports recipient auto-create only when the destination is on-curve (a real Solana wallet).
* Unknown off-curve recipients are rejected; no implicit account creation.

***

## Response

Same `OrderResponse` envelope. Successful transfers emit a `transfer` status row; failures emit `transferFailed`.

<CodeGroup>
  ```json Success theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [
          {"transfer": {
            "from": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
            "to": "8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR",
            "symbol": "USDC",
            "amount": 100.0
          }}
        ]
      }
    }
  }
  ```

  ```json Failed theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [{"transferFailed": {"message": "below minimum"}}]
      }
    }
  }
  ```
</CodeGroup>

| Status           | Terminal | Fields                       |
| ---------------- | -------- | ---------------------------- |
| `transfer`       | Yes      | `{from, to, symbol, amount}` |
| `transferFailed` | Yes      | `{message}`                  |

***

## Common Error Messages

| Message                                  | Cause                                                              |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `no margin symbol`                       | The specified token symbol does not exist                          |
| `unknown margin symbol`                  | The symbol exists but is not a recognized security                 |
| `below minimum`                          | External transfer amount is below the per-symbol minimum           |
| `off-curve and does not exist`           | External transfer to an off-curve address with no protocol account |
| `not permissioned for internal transfer` | `from` or `to` is not in the signer's account tree                 |
| `source account not found`               | `from` does not exist                                              |

Failed transfers do not modify any account state.

***

## Margin-only Refresh

`transfer` (along with `createSubAccount` with margin move and `removeSubAccount`) triggers a same-tick margin/risk refresh on the touched accounts. The `OrderResponse` is returned synchronously, so the response may arrive before the corresponding [account stream](/api-reference/ws-account) delta.

***

## Before You Start

<Note>
  See [Transaction Signing](/api-reference/signing) for how to sign requests.

  **Nonce**: use a unique value (e.g. timestamp in nanoseconds): `BigInt(Date.now()) * 1_000_000n`.
</Note>


## OpenAPI

````yaml /api-reference/openapi-transfer.yaml POST /order
openapi: 3.0.3
info:
  title: Bulk Trade API - Transfer
  version: 1.0.0
servers:
  - url: https://exchange-api.bulk.trade/api/v1
    description: Production
security: []
paths:
  /order:
    post:
      tags:
        - Trading (Signed)
      summary: Transfer margin between accounts
      description: >
        Submit a signed transaction with a single **transfer** action. Supports

        `internal` transfers (between a master and its sub-accounts / isolated
        accounts)

        and `external` transfers (to any account on the network). Use

        `to = isoPubkey` from a position row to top up a per-instrument isolated
        account.

        See [Transaction Signing](/api-reference/signing) for signing details.
      operationId: submitTransfer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransactionTransfer'
            examples:
              internal:
                summary: Internal Transfer (master to sub-account)
                value:
                  actions:
                    - transfer:
                        k: internal
                        from: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                        to: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                        marginSymbol: USDC
                        marginAmount: 100
                  nonce: 1704067200000
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...
              isoTopUp:
                summary: Isolated-account top-up (to = isoPubkey from position row)
                value:
                  actions:
                    - transfer:
                        k: internal
                        from: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                        to: ISO_ACCOUNT_PUBKEY_BASE58
                        marginSymbol: USDC
                        marginAmount: 100
                  nonce: 1704067200002
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...
              external:
                summary: External Transfer
                value:
                  actions:
                    - transfer:
                        k: external
                        from: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                        to: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                        marginSymbol: USDC
                        marginAmount: 50
                  nonce: 1704067200001
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...
      responses:
        '200':
          description: Transfer accepted
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderResponse'
              examples:
                ok:
                  summary: Transfer succeeded
                  value:
                    status: ok
                    response:
                      type: order
                      data:
                        statuses:
                          - transfer:
                              from: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                              to: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                              symbol: USDC
                              amount: 100
                failed:
                  summary: Transfer failed
                  value:
                    status: ok
                    response:
                      type: order
                      data:
                        statuses:
                          - transferFailed:
                              message: below minimum
      x-codeSamples:
        - lang: bash
          label: Internal transfer (master to sub-account)
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"transfer":{"k":"internal","from":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","to":"8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR","marginSymbol":"USDC","marginAmount":100.0}}],"nonce":1704067200000,"account":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signer":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signature":"5j7s..."}'
        - lang: bash
          label: External transfer
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"transfer":{"k":"external","from":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","to":"5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux","marginSymbol":"USDC","marginAmount":50.0}}],"nonce":1704067200001,"account":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signer":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signature":"5j7s..."}'
components:
  schemas:
    TransactionTransfer:
      type: object
      description: Transaction with a single transfer action
      required:
        - actions
        - nonce
        - account
        - signer
        - signature
      properties:
        actions:
          type: array
          description: Must contain exactly one transfer action
          items:
            $ref: '#/components/schemas/TransferAction'
        nonce:
          type: integer
          format: int64
        account:
          type: string
          description: Authorizing account public key (base58)
        signer:
          type: string
          description: Signer public key (base58)
        signature:
          type: string
          description: Ed25519 signature (base58)
    OrderResponse:
      type: object
      properties:
        status:
          type: string
          enum:
            - ok
            - error
        response:
          type: object
          properties:
            type:
              type: string
            data:
              type: object
              properties:
                statuses:
                  type: array
                  items: {}
    TransferAction:
      type: object
      title: transfer
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
              default: internal
              description: Transfer kind
            from:
              type: string
              description: Source account pubkey (base58)
            to:
              type: string
              description: >-
                Destination account pubkey (base58). Use `isoPubkey` to top up a
                per-instrument isolated account.
            marginSymbol:
              type: string
              description: Margin asset symbol (e.g. `USDC`)
            marginAmount:
              type: number
              description: >-
                Margin amount to transfer. Must be a JSON number (unquoted),
                e.g. `100.0` not `"100.0"`.

````