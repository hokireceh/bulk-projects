> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Multisig Stream

> Real-time proposal snapshots for one or more multisig smart accounts

<Note>
  The multisig stream publishes full proposal snapshots after every lifecycle change (created, approved, rejected, ready, executed, expired, cancelled, failed). It does not require a signature; any client may subscribe to a multisig pubkey.
</Note>

## Subscribe

### Single Multisig

```json theme={null}
{
  "method": "subscribe",
  "subscription": [{
    "type": "multisig",
    "multisig": "6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK"
  }]
}
```

### Multiple Multisigs (Batched)

```json theme={null}
{
  "method": "subscribe",
  "subscription": [{
    "type": "multisig",
    "multisig": [
      "6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK",
      "7n6Qx2mY5s9wH1rJ4cE8pV2kB3dL6tP9fU1aZ3xC5vR"
    ]
  }]
}
```

### Response

```json theme={null}
{
  "type": "subscriptionResponse",
  "topics": [
    "multisig.6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK",
    "multisig.7n6Qx2mY5s9wH1rJ4cE8pV2kB3dL6tP9fU1aZ3xC5vR"
  ]
}
```

**Parameters:**

* `multisig` (String or Array): Multisig public key(s) in base58 format.
  * Single: `"multisig": "6q8Y..."`
  * Multiple: `"multisig": ["6q8Y...", "7n6Q...", ...]`

You receive separate snapshot updates for each subscribed multisig on its own topic channel.

***

## Initial Snapshot + Updates

The stream publishes a full proposal snapshot when you subscribe (one message per multisig) and another snapshot after every proposal lifecycle change. Each message is a complete view of all currently tracked proposals for that multisig.

```json theme={null}
{
  "type": "multisig",
  "data": {
    "multisig": {
      "multisig": "6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK",
      "proposals": [
        {
          "proposalId": 42,
          "proposer": "9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt",
          "createdAt": 1776700149433,
          "executeAfter": 1776700209433,
          "expiresAt": 1777304949433,
          "approvals": ["9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt"],
          "rejections": [],
          "approvalsCount": 1,
          "rejectionsCount": 0,
          "status": "pending",
          "actions": [
            {"transfer": {"k": "internal", "from": "...", "to": "...", "marginSymbol": "USDC", "marginAmount": 10.0}}
          ],
          "error": null
        }
      ]
    }
  },
  "topic": "multisig.6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK"
}
```

### Proposal Fields

| Field                                | Description                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `proposalId`                         | Monotonic per-multisig proposal identifier (u64)                                  |
| `proposer`                           | Pubkey of the signer who created the proposal                                     |
| `createdAt`                          | Creation timestamp (ms since epoch)                                               |
| `executeAfter`                       | Earliest timestamp at which the proposal may be executed (ms; reflects time-lock) |
| `expiresAt`                          | Timestamp after which the proposal is no longer executable (ms)                   |
| `approvals`                          | Pubkeys of signers who approved (set semantics; one entry per approver)           |
| `rejections`                         | Pubkeys of signers who rejected                                                   |
| `approvalsCount` / `rejectionsCount` | Cached counts of the corresponding arrays                                         |
| `status`                             | Proposal status (see table below)                                                 |
| `actions`                            | The exact action batch the proposal will execute on success                       |
| `error`                              | Failure message (only set when `status = failed`)                                 |

### Proposal Status

| Status      | Terminal | Description                                         |
| ----------- | -------- | --------------------------------------------------- |
| `pending`   | No       | Awaiting more approvals (and/or time-lock)          |
| `ready`     | No       | Threshold met and time-lock elapsed; awaiting `mse` |
| `executed`  | Yes      | Successfully executed                               |
| `failed`    | Yes      | Execution attempted but failed (`error` set)        |
| `expired`   | Yes      | `expiresAt` passed without execution                |
| `cancelled` | Yes      | Proposer cancelled the proposal                     |
| `rejected`  | Yes      | Threshold of signers rejected the proposal          |

***

## Lifecycle Notes

* A proposal is created via the [`msp` action](/api-reference/multisigPropose) submitted by any signer of the multisig.
* Approvals (`msa`) and rejections (`msr`) are set-based: re-submitting the same vote from the same signer is a no-op.
* A proposal becomes `ready` once `approvals.length >= threshold` **and** `now >= executeAfter`. Any signer (not just the proposer) may then submit `mse` to execute.
* `msu` (update multisig policy) can only appear inside an `msp` proposal batch; it is rejected when submitted as a top-level action.
* Inline `post` responses to `msp`/`msa`/`msr`/`msc`/`mse` actions deliver compact status rows on the calling account's stream (e.g. `proposalCreated`, `proposalApproved`, `proposalReadyForExecution`, `proposalExecuted`, `proposalFailed`, `proposalRejected`, `proposalCancelled`, `proposalExpired`); the multisig stream additionally publishes the full proposal snapshot.

***

## Example: Watch a Multisig

<CodeGroup>
  ```javascript Node.js theme={null}
  const WebSocket = require('ws');

  const MULTISIG = '6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK';
  const ws = new WebSocket('wss://exchange-ws1.bulk.trade');

  ws.on('open', () => {
    ws.send(JSON.stringify({
      method: 'subscribe',
      subscription: [{ type: 'multisig', multisig: MULTISIG }],
    }));
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'subscriptionResponse') {
      console.log('Subscribed to:', msg.topics);
      return;
    }
    if (msg.type === 'multisig') {
      const { multisig, proposals } = msg.data.multisig;
      console.log(`[${multisig}] ${proposals.length} proposals tracked`);
      for (const p of proposals) {
        console.log(`  #${p.proposalId} ${p.status} approvals=${p.approvalsCount}/${p.rejectionsCount}`);
      }
    }
  });
  ```

  ```python Python theme={null}
  import json, websocket

  MULTISIG = '6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK'

  def on_open(ws):
      ws.send(json.dumps({
          'method': 'subscribe',
          'subscription': [{'type': 'multisig', 'multisig': MULTISIG}],
      }))

  def on_message(ws, raw):
      msg = json.loads(raw)
      if msg.get('type') == 'subscriptionResponse':
          print('Subscribed to:', msg['topics'])
          return
      if msg.get('type') == 'multisig':
          ms = msg['data']['multisig']
          print(f"[{ms['multisig']}] {len(ms['proposals'])} proposals")
          for p in ms['proposals']:
              print(f"  #{p['proposalId']} {p['status']} approvals={p['approvalsCount']}/{p['rejectionsCount']}")

  ws = websocket.WebSocketApp(
      'wss://exchange-ws1.bulk.trade',
      on_open=on_open,
      on_message=on_message,
  )
  ws.run_forever()
  ```
</CodeGroup>

***

## Unsubscribe

```json theme={null}
{
  "method": "unsubscribe",
  "topic": "multisig.6q8Y4f6g8tR4mQ1H2Zr3u9x7k9a4nS2Yx1g6Wm8qJ5tK"
}
```
