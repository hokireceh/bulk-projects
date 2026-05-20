> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Order IDs

> Deterministic order IDs - no client order ID required; compute on the fly or use bulk-keychain

Order IDs on BULK are **deterministic**: they are derived from the signed transaction (action, account, nonce, and action index). You do **not** need to supply a client order ID. You can compute the order ID before or after sending the request, and use the official library to do it for you.

## Why deterministic?

* **No client order ID required** - The exchange assigns a unique ID from the transaction contents.
* **Know the ID before the node responds** - Useful for optimistic UI and local tracking.
* **Reproducible** - Same action + account + nonce + index always yields the same order ID.

## Computing order IDs

You can compute order IDs yourself from the protocol formula, or use **[bulk-keychain](https://github.com/Bulk-trade/bulk-keychain)** so you don’t have to implement the binary encoding.

### Option 1: Use bulk-keychain (recommended)

The official signing library **bulk-keychain** can compute order IDs for you in **Node.js**, **browser (WASM)**, **Rust**, and **Python**. Single-order and batch (group) transactions are supported.

| Environment       | Package              | Install                          |
| ----------------- | -------------------- | -------------------------------- |
| **Node.js**       | `bulk-keychain`      | `npm install bulk-keychain`      |
| **Browser (Web)** | `bulk-keychain-wasm` | `npm install bulk-keychain-wasm` |
| **Python**        | `bulk-keychain`      | `pip install bulk-keychain`      |
| **Rust**          | `bulk-keychain`      | `cargo add bulk-keychain`        |

After signing, the returned object includes the order ID(s):

**TypeScript (Node.js):**

```typescript theme={null}
const signed = signer.sign(order);
console.log(signed.orderId);  // Pre-computed order ID
```

**Python:**

```python theme={null}
signed = signer.sign(order)
print(signed.get("order_id"))
```

**Rust:**

```rust theme={null}
let signed = signer.sign(order.into(), None)?;
println!("Order ID: {:?}", signed.order_id);
```

For **multi-order (grouped)** transactions, enable batch order ID computation so you get an ID per order. See the [bulk-keychain README](https://github.com/Bulk-trade/bulk-keychain) for `signGroup`, `prepareGroup`, and batch order ID options.

You can also compute an order ID **without signing** (e.g. for display or lookup) using the library’s `compute_order_id` / `computeOrderId` helpers with order fields, nonce, and account.

### Option 2: Compute from the protocol

Order IDs are the base58-encoded SHA-256 hash of:

```
order_id = bs58_encode(
  sha256(seqno_le_u32 + bincode_serialize(single_action) + account_pubkey_bytes + nonce_le_u64)
)
```

* `seqno`: Zero-based index of the order-producing action in the `actions` array (0 for a single-order tx).
* `single_action`: Canonical bincode of that one action (same encoding used for signing).
* For limit/market actions, `px` and `sz` use fixed-point: `round(value * 1e8)` as u64.

Implementing this requires the same canonical action encoding as the rest of the protocol; using bulk-keychain avoids that.

## Summary

| Need                          | Approach                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Sign and send orders          | Use [bulk-keychain](https://github.com/Bulk-trade/bulk-keychain) (Node, Web, Rust, Python).       |
| Know order ID before response | Use bulk-keychain’s pre-computed order ID after signing (or after prepare, with external wallet). |
| Order ID without private key  | Use bulk-keychain’s `compute_order_id` / `computeOrderId` with order + nonce + account.           |
