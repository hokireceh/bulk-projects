> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bulk.trade/llms.txt
> Use this file to discover all available pages before exploring further.

# Transaction Signing

> All state-mutating operations require Ed25519 signatures over the canonical wincode binary message

All transactions submitted to `POST /order` require **Ed25519 signatures** for authentication.

## JSON vs Binary Formats

The API accepts transactions as **JSON** where all cryptographic fields are **base58-encoded strings**:

| Field                        | JSON Format   | Example                                          |
| ---------------------------- | ------------- | ------------------------------------------------ |
| `account`                    | base58 string | `"9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt"` |
| `signer`                     | base58 string | `"9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt"` |
| `signature`                  | base58 string | `"5j7sVt3k2YxPqH4w..."`                          |
| Order IDs (`oid`)            | base58 string | `"Fpa3oVuL3UzjNANAMZZdmrn6D1Zhk83GmBuJpuAWG51F"` |
| Pubkeys (`u`, `a`, `target`) | base58 string | `"8DmyR3yJhpQHBqgSGua4c69PZ9ZMeaJddTumUdmTx7a"`  |

For **signing**, construct the **canonical wincode binary representation** of the transaction (the action list plus the trailing `nonce` and `account` fields), sign those bytes with Ed25519, then base58-encode the 64-byte signature for the JSON payload.

**The `signer` field is NOT part of the signed bytes.**

### JSON wire: input tolerance vs. canonical output

| Field class                                                                     | Adapter                                           | Node emits (in responses)              | Node accepts (on input)          |
| ------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------- | -------------------------------- |
| Scaled price/size (`sz`, `px`, `tr`, `pmin`, `pmax`)                            | `serde_safe_f64`                                  | JSON string (e.g. `"0.1"`, `"100000"`) | string **or** JSON number        |
| Scaled optional (`lim`, `lmin`, `lmax`)                                         | `serde_opt_f64`                                   | string or `null`                       | string, number, or `null`/absent |
| `nonce`                                                                         | `serde_u64`                                       | JSON string                            | string or JSON integer           |
| `Pubkey` / `Hash` / `signature`                                                 | `serde_pubkey` / `serde_hash` / `serde_signature` | base58 string                          | base58 string                    |
| `tif`                                                                           | derived                                           | `"GTC"` / `"IOC"` / `"ALO"`            | same                             |
| Plain `f64` (`mod.sz`, `px.px`, `faucet.amount`, `updateUserSettings.m` values) | default                                           | JSON number                            | JSON number                      |
| `PythOracle` `t`/`fi`/`px`/`e`, `of.p`, `trl.trb`/`trl.stb`                     | default                                           | JSON integer                           | JSON integer                     |

***

## What Gets Signed

The signature is computed over the canonical **wincode** binary serialization of the transaction, excluding `signer` and `signature`:

```
binary_message =
    wincode_serialize(actions)      // Vec<Action>: u64 LE count + per-action body
    || nonce_le_u64                 // 8 bytes little-endian
    || account_pubkey_32_bytes      // bs58.decode(account)

signature      = ed25519_sign(binary_message, signer_secret_key)
json_signature = bs58_encode(signature)   // 64 raw bytes → base58 string
```

**Notes:**

* `signer` is required in the JSON payload but is **not** part of the signed bytes.
* If `signer != account`, the signer must be an authorized agent for that account.
* `account_pubkey_bytes` is raw 32 bytes (`bs58.decode(account)`).
* The `signature` field itself is not included in what gets signed.

<Note>
  **Nonce**: Use a unique value for replay protection (timestamp in milliseconds or an incrementing counter). On the wire it is `u64` little-endian.
</Note>

***

## Transaction Structure

All signed requests to `POST /order` use this **unified envelope**:

```json theme={null}
{
  "actions": [Action, ...],
  "nonce": 1704067200000,
  "account": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signer": "FuueqefENiGEW6uMqZQgmwjzgpnb85EgUcZa5Em4PQh7",
  "signature": "5j7sVt3k2YxPqH4w..."
}
```

| Field       | Description                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| `actions`   | Array of actions to execute atomically (see [Place Order](/api-reference/placeOrder) and related pages). |
| `nonce`     | Unique integer for replay protection.                                                                    |
| `account`   | Account public key (base58); the account performing the action.                                          |
| `signer`    | Signer public key (base58); who is signing (usually same as account, or authorized agent).               |
| `signature` | Ed25519 signature (base58) over the wincode binary message.                                              |

***

## Binary Serialization Format (wincode)

This describes how each type is encoded in the **binary message** used for signing, **not** the JSON format. The binary wire is **bincode-compatible**: fixed-width little-endian integers, u32 enum tags, u64 length prefixes.

| Type                                      | Binary Encoding                                               |
| ----------------------------------------- | ------------------------------------------------------------- |
| Action enum tag (outer `m`/`l`/`mod`/...) | **u32 LE** (4 bytes) discriminant                             |
| `bool`                                    | 1 byte (0 or 1)                                               |
| `u8`                                      | 1 byte                                                        |
| `i16`                                     | 2 bytes LE                                                    |
| `u32`                                     | 4 bytes LE                                                    |
| `u64`                                     | 8 bytes LE                                                    |
| Plain `f64`                               | 8 bytes LE (raw IEEE-754)                                     |
| `String`                                  | u64 length (LE) + UTF-8 bytes                                 |
| `Vec<T>`                                  | u64 count (LE) + elements                                     |
| `HashMap<K, V>`                           | u64 count (LE) + key/value pairs                              |
| `Pubkey`                                  | 32 raw bytes (`bs58.decode` of the base58 string)             |
| `Hash` (order IDs)                        | 32 raw bytes (`bs58.decode` of the base58 string)             |
| `TimeInForce` (`tif`)                     | **u32 LE** (4 bytes) variant index: `0=GTC`, `1=IOC`, `2=ALO` |
| "scaled f64" *(see below)*                | **u64 LE** of `round(value * 1e8)` (8 bytes)                  |
| `Option<scaled f64>`                      | 1 byte tag (0=None, 1=Some) + (if Some) u64 LE scaled         |
| `Option<plain f64>`                       | 1 byte tag (0=None, 1=Some) + (if Some) raw IEEE-754 f64      |

<Note>
  `TimeInForce` is a serde-derived enum, so bincode writes its variant index as a **u32**, the same treatment as the outer action discriminants.
</Note>

### Scaled vs plain `f64`

The exchange uses a **fixed-point-over-bincode** convention for price- and size-like fields: multiply the `f64` value by `1e8`, round to the nearest integer, and serialize it as a **`u64` little-endian (8 bytes)**.

**Scaled `f64` fields** (encode as `u64 LE` of `round(x * 1e8)`):

| Action                     | JSON key             | Rust field                         |
| -------------------------- | -------------------- | ---------------------------------- |
| `m` MarketOrder            | `sz`                 | `size`                             |
| `l` LimitOrder             | `px`, `sz`           | `price`, `size`                    |
| `st` Stop, `tp` TakeProfit | `sz`, `tr`           | `size`, `threshold`                |
| `rng` Range / OCO          | `sz`, `pmin`, `pmax` | `size`, `collar_min`, `collar_max` |
| `trig` TriggerBasket       | `tr`                 | `threshold`                        |
| `trl` Trailing             | `sz`                 | `size`                             |

**Scaled `Option<f64>` fields** (1-byte tag + optional `u64 LE` of `round(x * 1e8)`; encode **absent** as `0x00` tag with no payload):

| Action                     | JSON key       | Rust field               |
| -------------------------- | -------------- | ------------------------ |
| `st` Stop, `tp` TakeProfit | `lim`          | `limit`                  |
| `rng` Range / OCO          | `lmin`, `lmax` | `limit_min`, `limit_max` |
| `trl` Trailing             | `lim`          | `limit`                  |

<Warning>
  The old `NaN means market-style trigger` convention is no longer supported. A market-style trigger is now encoded as `Option::None` (`0x00`), not as a NaN-valued `f64`.
</Warning>

**Plain `f64` fields** (raw IEEE-754, 8 bytes LE, **no** `1e8` scaling):

| Action               | JSON key          | Rust field                                            |
| -------------------- | ----------------- | ----------------------------------------------------- |
| `mod` ModifyOrder    | `sz`              | `amount`                                              |
| `px` Price (admin)   | `px`              | `price`                                               |
| `faucet` Faucet      | `amount`          | `amount` (`Option<f64>`, plain: tag + raw f64)        |
| `updateUserSettings` | values of `m` map | `max_leverage` values (raw f64 per entry)             |
| `createSubAccount`   | `marginAmount`    | `margin_amount` (`Option<f64>`, plain: tag + raw f64) |
| `transfer`           | `marginAmount`    | `margin_amount` (raw f64)                             |

***

## Action Discriminants

```typescript theme={null}
const ACTION_CODES = {
  m: 0,                    // market order
  l: 1,                    // limit order
  mod: 2,                  // modify order
  cx: 3,                   // cancel
  cxa: 4,                  // cancel all
  st: 5,                   // stop
  tp: 6,                   // take profit
  rng: 7,                  // range / OCO
  trig: 8,                 // trigger basket
  trl: 9,                  // trailing
  of: 10,                  // on-fill
  px: 11,                  // price (admin)
  // 12 is corrs (admin)
  o: 13,                   // pyth oracle (admin)
  // 14, 15 are beacon/join (admin)
  faucet: 16,
  agentWalletCreation: 17,
  updateUserSettings: 18,
  whitelistFaucet: 19,     // admin
  // 20-26 are admin (addMarket, configFairPrice, configVolatility,
  //                  configSecurity, configRegime, configRisk, cfgf)
  createSubAccount: 27,
  removeSubAccount: 28,
  transfer: 29,
  createMultisig: 30,
  msp: 31,                 // multisig propose
  msa: 32,                 // multisig approve
  msr: 33,                 // multisig reject
  msc: 34,                 // multisig cancel
  mse: 35,                 // multisig execute
  msu: 36,                 // multisig update policy
  rsa: 37,                 // rename sub-account
};

const TIME_IN_FORCE_CODES = {
  GTC: 0,
  IOC: 1,
  ALO: 2,
};

const TRANSFER_KIND_CODES = {
  internal: 0,
  external: 1,
};
```

***

## Official Signing Library (bulk-keychain)

The recommended way to sign transactions is the official **bulk-keychain** library. One Rust core with bindings for:

| Environment       | Package              | Install                          |
| ----------------- | -------------------- | -------------------------------- |
| **Node.js**       | `bulk-keychain`      | `npm install bulk-keychain`      |
| **Browser (Web)** | `bulk-keychain-wasm` | `npm install bulk-keychain-wasm` |
| **Python**        | `bulk-keychain`      | `pip install bulk-keychain`      |
| **Rust**          | `bulk-keychain`      | `cargo add bulk-keychain`        |

Repository: **[github.com/Bulk-trade/bulk-keychain](https://github.com/Bulk-trade/bulk-keychain)**

It handles the canonical wincode encoding, scaled-f64 convention, single/batch/grouped signing, agent wallet, faucet, and external wallet (prepare/finalize) flows. For deterministic order ID computation, see [Order IDs](/api-reference/orderIds).

***

## Binary Layout

All `Pubkey` and `Hash` fields are 32 raw bytes from `bs58.decode()` on the base58 string. `scaled u64` means `writeU64(round(value * 1e8))`.

### Transaction (signed message)

```
[8 bytes]  Actions count (u64, LE)
For each action:
  [4 bytes]  Action discriminant (u32, LE)
  [...]      Action-specific fields (see below)
[8 bytes]  Nonce (u64, LE)
[32 bytes] Account pubkey (bs58.decode)
-- signer pubkey and signature are NOT included in the signed message --
```

### MarketOrder (discriminant 0)

```
[8 bytes + N]  Symbol string (u64 length + UTF-8)
[1 byte]       is_buy (bool)
[8 bytes]      size (scaled u64, round(sz * 1e8))
[1 byte]       reduce_only (bool)
[1 byte]       iso (bool; true routes via the per-instrument isolated account)
```

### LimitOrder (discriminant 1)

```
[8 bytes + N]  Symbol string (u64 length + UTF-8)
[1 byte]       is_buy (bool)
[8 bytes]      price (scaled u64, round(px * 1e8))
[8 bytes]      size  (scaled u64, round(sz * 1e8))
[4 bytes]      tif   (u32 LE variant index: 0=GTC, 1=IOC, 2=ALO)
[1 byte]       reduce_only (bool)
[1 byte]       iso (bool; true routes via the per-instrument isolated account)
```

### ModifyOrder (discriminant 2)

```
[32 bytes]     Order ID (bs58.decode)
[8 bytes + N]  Symbol string (u64 length + UTF-8)
[8 bytes]      Amount (plain f64 LE, NOT scaled)
```

### Cancel (discriminant 3)

```
[8 bytes + N]  Symbol string (u64 length + UTF-8)
[32 bytes]     Order ID (bs58.decode)
```

### CancelAll (discriminant 4)

```
[8 bytes]      Symbols count (u64, LE)
For each symbol:
  [8 bytes + N]  Symbol string
```

### Stop (discriminant 5) and TakeProfit (discriminant 6)

```
[8 bytes + N]  Symbol string (u64 length + UTF-8)
[1 byte]       Trigger direction (bool; true=above/equal, false=below/equal)
[8 bytes]      Size      (scaled u64)
[8 bytes]      Threshold (scaled u64)
[1 byte]       Limit tag (0=None, 1=Some)
If Some:
  [8 bytes]    Limit   (scaled u64)
[1 byte]       iso (bool; true routes via the per-instrument isolated account)
```

### Range / OCO (discriminant 7)

```
[8 bytes + N]  Symbol string (u64 length + UTF-8)
[1 byte]       Position direction (bool; true=buy/long collar, false=sell/short collar)
[8 bytes]      Size       (scaled u64)
[8 bytes]      Collar min (scaled u64)
[8 bytes]      Collar max (scaled u64)
[1 byte]       Limit min tag (0=None, 1=Some)
If Some:
  [8 bytes]    Limit min  (scaled u64)
[1 byte]       Limit max tag (0=None, 1=Some)
If Some:
  [8 bytes]    Limit max  (scaled u64)
[1 byte]       iso (bool; true routes via the per-instrument isolated account)
```

### Trigger Basket (discriminant 8)

```
[8 bytes + N]  Symbol string (u64 length + UTF-8)
[1 byte]       Trigger direction (bool; true=above/equal, false=below/equal)
[8 bytes]      Threshold (scaled u64)
[8 bytes]      Nested action count (u64, LE)
For each nested action:
  [4 bytes]    Action discriminant (u32, LE)
  [...]        Action payload
[1 byte]       iso (bool; true routes via the per-instrument isolated account)
```

### Trailing (discriminant 9)

```
[8 bytes + N]  Symbol string (u64 length + UTF-8)
[1 byte]       Position direction (bool; true=long protection, false=short protection)
[8 bytes]      Size (scaled u64)
[4 bytes]      Trail bps (u32, LE)
[4 bytes]      Step bps  (u32, LE)
[1 byte]       Limit tag (0=None, 1=Some)
If Some:
  [8 bytes]    Limit   (scaled u64)
[1 byte]       iso (bool; true routes via the per-instrument isolated account)
```

### OnFill (discriminant 10)

```
[4 bytes]      Parent seqno (u32, LE)
[8 bytes]      Consequent action count (u64, LE)
For each consequent action:
  [4 bytes]    Action discriminant (u32, LE)
  [...]        Action payload
```

### Price (discriminant 11): admin

```
[8 bytes]      Timestamp (u64, LE)
[8 bytes + N]  Asset string (u64 length + UTF-8)
[8 bytes]      Price (plain f64 LE, NOT scaled)
```

### PythOracle (discriminant 13): admin

```
[8 bytes]      Oracles count (u64, LE)
For each oracle:
  [8 bytes]    Timestamp (u64, LE)
  [8 bytes]    Feed ID   (u64, LE)
  [8 bytes]    Price     (u64, LE; raw integer price from Pyth, NOT scaled)
  [2 bytes]    Exponent  (i16, LE)
```

### Faucet (discriminant 16)

```
[32 bytes]     User pubkey (bs58.decode)
[1 byte]       Amount tag (0=None, 1=Some)
If Some:
  [8 bytes]    Amount (plain f64 LE, NOT scaled)
```

### AgentWalletCreation (discriminant 17)

```
[32 bytes]     Agent pubkey (bs58.decode)
[1 byte]       Delete flag (bool)
```

### UpdateUserSettings (discriminant 18)

```
[8 bytes]      Entry count (u64, LE)
For each entry:
  [8 bytes + N]  Symbol string
  [8 bytes]      Max leverage (plain f64 LE, NOT scaled)
```

### WhitelistFaucet (discriminant 19): admin

```
[32 bytes]     Target pubkey (bs58.decode)
[1 byte]       Whitelist flag (bool)
```

### CreateSubAccount (discriminant 27)

```
[8 bytes + N]  Name string (u64 length + UTF-8)
[1 byte]       margin_symbol tag (0=None, 1=Some)
If Some:
  [8 bytes + M]  margin_symbol string (u64 length + UTF-8)
[1 byte]       margin_amount tag (0=None, 1=Some)
If Some:
  [8 bytes]    margin_amount (plain f64 LE, NOT scaled)
```

### RemoveSubAccount (discriminant 28)

```
[32 bytes]     toRemove pubkey (bs58.decode; sub-account or per-instrument isolated-account pubkey to remove)
```

### Transfer (discriminant 29)

```
[4 bytes]      kind (u32 LE variant index: 0=internal, 1=external)
[32 bytes]     from pubkey (bs58.decode)
[32 bytes]     to   pubkey (bs58.decode)
[8 bytes + N]  marginSymbol string (u64 length + UTF-8)
[8 bytes]      marginAmount (plain f64 LE, NOT scaled)
```

### CreateMultisig (discriminant 30)

```
[8 bytes]      Signers count (u64, LE)
For each signer:
  [32 bytes]   Signer pubkey (bs58.decode)
[4 bytes]      threshold (u32, LE)
[4 bytes]      timeLockSecs (u32, LE)
[4 bytes]      proposalLifetimeSecs (u32, LE)
```

### MultisigPropose (discriminant 31, tag `msp`)

```
[32 bytes]     Multisig pubkey (bs58.decode)
[8 bytes]      Inner action count (u64, LE)
For each inner action:
  [4 bytes]    Action discriminant (u32, LE)
  [...]        Action payload
```

### MultisigApprove (32, `msa`) / Reject (33, `msr`) / Cancel (34, `msc`) / Execute (35, `mse`)

All four share the same body:

```
[32 bytes]     Multisig pubkey (bs58.decode)
[8 bytes]      proposalId (u64, LE)
```

### UpdateMultisigPolicy (discriminant 36, tag `msu`)

Always submitted **inside an `msp` proposal** (never executed directly).

```
[32 bytes]     Multisig pubkey (bs58.decode)
[8 bytes]      Signers count (u64, LE)
For each signer:
  [32 bytes]   Signer pubkey (bs58.decode)
[4 bytes]      threshold (u32, LE)
[4 bytes]      timeLockSecs (u32, LE)
[4 bytes]      proposalLifetimeSecs (u32, LE)
```

### RenameSubAccount (discriminant 37, tag `rsa`)

```
[32 bytes]     Sub-account pubkey (bs58.decode; the sub-account to rename)
[8 bytes + N]  New name string (u64 length + UTF-8)
```

***

## Signing Example (JavaScript/TypeScript)

<Warning>
  **Reference only.** Serialization must match the canonical BULK wincode encoding exactly. For production, prefer the official [bulk-keychain](https://github.com/Bulk-trade/bulk-keychain) library.
</Warning>

### Install Dependencies

```bash theme={null}
pnpm install tweetnacl bs58
# or
yarn add tweetnacl bs58
```

### Implementation

<CodeGroup>
  ```typescript Writers & scaled-f64 convention theme={null}
  import * as nacl from 'tweetnacl';
  import bs58 from 'bs58';

  // --- Primitive writers (little-endian, fixed-width, bincode-compatible) ---

  function writeU8(value: number): Uint8Array {
    return new Uint8Array([value & 0xff]);
  }

  function writeU32(value: number): Uint8Array {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, value, true);
    return buf;
  }

  function writeI16(value: number): Uint8Array {
    const buf = new Uint8Array(2);
    new DataView(buf.buffer).setInt16(0, value, true);
    return buf;
  }

  function writeU64(value: number | bigint): Uint8Array {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setBigUint64(0, BigInt(value), true);
    return buf;
  }

  function writeF64(value: number): Uint8Array {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setFloat64(0, value, true);
    return buf;
  }

  function writeBool(value: boolean): Uint8Array {
    return new Uint8Array([value ? 1 : 0]);
  }

  function writeString(str: string): Uint8Array {
    const bytes = new TextEncoder().encode(str);
    return concatBytes(writeU64(bytes.length), bytes);
  }

  function concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const a of arrays) { out.set(a, off); off += a.length; }
    return out;
  }

  // --- Exchange fixed-point convention ---

  const SCALE = 1e8;

  /** Scaled f64: encoded as u64 LE of round(x * 1e8). */
  function writeScaled(value: number): Uint8Array {
    const fixed = Math.round(value * SCALE);
    if (!Number.isFinite(fixed) || fixed < 0) {
      throw new Error(`scaled value must be a finite non-negative number (got ${value})`);
    }
    return writeU64(BigInt(fixed));
  }

  /** Option<scaled f64>: 1-byte tag + (if Some) u64 LE scaled. */
  function writeOptScaled(value: number | null | undefined): Uint8Array {
    if (value === null || value === undefined) return writeU8(0);
    return concatBytes(writeU8(1), writeScaled(value));
  }

  /** Option<plain f64>: 1-byte tag + (if Some) raw IEEE-754 f64 LE. */
  function writeOptF64(value: number | null | undefined): Uint8Array {
    if (value === null || value === undefined) return writeU8(0);
    return concatBytes(writeU8(1), writeF64(value));
  }
  ```

  ```typescript Action bodies theme={null}
  // Each action body starts with a u32 LE discriminant.

  const TIF_CODES: Record<string, number> = { GTC: 0, IOC: 1, ALO: 2 };

  function serializeMarketOrder(o: any): Uint8Array {
    return concatBytes(
      writeU32(0),                    // discriminant
      writeString(o.c),               // symbol
      writeBool(o.b),                 // is_buy
      writeScaled(o.sz),              // size (scaled u64)
      writeBool(o.r),                 // reduce_only
    );
  }

  function serializeLimitOrder(o: any): Uint8Array {
    return concatBytes(
      writeU32(1),                    // discriminant
      writeString(o.c),               // symbol
      writeBool(o.b),                 // is_buy
      writeScaled(o.px),              // price (scaled u64)
      writeScaled(o.sz),              // size  (scaled u64)
      writeU32(TIF_CODES[o.tif] ?? 0),// tif   (u32 LE variant index)
      writeBool(o.r),                 // reduce_only
    );
  }

  function serializeModifyOrder(d: any): Uint8Array {
    return concatBytes(
      writeU32(2),                    // discriminant
      bs58.decode(d.oid),             // order ID (32 bytes)
      writeString(d.c),               // symbol
      writeF64(d.sz),                 // amount (plain f64, NOT scaled)
    );
  }

  function serializeCancel(d: any): Uint8Array {
    return concatBytes(
      writeU32(3),                    // discriminant
      writeString(d.c),               // symbol
      bs58.decode(d.oid),             // order ID (32 bytes)
    );
  }

  function serializeCancelAll(d: any): Uint8Array {
    const parts: Uint8Array[] = [writeU32(4), writeU64(d.c.length)];
    for (const sym of d.c) parts.push(writeString(sym));
    return concatBytes(...parts);
  }

  // Stop (5) and TakeProfit (6) share the same body layout.
  function serializeStopOrTP(disc: 5 | 6, d: any): Uint8Array {
    return concatBytes(
      writeU32(disc),                 // discriminant
      writeString(d.c),               // symbol
      writeBool(d.d),                 // trigger direction (is_above)
      writeScaled(d.sz),              // size      (scaled u64)
      writeScaled(d.tr),              // threshold (scaled u64)
      writeOptScaled(d.lim),          // limit     (Option<scaled u64>)
    );
  }

  function serializeRange(d: any): Uint8Array {
    return concatBytes(
      writeU32(7),                    // discriminant
      writeString(d.c),               // symbol
      writeBool(d.d),                 // position direction
      writeScaled(d.sz),              // size        (scaled u64)
      writeScaled(d.pmin),            // collar_min  (scaled u64)
      writeScaled(d.pmax),            // collar_max  (scaled u64)
      writeOptScaled(d.lmin),         // limit_min   (Option<scaled u64>)
      writeOptScaled(d.lmax),         // limit_max   (Option<scaled u64>)
    );
  }

  function serializeTriggerBasket(d: any): Uint8Array {
    const nested = d.actions || [];
    const parts: Uint8Array[] = [
      writeU32(8),                    // discriminant
      writeString(d.c),               // symbol
      writeBool(d.d),                 // trigger direction
      writeScaled(d.tr),              // threshold  (scaled u64)
      writeU64(nested.length),        // nested action count
    ];
    for (const n of nested) parts.push(serializeAction(n));
    return concatBytes(...parts);
  }

  function serializeTrailing(d: any): Uint8Array {
    return concatBytes(
      writeU32(9),                    // discriminant
      writeString(d.c),               // symbol
      writeBool(d.b),                 // position direction (is_buy)
      writeScaled(d.sz),              // size      (scaled u64)
      writeU32(d.trb),                // trail_bps (u32)
      writeU32(d.stb),                // step_bps  (u32)
      writeOptScaled(d.lim),          // limit     (Option<scaled u64>)
    );
  }

  function serializeOnFill(d: any): Uint8Array {
    const nested = d.actions || [];
    const parts: Uint8Array[] = [
      writeU32(10),                   // discriminant
      writeU32(d.p),                  // parent seqno
      writeU64(nested.length),        // consequent action count
    ];
    for (const n of nested) parts.push(serializeAction(n));
    return concatBytes(...parts);
  }

  function serializePrice(d: any): Uint8Array {
    return concatBytes(
      writeU32(11),                   // discriminant
      writeU64(d.t),                  // timestamp
      writeString(d.c),               // asset
      writeF64(d.px),                 // price (plain f64, NOT scaled)
    );
  }

  function serializePythOracle(d: any): Uint8Array {
    const oracles = d.oracles || [];
    const parts: Uint8Array[] = [writeU32(13), writeU64(oracles.length)];
    for (const o of oracles) {
      parts.push(
        writeU64(o.t),                // timestamp
        writeU64(o.fi),               // feed id
        writeU64(o.px),               // price (raw u64)
        writeI16(o.e),                // exponent
      );
    }
    return concatBytes(...parts);
  }

  function serializeFaucet(d: any): Uint8Array {
    return concatBytes(
      writeU32(16),                   // discriminant
      bs58.decode(d.u),               // user pubkey
      writeOptF64(d.amount),          // amount (Option<plain f64>)
    );
  }

  function serializeAgentWalletCreation(d: any): Uint8Array {
    return concatBytes(
      writeU32(17),                   // discriminant
      bs58.decode(d.a),               // agent pubkey
      writeBool(d.d),                 // delete flag
    );
  }

  function serializeUpdateUserSettings(d: any): Uint8Array {
    const entries = Object.entries(d.m || {}) as [string, number][];
    // NOTE: server deserializes into HashMap<String, f64>. If you sign more than one
    // entry you MUST use the same iteration order as the server would on re-serialize.
    // Today the safest path is to submit a single-entry map at a time.
    const parts: Uint8Array[] = [writeU32(18), writeU64(entries.length)];
    for (const [sym, lev] of entries) {
      parts.push(writeString(sym), writeF64(lev)); // leverage is plain f64
    }
    return concatBytes(...parts);
  }

  function serializeWhitelistFaucet(d: any): Uint8Array {
    return concatBytes(
      writeU32(19),                   // discriminant
      bs58.decode(d.target),          // target pubkey
      writeBool(d.whitelist),         // whitelist flag
    );
  }

  function serializeAction(action: any): Uint8Array {
    const [type, data] = Object.entries(action)[0] as [string, any];
    switch (type) {
      case 'm':                     return serializeMarketOrder(data);
      case 'l':                     return serializeLimitOrder(data);
      case 'mod':                   return serializeModifyOrder(data);
      case 'cx':                    return serializeCancel(data);
      case 'cxa':                   return serializeCancelAll(data);
      case 'st':                    return serializeStopOrTP(5, data);
      case 'tp':                    return serializeStopOrTP(6, data);
      case 'rng':                   return serializeRange(data);
      case 'trig':                  return serializeTriggerBasket(data);
      case 'trl':                   return serializeTrailing(data);
      case 'of':                    return serializeOnFill(data);
      case 'px':                    return serializePrice(data);
      case 'o':                     return serializePythOracle(data);
      case 'faucet':                return serializeFaucet(data);
      case 'agentWalletCreation':   return serializeAgentWalletCreation(data);
      case 'updateUserSettings':    return serializeUpdateUserSettings(data);
      case 'whitelistFaucet':       return serializeWhitelistFaucet(data);
      default: throw new Error(`Unknown action: ${type}`);
    }
  }
  ```

  ```typescript Sign & send theme={null}
  function serializeTransaction(
    actions: any[],
    nonce: number | bigint,
    account: string,
  ): Uint8Array {
    const parts: Uint8Array[] = [writeU64(actions.length)];
    for (const action of actions) parts.push(serializeAction(action));
    parts.push(writeU64(nonce));
    parts.push(bs58.decode(account));   // 32 bytes
    return concatBytes(...parts);
  }

  function signTransaction(
    secretKey: Uint8Array,
    actions: any[],
    nonce: number | bigint,
    account: string,
  ): string {
    const message = serializeTransaction(actions, nonce, account);
    const signature = nacl.sign.detached(message, secretKey);
    return bs58.encode(signature);
  }

  // --- Usage ---

  const account = "9J8TUdEWrrcADK913r1Cs7DdqX63VdVU88imfDzT1ypt";
  const signer = account;
  const secretKey = bs58.decode("YOUR_SECRET_KEY_BASE58"); // 64 bytes
  const nonce = Date.now();

  const actions = [
    { l: { c: "BTC-USD", b: true, px: 100000.0, sz: 0.1, tif: "GTC", r: false } },
  ];

  const signature = signTransaction(secretKey, actions, nonce, account);

  const tx = { actions, nonce, account, signer, signature };

  await fetch('https://exchange-api1.northstarlabs.xyz/api/v1/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx),
  });
  ```
</CodeGroup>

***

## Account vs Signer

The transaction includes two separate public key fields:

* **`account`**: The account being traded (whose positions/orders are affected).
* **`signer`**: Who is signing the transaction (usually same as account, or an authorized agent).

### Same Account and Signer

Most common case, you're trading your own account:

```javascript theme={null}
const transaction = {
  actions: [{ l: { c: "BTC-USD", b: true, px: 100000.0, sz: 0.1, tif: "GTC", r: false } }],
  nonce: Date.now(),
  account: myPublicKey,
  signer: myPublicKey,
  signature: "..."
};
```

### Agent Wallet (Different Signer)

Agent wallet trading on behalf of user:

```javascript theme={null}
const transaction = {
  actions: [{ l: { c: "BTC-USD", b: true, px: 100000.0, sz: 0.1, tif: "GTC", r: false } }],
  nonce: Date.now(),
  account: userPublicKey,    // User's account being traded
  signer: agentPublicKey,    // Agent signing (must be pre-authorized)
  signature: "..."
};
```

Requirements:

1. Agent must be pre-authorized via an `agentWalletCreation` action (see [Manage Agent Wallet](/api-reference/manageAgentWallet)).
2. Agent signs with their own private key.
3. Order executes against the user's account.

<Warning>
  **Agent Wallets**: If `signer != account`, the signer must be pre-authorized via [Manage Agent Wallet](/api-reference/manageAgentWallet) first.
</Warning>

***

## Offchain Signing Mode

The default and preferred signing path is the raw canonical-binary form documented above. The server additionally accepts an **offchain signing mode** for any transaction shape. This exists so that wallets/devices that can only sign clear-text messages (Phantom, Ledger, hardware signers) can still produce valid transactions.

### Signature Mode Hint Header

When you use offchain signing, set this hint header so the verifier tries the matching path first:

| Surface                       | Header            | Allowed values                  |
| ----------------------------- | ----------------- | ------------------------------- |
| `POST /order` (HTTP)          | `x-bulk-sig-mode` | `raw` \| `offchain` \| `base58` |
| WebSocket upgrade (handshake) | `x-bulk-sig-mode` | `raw` \| `offchain` \| `base58` |

Semantics:

* Missing header: server uses the default raw canonical-binary verification path.
* Invalid value: ignored safely (falls back to the default raw path).
* Valid value: used **only as an attempt-order hint**. Signature validity still decides accept/reject.
* The header is never trusted for authentication by itself.
* Offchain-signed payloads should set `x-bulk-sig-mode: offchain`.

### Offchain Envelope

The signed bytes are the full Solana v0 offchain-message envelope:

```text theme={null}
0xff "solana offchain"
|| version(0x00)
|| app_domain(32 zero bytes)
|| format(1 byte)
|| signer_count(1 byte = 0x01)
|| signer_pubkey(32 bytes)
|| payload_len(u16 LE)
|| payload
```

* `format = 0x00` -> printable ASCII payload.
* `format = 0x01` -> UTF-8 payload.
* The server verifies the **exact full envelope bytes**; nothing is chunked or truncated. Practical signability is limited by the wallet/device.

### Offchain Payload (Clear-Sign Text)

The `payload` is deterministic clear-sign text built from the transaction fields. Action lines are emitted in transaction order:

```text theme={null}
Bulk Exchange Transaction
Account: <base58_pubkey>
Nonce: <u64>
Actions: <count>
Signable-Hash: <sha256_hex_of_bincode(actions) || nonce_le_u64 || account_bytes>
[0] <action_line_0>
[1] <action_line_1>
...
```

Optional debug/verbose line (off by default for cleaner Ledger UX):

```text theme={null}
Signable-Schema: bincode(actions) || nonce_le_u64 || account_bytes
```

Submission rules:

* HTTP: send the standard transaction JSON to `POST /order` with `x-bulk-sig-mode: offchain`. `signature` is base58 of the 64-byte Ed25519 signature over the envelope above.
* WebSocket: set the handshake header `x-bulk-sig-mode: offchain` on the upgrade, then post transactions normally via the `post` method.
* The raw canonical-binary path remains the default for any connection that does not opt in.

### Legacy Wallet-Compatibility Path (Owner-Signed `agentWalletCreation` Only)

For a **single owner-signed `agentWalletCreation` action** (`signer == account` and exactly one action), the server additionally accepts two legacy compatibility signatures, intended to support older wallet UIs that cannot use the general offchain mode above:

1. Signature over `bs58_encode(canonical_binary_message).as_bytes()`.
2. Signature over the same v0 Solana offchain-message envelope described above, wrapping the canonical binary message as the payload (`format = 0x00`).

These paths exist only for owner registration / removal of agent wallets. Use the canonical binary path or the general offchain mode for everything else.

***

## Implementation Notes

<Tip>
  **Official signing library**: [bulk-keychain](https://github.com/Bulk-trade/bulk-keychain) provides signing for Node.js, browser (WASM), Python, and Rust with the correct protocol encoding (scaled-f64 convention, discriminants, and order-ID hashing). For production use, prefer bulk-keychain over manual implementation.
</Tip>

### Common Issues

<AccordionGroup>
  <Accordion title="Invalid signature">
    The binary message must match the server's wincode serialization exactly:

    * Use `bs58.decode()` to convert base58 `Pubkey`/`Hash` strings into raw 32-byte arrays.
    * All enum variant tags (outer action types **and** `tif`) are `u32` LE.
    * `Vec`/`String` lengths are `u64` LE.
    * Price/size/threshold/limit `f64` fields are **fixed-point scaled** (`round(x * 1e8)` as `u64` LE), not raw `f64`. The plain-`f64` fields are listed in the encoding table above.
    * The `signature` itself is NOT part of the signed message. Sign the binary, then `bs58.encode()` the 64-byte Ed25519 signature for the JSON payload.
    * Order actions (`l`, `m`, `st`, `tp`, `rng`, `trig`, `trl`) always serialise the trailing `i` (isolated routing) byte. Always include `i` in the JSON payload (`true` or `false`); omitting it produces a `bad signature` even though the field is a boolean.
  </Accordion>

  <Accordion title="Unauthorized signer">
    If `signer != account`, the signer must be pre-authorized for `account`:

    * The `account` itself is always allowed to sign for itself.
    * [Agent wallets](/api-reference/manageAgentWallet) registered on a master can sign for that master **and for any of its [sub-accounts](/api-reference/manageSubAccounts)**. Sub-accounts can also register their own agent wallets.
    * For sub-accounts, set `account` to the sub-account pubkey and `signer` to the master, the sub-account itself, or any agent wallet registered on either.
    * Isolated accounts are never set as `account` directly; orders routed there use the `i` flag on the master/sub-account transaction. See [Isolated Margin](/bulk-exchange/isolated-margin).
  </Accordion>

  <Accordion title="Account not found">
    Account must be funded first via a faucet action (see [Request Faucet](/api-reference/requestFaucet) on testnet).
  </Accordion>

  <Accordion title="Replay attack / duplicate nonce">
    Each nonce can only be used once. Use timestamps or incrementing counters.
  </Accordion>

  <Accordion title="Round-tripping server responses into signatures">
    Scaled fields (`sz`, `px`, `tr`, `pmin`, `pmax`, `lim`, `lmin`, `lmax`) are returned as **JSON strings** in responses but must be signed from their numeric value (`parseFloat` → `round(x * 1e8)`).
  </Accordion>
</AccordionGroup>
