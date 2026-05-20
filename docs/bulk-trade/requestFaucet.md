> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Request Testnet Faucet (Signed)

> Request testnet funds via the unified transaction endpoint

<Note>
  This action is only available on paper / testnet environments. You can claim once every 24 hours per account.
</Note>

Faucet requests use the **unified** `POST /order` endpoint. Send a transaction with a `faucet` action in the `actions` array.

***

## Transaction Envelope

Every request to `POST /order` has this shape:

```json theme={null}
{
  "actions": [Action, ...],
  "nonce": 1704067200000,
  "account": "base58_pubkey",
  "signer": "base58_pubkey",
  "signature": "base58_signature"
}
```

For faucet, the action is a single `faucet` object.

***

## Faucet Action

| Field | Type   | Description                    |
| ----- | ------ | ------------------------------ |
| `u`   | string | Recipient public key (base58). |

***

## Request Example

```json theme={null}
{
  "actions": [
    {"faucet": {"u": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"}}
  ],
  "nonce": 1704067200000,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7sVt3k2YxPqH4w..."
}
```

***

## Response

Same `OrderResponse` format as other actions. Success returns a `deposit` status:

```json theme={null}
{
  "status": "ok",
  "response": {
    "type": "order",
    "data": {
      "statuses": [{"deposit": {"amount": 10000.0}}]
    }
  }
}
```

Failure returns `depositFailed`:

```json theme={null}
{
  "status": "ok",
  "response": {
    "type": "order",
    "data": {
      "statuses": [{"depositFailed": {"message": "Rate limit exceeded"}}]
    }
  }
}
```

***

## Before You Start

<Note>
  See the [Transaction Signing](/api-reference/signing) guide for how to sign your requests.

  **Nonce**: Use a unique value (e.g. timestamp in nanoseconds): `BigInt(Date.now()) * 1_000_000n`
</Note>


## OpenAPI

````yaml /api-reference/openapi-faucet.yaml POST /order
openapi: 3.0.3
info:
  title: Bulk Trade API - Faucet
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
      summary: Request testnet faucet funds
      description: >
        Submit a signed transaction with a single **faucet** action.

        Paper / testnet only; one claim per account every 24 hours. See
        [Transaction Signing](/api-reference/signing) for signing details.
      operationId: submitFaucet
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransactionFaucet'
            example:
              actions:
                - faucet:
                    u: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              nonce: 1704067200000
              account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              signature: 5j7s...base58...
      responses:
        '200':
          description: Faucet deposit result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderResponse'
              examples:
                success:
                  summary: Deposit success
                  value:
                    status: ok
                    response:
                      type: order
                      data:
                        statuses:
                          - deposit:
                              amount: 10000
                failed:
                  summary: Deposit failed (e.g. rate limit)
                  value:
                    status: ok
                    response:
                      type: order
                      data:
                        statuses:
                          - depositFailed:
                              message: Rate limit exceeded
      x-codeSamples:
        - lang: bash
          label: Request faucet
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"faucet":{"u":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"}}],"nonce":1704067200000,"account":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signer":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signature":"5j7s...base58..."}'
components:
  schemas:
    TransactionFaucet:
      type: object
      description: Transaction with a single faucet action
      required:
        - actions
        - nonce
        - account
        - signer
        - signature
      properties:
        actions:
          type: array
          description: Must contain exactly one faucet action
          items:
            $ref: '#/components/schemas/ActionFaucet'
        nonce:
          type: integer
          format: int64
          description: Unique nonce (e.g. nanoseconds)
        account:
          type: string
          description: Account public key (base58)
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
    ActionFaucet:
      type: object
      title: Faucet (faucet)
      required:
        - faucet
      properties:
        faucet:
          type: object
          required:
            - u
          properties:
            u:
              type: string
              description: Recipient public key (base58)

````