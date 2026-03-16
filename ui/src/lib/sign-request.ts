// RFC 9421 HTTP Message Signatures + RFC 9530 Content-Digest

export const LABEL = "sol";

// ── Content-Digest (RFC 9530) ────────────────────────────────────────────────

/**
 * Compute Content-Digest header value.
 * Format: sha-256=:<base64>:
 */
export async function computeContentDigest(body: string): Promise<string> {
  const data = new TextEncoder().encode(body);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const b64 = uint8ToBase64(new Uint8Array(hashBuffer));
  return `sha-256=:${b64}:`;
}

// ── Nonce ────────────────────────────────────────────────────────────────────

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Signature Base (RFC 9421 §2.5) ──────────────────────────────────────────

export interface SignatureParams {
  created: number;   // unix seconds
  expires: number;   // unix seconds
  keyid: string;     // base58 pubkey
  nonce: string;
}

/**
 * Build the RFC 9421 signature base string.
 *
 * Example output:
 * "@method": POST
 * "@authority": localhost:8080
 * "@path": /aksara/messages
 * "content-digest": sha-256=:<base64>:
 * "@signature-params": ("@method" "@authority" "@path" "content-digest");created=...;expires=...;keyid="...";nonce="..."
 */
export function buildSignatureBase(
  method: string,
  authority: string,
  path: string,
  components: string[],
  componentValues: Record<string, string>,
  params: SignatureParams,
): string {
  const componentMap: Record<string, string> = {
    "@method": method.toUpperCase(),
    "@authority": authority,
    "@path": path,
    ...componentValues,
  };

  const lines = components.map((c) => `"${c}": ${componentMap[c]}`);
  const paramsStr = buildSignatureParamsStr(components, params);
  lines.push(`"@signature-params": ${paramsStr}`);
  return lines.join("\n");
}

function buildSignatureParamsStr(
  components: string[],
  params: SignatureParams,
): string {
  const list = components.map((c) => `"${c}"`).join(" ");
  return (
    `(${list})` +
    `;created=${params.created}` +
    `;expires=${params.expires}` +
    `;keyid="${params.keyid}"` +
    `;nonce="${params.nonce}"`
  );
}

// ── Header Serialization ─────────────────────────────────────────────────────

/**
 * Serialize Signature-Input header.
 * Format: sol=("@method" "@authority" "@path" "content-digest");created=...
 */
export function serializeSignatureInput(
  components: string[],
  params: SignatureParams,
): string {
  return `${LABEL}=${buildSignatureParamsStr(components, params)}`;
}

/**
 * Serialize Signature header.
 * Format: sol=:<base64>:
 */
export function serializeSignature(signature: Uint8Array): string {
  return `${LABEL}=:${uint8ToBase64(signature)}:`;
}

// ── Utilities ────────────────────────────────────────────────────────────────

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

