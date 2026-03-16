import { useEffect } from "react";

import { useWallet } from "@solana/wallet-adapter-react";

import { client as api } from "@/api/client";
import {
  computeContentDigest,
  buildSignatureBase,
  serializeSignatureInput,
  serializeSignature,
  generateNonce,
  type SignatureParams,
} from "@/lib/sign-request";

const TTL_SECONDS = 60;

export function useSignedApi() {
  const wallet = useWallet();

  useEffect(() => {
    if (!wallet.publicKey || !wallet.signMessage) return;

    const publicKey = wallet.publicKey;
    const signMessage = wallet.signMessage;

    const id = api.interceptors.request.use(async (config) => {
      const method = config.method?.toUpperCase() ?? "GET";
      // config.url is the relative path since baseURL is set on axios instance
      const path = config.url ?? "/";
      const authority = new URL(api.defaults.baseURL!).host;

      const now = Math.floor(Date.now() / 1000);
      const params: SignatureParams = {
        created: now,
        expires: now + TTL_SECONDS,
        keyid: publicKey.toBase58(),
        nonce: generateNonce(),
      };

      // Determine components (@authority first, then @method, @path)
      const components = ["@authority", "@method", "@path"];
      const extraValues: Record<string, string> = {};

      // Only compute Content-Digest when there is a body
      const hasBody = config.data != null && method !== "GET";
      if (hasBody) {
        const bodyStr =
          typeof config.data === "string"
            ? config.data
            : JSON.stringify(config.data);
        const digest = await computeContentDigest(bodyStr);
        config.headers["content-digest"] = digest;
        components.push("content-digest");
        extraValues["content-digest"] = digest;
      }

      // Build RFC 9421 signature base and sign it
      const sigBase = buildSignatureBase(method, authority, path, components, extraValues, params);
      const signature = await signMessage(new TextEncoder().encode(sigBase));

      // Attach RFC 9421 headers
      config.headers["signature-input"] = serializeSignatureInput(components, params);
      config.headers["signature"] = serializeSignature(signature);

      return config;
    });

    return () => api.interceptors.request.eject(id);
  }, [wallet.publicKey, wallet.signMessage]);

  return api;
}
