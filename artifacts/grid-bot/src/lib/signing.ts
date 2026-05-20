import * as nacl from "tweetnacl";
import bs58 from "bs58";

// Action discriminants from bulk.trade signing docs
const ACTION_CODES = {
  m:   0,  // market order
  l:   1,  // limit order
  mod: 2,  // modify order
  cx:  3,  // cancel
  cxa: 4,  // cancel all
  faucet: 16,
  updateUserSettings: 18,
} as const;

const TIF_CODES = { GTC: 0, IOC: 1, ALO: 2 } as const;

// ── Binary writer (wincode / bincode-compatible) ──────────────────────────────

class WincodeWriter {
  private parts: Uint8Array[] = [];

  u8(v: number) {
    this.parts.push(new Uint8Array([v]));
  }

  u32le(v: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v, true);
    this.parts.push(b);
  }

  u64le(v: bigint) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setBigUint64(0, v, true);
    this.parts.push(b);
  }

  f64le(v: number) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, v, true);
    this.parts.push(b);
  }

  // String: u64LE length + UTF-8 bytes
  str(s: string) {
    const bytes = new TextEncoder().encode(s);
    this.u64le(BigInt(bytes.length));
    this.parts.push(bytes);
  }

  raw(b: Uint8Array) {
    this.parts.push(b);
  }

  build(): Uint8Array {
    const total = this.parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of this.parts) { out.set(p, offset); offset += p.length; }
    return out;
  }
}

// Scaled f64: round(value * 1e8) as u64 LE
function scaledU64(v: number): bigint {
  return BigInt(Math.round(v * 1e8));
}

// ── Action types ──────────────────────────────────────────────────────────────

export interface LimitAction {
  type: "l";
  symbol: string;
  isBuy: boolean;
  price: number;
  size: number;
  tif?: "GTC" | "IOC" | "ALO";
  reduceOnly?: boolean;
  iso?: boolean;
}

export interface CancelAllAction {
  type: "cxa";
  symbols: string[]; // empty = cancel all symbols
}

export interface FaucetAction {
  type: "faucet";
  user: string;   // recipient pubkey (base58); required per docs (`u` field)
  amount?: number; // optional; plain f64
}

export type BulkAction = LimitAction | CancelAllAction | FaucetAction;

// ── Wincode serialization per action ─────────────────────────────────────────

function encodeAction(w: WincodeWriter, action: BulkAction) {
  if (action.type === "l") {
    w.u32le(ACTION_CODES.l);
    w.str(action.symbol);
    w.u8(action.isBuy ? 1 : 0);
    w.u64le(scaledU64(action.price));
    w.u64le(scaledU64(action.size));
    w.u32le(TIF_CODES[action.tif ?? "GTC"]);
    w.u8(action.reduceOnly ? 1 : 0);
    w.u8(action.iso ? 1 : 0);
    return;
  }

  if (action.type === "cxa") {
    w.u32le(ACTION_CODES.cxa);
    w.u64le(BigInt(action.symbols.length));
    for (const sym of action.symbols) w.str(sym);
    return;
  }

  if (action.type === "faucet") {
    w.u32le(ACTION_CODES.faucet);
    // Binary layout: [32 bytes user pubkey] [1 byte amount tag] [8 bytes plain f64 if Some]
    w.raw(bs58.decode(action.user)); // 32 raw bytes
    if (action.amount !== undefined) {
      w.u8(1); // Option::Some
      w.f64le(action.amount); // plain f64, NOT scaled
    } else {
      w.u8(0); // Option::None
    }
    return;
  }
}

// ── Action → JSON wire format ─────────────────────────────────────────────────

function actionToJson(action: BulkAction): unknown {
  if (action.type === "l") {
    return {
      l: {
        c: action.symbol,
        b: action.isBuy,
        px: String(action.price),
        sz: String(action.size),
        tif: action.tif ?? "GTC",
        r: action.reduceOnly ?? false,
        i: action.iso ?? false,
      },
    };
  }
  if (action.type === "cxa") {
    return { cxa: { c: action.symbols } };
  }
  if (action.type === "faucet") {
    // JSON field name is `u` per docs: { "faucet": { "u": "pubkey" } }
    return action.amount !== undefined
      ? { faucet: { u: action.user, amount: action.amount } }
      : { faucet: { u: action.user } };
  }
  return {};
}

// ── Core: build + sign a transaction ─────────────────────────────────────────

export interface SignedTransaction {
  actions: unknown[];
  nonce: string;
  account: string;
  signer: string;
  signature: string;
}

export function buildAndSign(
  actions: BulkAction[],
  accountBase58: string,
  privateKeyBase58: string
): SignedTransaction {
  // Deserialize private key
  const privBytes = bs58.decode(privateKeyBase58);
  const keyPair =
    privBytes.length === 64
      ? nacl.sign.keyPair.fromSecretKey(privBytes)
      : nacl.sign.keyPair.fromSeed(privBytes);

  // Nonce: nanoseconds
  const nonce = BigInt(Date.now()) * 1_000_000n;

  // Build canonical binary message: actions + nonce + account
  const w = new WincodeWriter();
  w.u64le(BigInt(actions.length));
  for (const a of actions) encodeAction(w, a);
  w.u64le(nonce);
  w.raw(bs58.decode(accountBase58)); // 32 raw bytes

  const message = w.build();
  const sig = nacl.sign.detached(message, keyPair.secretKey);

  return {
    actions: actions.map(actionToJson),
    nonce: nonce.toString(),
    account: accountBase58,
    signer: bs58.encode(keyPair.publicKey),
    signature: bs58.encode(sig),
  };
}

// ── HTTP submission ───────────────────────────────────────────────────────────

export async function submitTransaction(
  tx: SignedTransaction,
  httpEndpoint: string,
  env = "staging"
): Promise<{ ok: boolean; statuses?: unknown[]; error?: string }> {
  try {
    const res = await fetch(`${httpEndpoint}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bulk-env": env },
      body: JSON.stringify(tx),
    });
    const body = await res.json() as any;
    if (!res.ok) return { ok: false, error: JSON.stringify(body) };
    const statuses: unknown[] = body?.response?.data?.statuses ?? [];
    return { ok: true, statuses };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export async function placeLimitOrder(opts: {
  privateKey: string;
  account: string;
  symbol: string;
  isBuy: boolean;
  price: number;
  size: number;
  endpoint: string;
  env?: string;
  tif?: "GTC" | "IOC" | "ALO";
  iso?: boolean;
}): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const tx = buildAndSign(
    [{ type: "l", symbol: opts.symbol, isBuy: opts.isBuy, price: opts.price, size: opts.size, tif: opts.tif ?? "GTC", reduceOnly: false, iso: opts.iso ?? false }],
    opts.account,
    opts.privateKey
  );
  const result = await submitTransaction(tx, opts.endpoint, opts.env ?? "staging");
  if (!result.ok) return { ok: false, error: result.error };
  const st = (result.statuses?.[0] as any);
  return { ok: true, orderId: st?.resting?.oid ?? st?.filled?.oid };
}

export async function cancelAllOrders(opts: {
  privateKey: string;
  account: string;
  symbol: string;
  endpoint: string;
  env?: string;
}): Promise<boolean> {
  const tx = buildAndSign(
    [{ type: "cxa", symbols: [opts.symbol] }],
    opts.account,
    opts.privateKey
  );
  const result = await submitTransaction(tx, opts.endpoint, opts.env ?? "staging");
  return result.ok;
}

export async function requestFaucet(opts: {
  privateKey: string;
  account: string;
  endpoint: string;
  env?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const tx = buildAndSign(
    [{ type: "faucet", user: opts.account }],
    opts.account,
    opts.privateKey
  );
  return submitTransaction(tx, opts.endpoint, opts.env ?? "staging");
}
