> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Update User Settings (Signed)

> Set per-symbol max leverage via the unified transaction endpoint

Leverage settings are updated via the **unified** `POST /order` endpoint. Send a transaction with an `updateUserSettings` action in the `actions` array.

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

For user settings, the action is a single `updateUserSettings` object.

***

## Settings Fields

### Max Leverage (`m`)

Object mapping symbol to maximum leverage (1.0–50.0). Cannot exceed the market’s configured maximum.

| Field | Type   | Description                                                              |
| ----- | ------ | ------------------------------------------------------------------------ |
| `m`   | object | Map of symbol → max\_leverage (e.g. `{"BTC-USD": 5.0, "ETH-USD": 3.0}`). |

**Constraints:**

* Leverage is clamped between `1.0` and `50.0`
* Cannot exceed the market’s configured maximum leverage
* Lower leverage reduces liquidation risk

***

## Request Example

```json theme={null}
{
  "actions": [
    {"updateUserSettings": {"m": {"BTC-USD": 5.0, "ETH-USD": 3.0}}}
  ],
  "nonce": 1704067200000,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5JXWgp1fW6px2Gjhw6YHhQ4wEqb6FqMam6m4yg4uRcCksH9WxSv9dVjizGfD4StGtv1z9gR71unZY6tQ6dNDdJ3K"
}
```

***

## Response

Same `OrderResponse` format as other actions. For update user settings, success returns an empty or applied status; settings are applied to the account.

```json theme={null}
{
  "status": "ok",
  "response": {
    "type": "order",
    "data": {
      "statuses": []
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

````yaml /api-reference/openapi-update-settings.yaml POST /order
openapi: 3.0.3
info:
  title: Bulk Trade API - Update User Settings
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
      summary: Update per-symbol max leverage
      description: >
        Submit a signed transaction with a single **updateUserSettings** action.

        Sets maximum leverage per symbol (1.0–50.0). See [Transaction
        Signing](/api-reference/signing) for signing details.
      operationId: submitUpdateUserSettings
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransactionUpdateSettings'
            example:
              actions:
                - updateUserSettings:
                    m:
                      BTC-USD: 5
                      ETH-USD: 3
              nonce: 1704067200000
              account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              signature: 5JXWgp1fW6px2Gjhw6YHhQ4...
      responses:
        '200':
          description: Settings applied
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderResponse'
              example:
                status: ok
                response:
                  type: order
                  data:
                    statuses: []
      x-codeSamples:
        - lang: bash
          label: Update leverage settings
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"updateUserSettings":{"m":{"BTC-USD":5.0,"ETH-USD":3.0}}}],"nonce":1704067200000,"account":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signer":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signature":"5JXWgp1fW6px2Gjhw6YHhQ4..."}'
components:
  schemas:
    TransactionUpdateSettings:
      type: object
      description: Transaction with a single updateUserSettings action
      required:
        - actions
        - nonce
        - account
        - signer
        - signature
      properties:
        actions:
          type: array
          description: Must contain exactly one updateUserSettings action
          items:
            $ref: '#/components/schemas/ActionUpdateSettings'
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
    ActionUpdateSettings:
      type: object
      title: Update user settings (updateUserSettings)
      required:
        - updateUserSettings
      properties:
        updateUserSettings:
          type: object
          required:
            - m
          properties:
            m:
              type: object
              description: Map of symbol to max leverage (1.0–50.0)
              additionalProperties:
                type: number
              example:
                BTC-USD: 5
                ETH-USD: 3

````