import { useEffect } from "react";

import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

import { client as api } from "@/api/client";
import { buildMessage, hashBody } from "@/lib/sign-request";

export function useSignedApi() {
  const wallet = useWallet();

  useEffect(() => {
    if (!wallet.publicKey || !wallet.signMessage) return;

    const publicKey = wallet.publicKey;
    const signMessage = wallet.signMessage;

    const id = api.interceptors.request.use(async (config) => {
      const method = config.method?.toUpperCase() || "GET";
      const path = config.url ?? "";
      const timestamp = Date.now();
      const bodyStr = config.data ? JSON.stringify(config.data) : undefined;
      const bodyHash = await hashBody(bodyStr);
      const message = buildMessage(method, path, timestamp, bodyHash);
      const signature = await signMessage(new TextEncoder().encode(message));

      config.headers["x-wallet-address"] = publicKey.toBase58();
      config.headers["x-timestamp"] = timestamp.toString();
      config.headers["x-signature"] = bs58.encode(signature);

      return config;
    });

    return () => api.interceptors.request.eject(id);
  }, [wallet.publicKey, wallet.signMessage]);

  return api;
}
