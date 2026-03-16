import { type WalletContextState } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

export async function hashBody(body?: string): Promise<string> {
  const data = new TextEncoder().encode(body ?? "");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildMessage(
  method: string,
  path: string,
  timestamp: number,
  bodyHash: string,
): string {
  return `${method}\n${path}\n${timestamp}\n${bodyHash}`;
}



export async function signedFetch(
  wallet: WalletContextState,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error("Wallet not connected");
  }

  const method = init?.method?.toUpperCase() || "GET";
  const path = new URL(url).pathname;
  const timestamp = Date.now();
  const bodyStr = typeof init?.body == "string" ? init.body : undefined;
  const bodyHash = await hashBody(bodyStr);

  const message = `${method}\n${path}\n${timestamp}\n${bodyHash}`;
  const encoded = new TextEncoder().encode(message);
  const signature = await wallet.signMessage(encoded);

  console.log("message to sign:", JSON.stringify(message));
  console.log("wallet:", wallet.publicKey.toBase58());
  console.log("signature:", bs58.encode(signature));

  return fetch(url, {
    ...init,
    method,
    headers: {
      ...init?.headers,
      "Content-Type": "application/json",
      "x-wallet-address": wallet.publicKey.toBase58(),
      "x-timestamp": timestamp.toString(),
      "x-signature": bs58.encode(signature),
    },
  });
}
