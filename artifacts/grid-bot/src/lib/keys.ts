import * as nacl from "tweetnacl";
import bs58 from "bs58";

export function derivePublicKey(privateKeyBase58: string): string {
  try {
    const decoded = bs58.decode(privateKeyBase58);
    // Depending on the key format, bulk uses ed25519
    // Assuming the private key is 64 bytes (seed + pubkey) or 32 bytes (seed)
    let keyPair;
    if (decoded.length === 64) {
      keyPair = nacl.sign.keyPair.fromSecretKey(decoded);
    } else if (decoded.length === 32) {
      keyPair = nacl.sign.keyPair.fromSeed(decoded);
    } else {
      throw new Error("Invalid private key length");
    }
    return bs58.encode(keyPair.publicKey);
  } catch (e) {
    console.error("Key derivation error", e);
    return "";
  }
}

export function getPrivateKey(): string | null {
  return localStorage.getItem("bulk_private_key");
}

export function savePrivateKey(key: string) {
  localStorage.setItem("bulk_private_key", key);
}

export function getEndpoint(): string {
  return localStorage.getItem("bulk_endpoint") || "staging";
}

export function saveEndpoint(env: "staging" | "production") {
  localStorage.setItem("bulk_endpoint", env);
}
