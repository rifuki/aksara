import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Program ID (matches Anchor.toml)
const PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_PROGRAM_ID ?? "H2MUTZ1NSYpGJ1aQgksemfADNfTPurE7doJ77kffCZaE"
);

// Anchor discriminators: sha256("global:<ix_name>")[..8]
const GRANT_DISCRIMINATOR = new Uint8Array([72, 163, 82, 98, 220, 130, 23, 148]);
const REVOKE_DISCRIMINATOR = new Uint8Array([44, 8, 248, 220, 181, 135, 246, 139]);

const SCOPE_OPTIONS = [
  { label: "READ (read-only)", value: 0x01 },
  { label: "READ + WRITE", value: 0x03 },
  { label: "READ + WRITE + DELETE", value: 0x07 },
];

const TTL_OPTIONS = [
  { label: "1 hour", seconds: 3600 },
  { label: "24 hours", seconds: 86400 },
  { label: "7 days", seconds: 7 * 86400 },
];

function getGrantPda(owner: PublicKey, grantee: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode("access"),
      owner.toBytes(),
      grantee.toBytes(),
    ],
    PROGRAM_ID
  );
  return pda;
}

/** Encode i64 as little-endian 8 bytes (browser-compatible, no Buffer) */
function i64LeBytes(value: bigint): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setBigInt64(0, value, true);
  return new Uint8Array(buf);
}

export function GrantPanel() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [grantee, setGrantee] = useState("");
  const [scope, setScope] = useState(0x01);
  const [ttlSeconds, setTtlSeconds] = useState(3600);
  const [loading, setLoading] = useState<"grant" | "revoke" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!publicKey) return null;

  const handleGrant = async () => {
    if (!grantee.trim() || !sendTransaction) return;
    setStatus(null);
    setLoading("grant");
    try {
      const granteePk = new PublicKey(grantee.trim());
      const grantPda = getGrantPda(publicKey, granteePk);
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + ttlSeconds);

      // Instruction data: discriminator(8) + scope(u8,1) + expires_at(i64 LE,8) = 17 bytes
      const data = new Uint8Array(17);
      data.set(GRANT_DISCRIMINATOR, 0);
      data[8] = scope;
      data.set(i64LeBytes(expiresAt), 9);

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: granteePk, isSigner: false, isWritable: false },
          { pubkey: grantPda, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(data),
      });

      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setStatus({ ok: true, msg: `Granted! Tx: ${sig.slice(0, 16)}…` });
      setGrantee("");
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  };

  const handleRevoke = async () => {
    if (!grantee.trim() || !sendTransaction) return;
    setStatus(null);
    setLoading("revoke");
    try {
      const granteePk = new PublicKey(grantee.trim());
      const grantPda = getGrantPda(publicKey, granteePk);

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: false },
          { pubkey: granteePk, isSigner: false, isWritable: false },
          { pubkey: grantPda, isSigner: false, isWritable: true },
        ],
        data: Buffer.from(REVOKE_DISCRIMINATOR),
      });

      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setStatus({ ok: true, msg: `Revoked! Tx: ${sig.slice(0, 16)}…` });
      setGrantee("");
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Access Grant Manager</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Grant or revoke on-chain API access for another wallet. The backend
          verifies the <code>AccessGrant</code> PDA on every request.
        </p>

        <Input
          placeholder="Grantee wallet address (base58)"
          value={grantee}
          onChange={(e) => setGrantee(e.target.value)}
          className="font-mono text-xs"
        />

        <div className="flex gap-2">
          <Select value={String(scope)} onValueChange={(v) => setScope(Number(v))}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(ttlSeconds)} onValueChange={(v) => setTtlSeconds(Number(v))}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TTL_OPTIONS.map((o) => (
                <SelectItem key={o.seconds} value={String(o.seconds)} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={handleGrant}
            disabled={!grantee.trim() || loading !== null}
          >
            {loading === "grant" ? "Sending…" : "Grant Access"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={handleRevoke}
            disabled={!grantee.trim() || loading !== null}
          >
            {loading === "revoke" ? "Sending…" : "Revoke"}
          </Button>
        </div>

        {status && (
          <p className={`text-xs font-mono ${status.ok ? "text-emerald-600" : "text-red-500"}`}>
            {status.msg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
