> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Multisig (Signed)

> Create multisig accounts and drive the proposal lifecycle (propose, approve, reject, cancel, execute, update policy)

Multisig is a protocol-native account type on BULK. Use the **unified** `POST /order` endpoint with `createMultisig` to instantiate a multisig account, or one of the compact lifecycle tags (`msp`, `msa`, `msr`, `msc`, `mse`, `msu`) to drive an existing proposal.

For background, signer policy, atomic rollback, expiry, and supported inner actions, see the [Multisig](/architecture/multisig) page. For the proposal-list reader, see [Get Multisig Proposals](/api-reference/getMultisigProposals).

***

## Transaction Envelope

```json theme={null}
{
  "actions": [Action],
  "nonce": 1704067200000,
  "account": "signer_pubkey_base58",
  "signer": "signer_pubkey_base58",
  "signature": "base58_signature"
}
```

`account` and `signer` are the **signer** acting on the multisig (a member of the signer set, or the creator for `createMultisig`). The multisig pubkey itself is referenced inside the action body via the `m` field.

***

## Action Tags

Action shapes mirror the HTTP reference exactly.

### `createMultisig`

Create a protocol-native multisig smart account.

```json theme={null}
{"createMultisig": {"signers": ["base58_pubkey", "base58_pubkey"], "threshold": 2, "timeLockSecs": 60, "proposalLifetimeSecs": 604800}}
```

| Field                  | Type      | Description                                                                                      |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `signers`              | String\[] | Multisig signer pubkeys (base58 preferred; raw `[u8;32]` arrays also accepted for compatibility) |
| `threshold`            | u32       | Required approvals                                                                               |
| `timeLockSecs`         | u32       | Timelock in seconds before execution                                                             |
| `proposalLifetimeSecs` | u32       | Proposal lifetime in seconds                                                                     |

Returns the deterministic multisig pubkey in the `multisigCreated` status.

### Multisig Proposal Actions

Proposal lifecycle actions use compact tags for lower wire overhead.

```json theme={null}
{"msp": {"m": "multisig_pubkey", "a": [{"transfer": {"k": "internal", "from": "...", "to": "...", "marginSymbol": "USDC", "marginAmount": 10.0}}]}}
{"msa": {"m": "multisig_pubkey", "p": 7}}
{"msr": {"m": "multisig_pubkey", "p": 7}}
{"msc": {"m": "multisig_pubkey", "p": 7}}
{"mse": {"m": "multisig_pubkey", "p": 7}}
{"msu": {"m": "multisig_pubkey", "signers": ["..."], "threshold": 2, "timeLockSecs": 30, "proposalLifetimeSecs": 604800}}
```

| Tag   | Description   | Fields                                                                                                                                               |
| ----- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `msp` | Propose       | `{m, a}` where `m` = multisig pubkey, `a` = inner actions                                                                                            |
| `msa` | Approve       | `{m, p}` where `p` = proposal ID                                                                                                                     |
| `msr` | Reject        | `{m, p}` where `p` = proposal ID                                                                                                                     |
| `msc` | Cancel        | `{m, p}` where `p` = proposal ID                                                                                                                     |
| `mse` | Execute       | `{m, p}` where `p` = proposal ID                                                                                                                     |
| `msu` | Update policy | `{m, signers, threshold, timeLockSecs, proposalLifetimeSecs}` (proposal-only; `signers`: base58 preferred, raw `[u8;32]` accepted for compatibility) |

`msu` is **proposal-only**: submit it as an inner action of an `msp`, not as a top-level action.

***

## Response Status Types

Each multisig action emits one or more rows in the `OrderResponse` `statuses` array.

| Status                      | Terminal | Fields                                                                                                          |
| --------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `multisigCreated`           | Yes      | `{pubkey, threshold, signersLen, timeLockSecs, lifetimeSecs, creator}`                                          |
| `multisigCreatedFailed`     | Yes      | `{message}`                                                                                                     |
| `proposalCreated`           | No       | `{multisig, proposalId, status, approvals, rejections, threshold, executeAfter, expiresAt, signer?, proposer?}` |
| `proposalApproved`          | No       | same fields                                                                                                     |
| `proposalReadyForExecution` | No       | same fields                                                                                                     |
| `proposalExecuted`          | Yes      | same fields                                                                                                     |
| `proposalFailed`            | Yes      | same fields + `message`                                                                                         |
| `proposalExpired`           | Yes      | same fields                                                                                                     |
| `proposalCancelled`         | Yes      | same fields                                                                                                     |
| `proposalRejected`          | Yes      | same fields                                                                                                     |

`status` strings on response rows and on the [proposals snapshot](/api-reference/getMultisigProposals): `pending`, `ready`, `executed`, `failed`, `expired`, `cancelled`, `rejected`.

<CodeGroup>
  ```json Created theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [
          {"multisigCreated": {
            "pubkey": "6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK",
            "threshold": 2,
            "signersLen": 2,
            "timeLockSecs": 60,
            "lifetimeSecs": 604800,
            "creator": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
          }}
        ]
      }
    }
  }
  ```

  ```json Proposal Created theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [
          {"proposalCreated": {
            "multisig": "6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK",
            "proposalId": 7,
            "status": "pending",
            "approvals": 1,
            "rejections": 0,
            "threshold": 2,
            "executeAfter": 1776700209433,
            "expiresAt": 1777304949433,
            "proposer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
            "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7"
          }}
        ]
      }
    }
  }
  ```

  ```json Executed theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [
          {"proposalExecuted": {
            "multisig": "6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK",
            "proposalId": 7,
            "status": "executed",
            "approvals": 2,
            "rejections": 0,
            "threshold": 2,
            "executeAfter": 1776700209433,
            "expiresAt": 1777304949433
          }}
        ]
      }
    }
  }
  ```

  ```json Failed (rolled back) theme={null}
  {
    "status": "ok",
    "response": {
      "type": "order",
      "data": {
        "statuses": [
          {"proposalFailed": {
            "multisig": "6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK",
            "proposalId": 7,
            "status": "failed",
            "approvals": 2,
            "rejections": 0,
            "threshold": 2,
            "executeAfter": 1776700209433,
            "expiresAt": 1777304949433,
            "message": "insufficient balance"
          }}
        ]
      }
    }
  }
  ```
</CodeGroup>

***

## Reading Proposal State

Use the unsigned [`GET /multisig/{pubkey}/proposals`](/api-reference/getMultisigProposals) endpoint to read the full proposal list for a multisig.

A signer's `fullAccount` snapshot also lists the multisig pubkeys it belongs to under `multisigAccounts`.

***

## Before You Start

<Note>
  See [Transaction Signing](/api-reference/signing) for how to sign requests.

  **Nonce**: use a unique value (e.g. timestamp in nanoseconds): `BigInt(Date.now()) * 1_000_000n`.
</Note>


## OpenAPI

````yaml /api-reference/openapi-multisig.yaml POST /order
openapi: 3.0.3
info:
  title: Bulk Trade API - Multisig
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
      summary: >-
        Multisig: create / propose / approve / reject / cancel / execute /
        update policy
      description: >
        Submit a signed transaction with a single multisig action:
        `createMultisig`

        to instantiate a multisig account, or one of the proposal lifecycle tags

        (`msp`, `msa`, `msr`, `msc`, `mse`, `msu`) to drive the proposal flow.

        See [Transaction Signing](/api-reference/signing) for signing details.
      operationId: submitMultisigAction
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransactionMultisig'
            examples:
              createMultisig:
                summary: Create Multisig
                value:
                  actions:
                    - createMultisig:
                        signers:
                          - FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                          - 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                        threshold: 2
                        timeLockSecs: 60
                        proposalLifetimeSecs: 604800
                  nonce: 1704067200000
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...
              propose:
                summary: Propose (transfer)
                value:
                  actions:
                    - msp:
                        m: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                        a:
                          - transfer:
                              k: internal
                              from: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                              to: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                              marginSymbol: USDC
                              marginAmount: 10
                  nonce: 1704067200001
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...
              approve:
                summary: Approve
                value:
                  actions:
                    - msa:
                        m: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                        p: 7
                  nonce: 1704067200002
                  account: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                  signer: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                  signature: 5j7s...
              reject:
                summary: Reject
                value:
                  actions:
                    - msr:
                        m: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                        p: 7
                  nonce: 1704067200003
                  account: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                  signer: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                  signature: 5j7s...
              cancel:
                summary: Cancel (proposer-only)
                value:
                  actions:
                    - msc:
                        m: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                        p: 7
                  nonce: 1704067200004
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...
              execute:
                summary: Execute (after time-lock)
                value:
                  actions:
                    - mse:
                        m: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                        p: 7
                  nonce: 1704067200005
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...
              updatePolicy:
                summary: Update Policy (proposal-only)
                value:
                  actions:
                    - msu:
                        m: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                        signers:
                          - FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                          - 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                        threshold: 2
                        timeLockSecs: 30
                        proposalLifetimeSecs: 604800
                  nonce: 1704067200006
                  account: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                  signature: 5j7s...
      responses:
        '200':
          description: Multisig action accepted
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderResponse'
              examples:
                created:
                  summary: Multisig created
                  value:
                    status: ok
                    response:
                      type: order
                      data:
                        statuses:
                          - multisigCreated:
                              pubkey: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                              threshold: 2
                              signersLen: 2
                              timeLockSecs: 60
                              lifetimeSecs: 604800
                              creator: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                proposalCreated:
                  summary: Proposal created
                  value:
                    status: ok
                    response:
                      type: order
                      data:
                        statuses:
                          - proposalCreated:
                              multisig: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                              proposalId: 7
                              status: pending
                              approvals: 1
                              rejections: 0
                              threshold: 2
                              executeAfter: 1776700209433
                              expiresAt: 1777304949433
                              proposer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                              signer: FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7
                proposalReady:
                  summary: Proposal ready (threshold reached, awaiting time-lock)
                  value:
                    status: ok
                    response:
                      type: order
                      data:
                        statuses:
                          - proposalReadyForExecution:
                              multisig: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                              proposalId: 7
                              status: ready
                              approvals: 2
                              rejections: 0
                              threshold: 2
                              executeAfter: 1776700209433
                              expiresAt: 1777304949433
                              signer: 5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux
                proposalExecuted:
                  summary: Proposal executed
                  value:
                    status: ok
                    response:
                      type: order
                      data:
                        statuses:
                          - proposalExecuted:
                              multisig: 6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK
                              proposalId: 7
                              status: executed
                              approvals: 2
                              rejections: 0
                              threshold: 2
                              executeAfter: 1776700209433
                              expiresAt: 1777304949433
      x-codeSamples:
        - lang: bash
          label: Create multisig
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"createMultisig":{"signers":["FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux"],"threshold":2,"timeLockSecs":60,"proposalLifetimeSecs":604800}}],"nonce":1704067200000,"account":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signer":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signature":"5j7s..."}'
        - lang: bash
          label: Propose (transfer)
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"msp":{"m":"6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK","a":[{"transfer":{"k":"internal","from":"6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK","to":"5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux","marginSymbol":"USDC","marginAmount":10.0}}]}}],"nonce":1704067200001,"account":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signer":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signature":"5j7s..."}'
        - lang: bash
          label: Approve
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"msa":{"m":"6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK","p":7}}],"nonce":1704067200002,"account":"5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux","signer":"5Am6JkEHAjYG1itNWRMGpQrxvY8AaqkXCo1TZvenqVux","signature":"5j7s..."}'
        - lang: bash
          label: Execute (after time-lock)
          source: |
            curl -X POST https://exchange-api.bulk.trade/api/v1/order \
              -H "Content-Type: application/json" \
              -d '{"actions":[{"mse":{"m":"6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK","p":7}}],"nonce":1704067200003,"account":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signer":"FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7","signature":"5j7s..."}'
components:
  schemas:
    TransactionMultisig:
      type: object
      description: Transaction with a single multisig action
      required:
        - actions
        - nonce
        - account
        - signer
        - signature
      properties:
        actions:
          type: array
          description: Must contain exactly one multisig action
          items:
            $ref: '#/components/schemas/MultisigAction'
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
    MultisigAction:
      oneOf:
        - title: createMultisig
          type: object
          required:
            - createMultisig
          properties:
            createMultisig:
              type: object
              required:
                - signers
                - threshold
                - timeLockSecs
                - proposalLifetimeSecs
              properties:
                signers:
                  type: array
                  description: >-
                    Multisig signer pubkeys (base58 preferred; raw `[u8;32]`
                    arrays also accepted for compatibility).
                  items:
                    type: string
                threshold:
                  type: integer
                  format: uint32
                timeLockSecs:
                  type: integer
                  format: uint32
                proposalLifetimeSecs:
                  type: integer
                  format: uint32
        - title: msp (Propose)
          type: object
          required:
            - msp
          properties:
            msp:
              type: object
              required:
                - m
                - a
              properties:
                m:
                  type: string
                a:
                  type: array
                  items:
                    type: object
        - title: msa (Approve)
          type: object
          required:
            - msa
          properties:
            msa:
              type: object
              required:
                - m
                - p
              properties:
                m:
                  type: string
                p:
                  type: integer
                  format: uint64
        - title: msr (Reject)
          type: object
          required:
            - msr
          properties:
            msr:
              type: object
              required:
                - m
                - p
              properties:
                m:
                  type: string
                p:
                  type: integer
                  format: uint64
        - title: msc (Cancel)
          type: object
          required:
            - msc
          properties:
            msc:
              type: object
              required:
                - m
                - p
              properties:
                m:
                  type: string
                p:
                  type: integer
                  format: uint64
        - title: mse (Execute)
          type: object
          required:
            - mse
          properties:
            mse:
              type: object
              required:
                - m
                - p
              properties:
                m:
                  type: string
                p:
                  type: integer
                  format: uint64
        - title: msu (Update Policy)
          type: object
          required:
            - msu
          properties:
            msu:
              type: object
              required:
                - m
                - signers
                - threshold
                - timeLockSecs
                - proposalLifetimeSecs
              properties:
                m:
                  type: string
                signers:
                  type: array
                  description: >-
                    New signer set (base58 preferred; raw `[u8;32]` arrays also
                    accepted for compatibility).
                  items:
                    type: string
                threshold:
                  type: integer
                  format: uint32
                timeLockSecs:
                  type: integer
                  format: uint32
                proposalLifetimeSecs:
                  type: integer
                  format: uint32

````