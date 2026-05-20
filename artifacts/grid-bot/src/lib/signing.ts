import init, { sign_limit_order } from 'bulk-keychain-wasm';

let initialized = false;

export async function ensureInitialized() {
  if (!initialized) {
    await init();
    initialized = true;
  }
}

export async function placeLimitOrder(
  privateKeyBase58: string,
  account: string,
  symbol: string,
  isBuy: boolean,
  price: number,
  size: number,
  tif = 'GTC',
  endpoint = 'https://staging-api.bulk.trade/api/v1'
) {
  await ensureInitialized();
  
  const nonce = (BigInt(Date.now()) * 1_000_000n).toString();
  const signed = sign_limit_order(privateKeyBase58, account, symbol, isBuy, price, size, tif, false, false, nonce);
  
  const response = await fetch(`${endpoint}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signed)
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to place order: ${err}`);
  }
  
  return response.json();
}
