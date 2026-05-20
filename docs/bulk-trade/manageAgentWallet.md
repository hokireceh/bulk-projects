> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Manage Agent Wallet (Signed)

> Register or remove an agent wallet via the unified transaction endpoint

Agent wallet management uses the **unified** `POST /order` endpoint. Send a transaction with an `agentWalletCreation` action in the `actions` array.

<Warning>
  If `signer != account`, the signer must be pre-authorized. Agent wallets allow the agent to trade on behalf of the account; register the agent with this action before the agent submits orders.
</Warning>

<Note>
  **Scope:** agent wallets are registered on the `account` field of this transaction. An agent registered on a **master** can sign for that master **and for any of its [sub-accounts](/api-reference/manageSubAccounts)**. Sub-accounts can also register their own agent wallets independently (set `account` to the sub-account pubkey when registering). To use an agent on a sub-account, set the transaction `account` to the sub-account pubkey and `signer` to the agent wallet's pubkey.

  Isolated accounts are managed entirely through the `i` flag on order actions and are never set as `account` for any transaction (including `agentWalletCreation`). See [Isolated Margin](/bulk-exchange/isolated-margin).
</Note>

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

For agent wallet, the action is a single `agentWalletCreation` object.

***

## Agent Wallet Action

| Field | Type    | Description                                          |
| ----- | ------- | ---------------------------------------------------- |
| `a`   | string  | Agent public key to authorize (base58).              |
| `d`   | boolean | `false` = add/register agent, `true` = remove agent. |

***

## Request Examples

### Register an agent

```json theme={null}
{
  "actions": [
    {"agentWalletCreation": {"a": "5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux", "d": false}}
  ],
  "nonce": 1704067200000,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5JXWgp1fW6px2Gjhw6YHhQ4..."
}
```

### Remove an agent

```json theme={null}
{"agentWalletCreation": {"a": "5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux", "d": true}}
```

***

## Signing the Transaction

The canonical signing path is the raw wincode binary message described in [Transaction Signing](/api-reference/signing). Two extra signing modes are accepted on this endpoint:

* **General offchain mode**: any transaction (including `agentWalletCreation`) can be signed using the v0 Solana offchain-message envelope. Set `x-bulk-sig-mode: offchain` on the request. See [Offchain Signing Mode](/api-reference/signing#offchain-signing-mode).
* **Legacy wallet-compatibility path** (owner-signed `agentWalletCreation` only): when `signer == account` and the transaction contains exactly one `agentWalletCreation` action, the server also accepts a signature over `bs58_encode(canonical_binary_message).as_bytes()` for older wallet UIs that cannot produce raw binary signatures. See [Legacy Wallet-Compatibility Path](/api-reference/signing#legacy-wallet-compatibility-path-owner-signed-agentwalletcreation-only).

***

## Response

Same `OrderResponse` format as other actions. Success may return `agentWallet` status:

```json theme={null}
{
  "status": "ok",
  "response": {
    "type": "order",
    "data": {
      "statuses": [{"agentWallet": {"agent_wallet": "5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux"}}]
    }
  }
}
```

Failure returns `agentWalletFailed`:

```json theme={null}
{
  "status": "ok",
  "response": {
    "type": "order",
    "data": {
      "statuses": [{"agentWalletFailed": {"message": "Unauthorized"}}]
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

````yaml /api-reference/openapi-agent-wallet.yaml POST /order
openapi: 3.0.3
info:
  title: Bulk Trade API - Agent Wallet
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
      summary: Register or remove agent wallet
      description: >
        Submit a signed transaction with a single **agentWalletCreation**
        action.

        Agent wallets allow the agent to trade on behalf of the account;
        register the agent with this action before the agent submits orders.

        See [Transaction Signing](/api-reference/signing) for signing details.
      operationId: submitAgentWallet
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransactionAgentWallet'
            example:
              actions:
                - agentWalletCreation:
                    a: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                    d: false
              nonce: 1704067200000
              account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
              signature: 5JXWgp1fW6px2Gjhw6YHhQ4...
      responses:
        '200':
          description: Agent wallet registered or removed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderResponse'
              example:
                status: ok
                response:
                  type: order
                  data:
                    statuses:
                      - agentWallet:
                          agent_wallet: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
      x-codeSamples:
        - lang: bash
          label: Register agent wallet
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"agentWalletCreation":{"a":"5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux","d":false}}],"nonce":1704067200000,"account":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signer":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signature":"5JXWgp1fW6px2Gjhw6YHhQ4..."}'
components:
  schemas:
    TransactionAgentWallet:
      type: object
      description: Transaction with a single agentWalletCreation action
      required:
        - actions
        - nonce
        - account
        - signer
        - signature
      properties:
        actions:
          type: array
          description: Must contain exactly one agentWalletCreation action
          items:
            $ref: '#/components/schemas/ActionAgentWallet'
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
    ActionAgentWallet:
      type: object
      title: Agent wallet (agentWalletCreation)
      required:
        - agentWalletCreation
      properties:
        agentWalletCreation:
          type: object
          required:
            - a
            - d
          properties:
            a:
              type: string
              description: Agent public key (base58)
            d:
              type: boolean
              description: false = add agent, true = remove agent

````