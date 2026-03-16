// App Wallet — non-extractable Ed25519 keypair stored in IndexedDB
// Private key NEVER exposed as bytes; signing via crypto.subtle.sign()

import bs58 from "bs58";

const DB_NAME = "aksara-keystore";
const DB_VERSION = 1;
const STORE_NAME = "keys";
const WALLET_KEY = "app-wallet";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AppWallet {
  privateKey: CryptoKey;      // non-extractable
  publicKey: CryptoKey;
  publicKeyBase58: string;    // keyid for RFC 9421 Signature-Input
  createdAt: number;          // ms
  expiresAt: number;          // ms
}

export interface AppWalletSigner {
  publicKeyBase58: string;
  sign: (message: Uint8Array) => Promise<Uint8Array>;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/**
 * Generate a new Ed25519 keypair via Web Crypto.
 * Private key is non-extractable — JS can only use it, not read it.
 */
export async function createAppWallet(
  expiresInMs: number = 3_600_000
): Promise<AppWallet> {
  const keyPair = (await crypto.subtle.generateKey("Ed25519", false, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

  // Public key CAN be exported as raw bytes (32 bytes), then bs58-encoded
  const pubRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyBase58 = bs58.encode(new Uint8Array(pubRaw));

  const now = Date.now();
  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicKeyBase58,
    createdAt: now,
    expiresAt: now + expiresInMs,
  };
}

/** Save AppWallet to IndexedDB (CryptoKey stored via structured cloning). */
export async function saveAppWallet(wallet: AppWallet): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  await idbRequest(
    tx.objectStore(STORE_NAME).put(
      {
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        publicKeyBase58: wallet.publicKeyBase58,
        createdAt: wallet.createdAt,
        expiresAt: wallet.expiresAt,
      },
      WALLET_KEY
    )
  );
  await idbTransaction(tx);
  db.close();
}

/**
 * Load AppWallet from IndexedDB.
 * Returns null if not found or expired.
 */
export async function loadAppWallet(): Promise<AppWallet | null> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return null;
  }
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const data = await idbRequest<AppWallet | undefined>(
      tx.objectStore(STORE_NAME).get(WALLET_KEY)
    );
    db.close();
    if (!data) return null;
    if (data.expiresAt <= Date.now()) {
      await clearAppWallet();
      return null;
    }
    return data;
  } catch {
    db.close();
    return null;
  }
}

/** Remove AppWallet from IndexedDB. */
export async function clearAppWallet(): Promise<void> {
  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return;
  }
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    await idbRequest(tx.objectStore(STORE_NAME).delete(WALLET_KEY));
    await idbTransaction(tx);
  } finally {
    db.close();
  }
}

// ── Signer ────────────────────────────────────────────────────────────────────

/**
 * Convert a loaded AppWallet into a signer compatible with use-signed-api.
 * Uses crypto.subtle.sign() — private key bytes never touched by JS.
 */
export function toSigner(wallet: AppWallet): AppWalletSigner {
  return {
    publicKeyBase58: wallet.publicKeyBase58,
    sign: async (message: Uint8Array): Promise<Uint8Array> => {
      // message.slice() always returns a new Uint8Array with a plain ArrayBuffer
      const buf = message.slice().buffer as ArrayBuffer;
      const sig = await crypto.subtle.sign("Ed25519", wallet.privateKey, buf);
      return new Uint8Array(sig);
    },
  };
}

// ── IndexedDB Helpers ─────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
