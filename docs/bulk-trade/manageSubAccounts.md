> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Sub-Accounts (Signed)

> Create, rename, and remove sub-accounts via the unified transaction endpoint

Sub-account management uses the **unified** `POST /order` endpoint. Send a transaction with a single `createSubAccount`, `renameSubAccount`, or `removeSubAccount` action. Conceptual background lives on the [Sub-Accounts](/bulk-exchange/sub-accounts) page.

<Note>
  Sub-accounts are **off-curve** accounts. Their pubkeys are derived from the master and have no private key. Only the parent master can manage them.
</Note>

***

## Transaction Envelope

```json theme={null}
{
  "actions": [Action],
  "nonce": 1704067200000,
  "account": "master_pubkey_base58",
  "signer": "master_pubkey_base58",
  "signature": "base58_signature"
}
```

The `account` and `signer` must both be the master account that owns (or will own) the sub-account.

***

## Create Sub-Account (`createSubAccount`)

Create a named sub-account under the signing master. Optionally seed it with margin in the same atomic action.

Minimal (no initial margin):

```json theme={null}
{"createSubAccount": {"name": "desk-1"}}
```

With initial margin transfer:

```json theme={null}
{
  "actions": [
    {"createSubAccount": {"name": "desk-1", "marginSymbol": "USDC", "marginAmount": 1000.0}}
  ],
  "nonce": 1704067200000,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

| Field          | Type    | Description                                                                                                                                                      |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | string  | Sub-account display name. 1-32 chars, `A-Z a-z 0-9 - _`. Must be unique within the master's account tree.                                                        |
| `marginSymbol` | string? | Optional margin asset (e.g. `"USDC"`). Must be present when `marginAmount` is non-zero.                                                                          |
| `marginAmount` | number? | Optional initial margin transferred from master at creation. Default `0.0`. **Must be a JSON number (unquoted)**, e.g. `0` or `1000.0`, not `"0"` or `"1000.0"`. |

When both `marginSymbol` and `marginAmount` are provided, the protocol creates the sub-account and transfers margin from the master atomically. The master's withdrawable balance is checked before the transfer.

<Note>
  The newly generated sub-account pubkey is returned in the `createSubAccount` status row (see [Response](#response)), so clients can use it immediately without waiting for an account refresh.
</Note>

***

## Remove Sub-Account (`removeSubAccount`)

Remove a sub-account and sweep any remaining margin back to the master. The sub-account must have no open positions and no open orders.

```json theme={null}
{
  "actions": [
    {"removeSubAccount": {"toRemove": "8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR"}}
  ],
  "nonce": 1704067200001,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

| Field      | Type   | Description                                                               |
| ---------- | ------ | ------------------------------------------------------------------------- |
| `toRemove` | string | Sub-account pubkey to remove (base58). Must belong to the signing master. |

The same action also removes auto-created [isolated accounts](/bulk-exchange/isolated-margin) once they are flat (no open positions / orders).

***

## Rename Sub-Account (`renameSubAccount`)

Update the display name of an existing sub-account owned by the signing master. The pubkey is unchanged, so cached references and isolated-account links keep working.

```json theme={null}
{
  "actions": [
    {"renameSubAccount": {"a": "8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR", "n": "desk-2"}}
  ],
  "nonce": 1704067200002,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

| Field | Type   | Description                                                                                                                                                  |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `a`   | string | Sub-account pubkey to rename (base58). Must belong to the signing master.                                                                                    |
| `n`   | string | New display name. Same charset and length rules as `createSubAccount.name` (1-32 chars, `A-Z a-z 0-9 - _`). Must be unique within the master's account tree. |

The signing master can also rename its sub-accounts via an authorized agent wallet, following the same envelope rules as other account-management actions.

***

## Constraints

| Constraint                       | Value                         |
| -------------------------------- | ----------------------------- |
| Max sub-accounts per master      | 64                            |
| Max name length                  | 32 characters                 |
| Allowed name characters          | `A-Z`, `a-z`, `0-9`, `-`, `_` |
| Sub-accounts can create children | No (master-only)              |

***

## Response

Same `OrderResponse` envelope as other actions. Sub-account actions emit dedicated status rows:

<CodeGroup>
  ```json Created theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [
          {"createSubAccount": {
            "master": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
            "sub": "8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR",
            "name": "desk-1",
            "margin": 1000.0
          }}
        ]
      }
    }
  }
  ```

  ```json Removed theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [
          {"removeSubAccount": {
            "account": "8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR",
            "marginMoved": 1000.0
          }}
        ]
      }
    }
  }
  ```

  ```json Renamed theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [
          {"renameSubAccount": {
            "master": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
            "account": "8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR",
            "name": "desk-2"
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
        "statuses": [
          {"createSubAccountFailed": {"message": "duplicate name"}}
        ]
      }
    }
  }
  ```
</CodeGroup>

| Status                   | Terminal | Fields                        |
| ------------------------ | -------- | ----------------------------- |
| `createSubAccount`       | Yes      | `{master, sub, name, margin}` |
| `createSubAccountFailed` | Yes      | `{message}`                   |
| `removeSubAccount`       | Yes      | `{account, marginMoved}`      |
| `removeSubAccountFailed` | Yes      | `{message}`                   |
| `renameSubAccount`       | Yes      | `{master, account, name}`     |
| `renameSubAccountFailed` | Yes      | `{message}`                   |

<Note>
  The newly generated sub-account `pubkey` is returned in the `createSubAccount` status, so clients can use it immediately without waiting for an account refresh.
</Note>

***

## Listing Sub-Accounts

A master account's `fullAccount` snapshot includes a `subAccounts` array of `{pubkey, name?}` rows. See [Query Account](/api-reference/getAccount) for the full response shape.

***

## Trading From a Sub-Account

Sub-accounts can submit **any** signed action (orders, modify, cancel, on-fill, conditional baskets, transfers, agent wallets, user settings) the same way a master does. There is **no separate endpoint** and **no special action variant**.

To act on a sub-account, just set the transaction `account` field to the sub-account's pubkey while the master signs:

```json theme={null}
{
  "actions": [
    {"l": {"c": "BTC-USD", "b": true, "px": 100000.0, "sz": 0.1, "tif": "GTC", "r": false, "i": false}}
  ],
  "nonce": 1704067200000,
  "account": "8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7s..."
}
```

| Field       | Value                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account`   | Sub-account pubkey (the account being traded).                                                                                                                                                                                                                                                                                                                  |
| `signer`    | One of: the parent master, the sub-account itself, an [agent wallet](/api-reference/manageAgentWallet) registered on the parent master, or an agent wallet registered directly on the sub-account. Agents registered on a master automatically also work for that master's sub-accounts; sub-accounts can additionally register their own agents independently. |
| `signature` | Ed25519 over the canonical wincode binary. The signed bytes already include `account`, so the signature binds this transaction to the sub-account. See [Transaction Signing](/api-reference/signing).                                                                                                                                                           |

Notes:

* Margin, positions, open orders, fills, and risk for that transaction are evaluated on the **sub-account's** balance sheet, not the master's.
* All conditional and on-fill follow-ups attached to a sub-account order stay on that sub-account.
* Any other `signer` (not the master, not the sub-account itself, and not an authorized agent on either) returns `unauthorized signer`.
* To route a sub-account order into a per-instrument [isolated account](/bulk-exchange/isolated-margin) attached **to that sub-account**, set `i = true` on the order action. The isolated-account pubkey is never set as `account`.

***

## Before You Start

<Note>
  See [Transaction Signing](/api-reference/signing) for how to sign requests.

  **Nonce**: use a unique value (e.g. timestamp in nanoseconds): `BigInt(Date.now()) * 1_000_000n`.
</Note>


## OpenAPI

````yaml /api-reference/openapi-sub-accounts.yaml POST /order
openapi: 3.0.3
info:
  title: Bulk Trade API - Sub-Accounts
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
      summary: Create, rename, or remove a sub-account
      description: >
        Submit a signed transaction containing a single **createSubAccount**,

        **renameSubAccount**, or **removeSubAccount** action. Sub-accounts hold
        their

        own margin, positions, and orders evaluated independently by the risk
        engine.

        See [Transaction Signing](/api-reference/signing) for signing details.
      operationId: submitSubAccountAction
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransactionSubAccount'
            examples:
              createSubAccountMinimal:
                summary: Create Sub-Account (no initial margin)
                value:
                  actions:
                    - createSubAccount:
                        name: desk-1
                  nonce: 1704067200003
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...
              createSubAccount:
                summary: Create Sub-Account (with initial margin)
                value:
                  actions:
                    - createSubAccount:
                        name: desk-1
                        marginSymbol: USDC
                        marginAmount: 1000
                  nonce: 1704067200000
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...
              renameSubAccount:
                summary: Rename Sub-Account
                value:
                  actions:
                    - renameSubAccount:
                        a: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                        'n': desk-2
                  nonce: 1704067200002
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...
              removeSubAccount:
                summary: Remove Sub-Account
                value:
                  actions:
                    - removeSubAccount:
                        toRemove: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                  nonce: 1704067200001
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...
      responses:
        '200':
          description: Sub-account action accepted
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderResponse'
              examples:
                created:
                  summary: Sub-account created
                  value:
                    status: ok
                    response:
                      type: order
                      data:
                        statuses:
                          - createSubAccount:
                              master: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                              sub: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                              name: desk-1
                              margin: 1000
                renamed:
                  summary: Sub-account renamed
                  value:
                    status: ok
                    response:
                      type: order
                      data:
                        statuses:
                          - renameSubAccount:
                              master: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                              account: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                              name: desk-2
                removed:
                  summary: Sub-account removed
                  value:
                    status: ok
                    response:
                      type: order
                      data:
                        statuses:
                          - removeSubAccount:
                              account: 8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR
                              marginMoved: 1000
      x-codeSamples:
        - lang: bash
          label: Create sub-account (with initial margin)
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"createSubAccount":{"name":"desk-1","marginSymbol":"USDC","marginAmount":1000.0}}],"nonce":1704067200000,"account":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signer":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signature":"5j7s..."}'
        - lang: bash
          label: Create sub-account (no margin)
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"createSubAccount":{"name":"desk-1"}}],"nonce":1704067200003,"account":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signer":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signature":"5j7s..."}'
        - lang: bash
          label: Rename sub-account
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"renameSubAccount":{"a":"8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR","n":"desk-2"}}],"nonce":1704067200002,"account":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signer":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signature":"5j7s..."}'
        - lang: bash
          label: Remove sub-account
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"removeSubAccount":{"toRemove":"8x7iUti9m6L6Y9yQPXkXj4zD2uP1Qx5Eo9W4vYm6cGmR"}}],"nonce":1704067200001,"account":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signer":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signature":"5j7s..."}'
components:
  schemas:
    TransactionSubAccount:
      type: object
      description: Transaction with a single sub-account action
      required:
        - actions
        - nonce
        - account
        - signer
        - signature
      properties:
        actions:
          type: array
          description: >-
            Must contain exactly one createSubAccount, renameSubAccount, or
            removeSubAccount action
          items:
            $ref: '#/components/schemas/SubAccountAction'
        nonce:
          type: integer
          format: int64
        account:
          type: string
          description: Master account public key (base58)
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
    SubAccountAction:
      oneOf:
        - title: createSubAccount
          type: object
          required:
            - createSubAccount
          properties:
            createSubAccount:
              type: object
              required:
                - name
              properties:
                name:
                  type: string
                  description: Sub-account display name (1-32 chars, `A-Z a-z 0-9 - _`)
                marginSymbol:
                  type: string
                  nullable: true
                  description: >-
                    Optional margin asset symbol. Must be present when
                    `marginAmount` is non-zero.
                marginAmount:
                  type: number
                  nullable: true
                  description: >-
                    Optional initial margin amount. Default `0.0`. Must be a
                    JSON number (unquoted), e.g. `0` or `1000.0`, not `"0"` or
                    `"1000.0"`.
        - title: renameSubAccount
          type: object
          required:
            - renameSubAccount
          properties:
            renameSubAccount:
              type: object
              required:
                - a
                - 'n'
              properties:
                a:
                  type: string
                  description: >-
                    Sub-account pubkey to rename (base58). Must belong to the
                    signing master.
                'n':
                  type: string
                  description: >-
                    New display name (1-32 chars, `A-Z a-z 0-9 - _`). Must be
                    unique within the master tree.
        - title: removeSubAccount
          type: object
          required:
            - removeSubAccount
          properties:
            removeSubAccount:
              type: object
              required:
                - toRemove
              properties:
                toRemove:
                  type: string
                  description: >-
                    Sub-account pubkey to remove (base58). Also accepts a flat
                    per-instrument isolated-account pubkey.

````