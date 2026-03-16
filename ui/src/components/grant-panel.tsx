import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAksaraProgram } from "@/hooks/use-aksara-program";

const SCOPE_OPTIONS = [
  { label: "READ (read-only)",          value: 0x01 },
  { label: "READ + WRITE",              value: 0x03 },
  { label: "READ + WRITE + DELETE",     value: 0x07 },
];

const TTL_OPTIONS = [
  { label: "1 hour",   seconds: 3_600 },
  { label: "24 hours", seconds: 86_400 },
  { label: "7 days",   seconds: 7 * 86_400 },
];

export function GrantPanel() {
  const { publicKey } = useWallet();
  const program = useAksaraProgram();

  const [grantee, setGrantee]     = useState("");
  const [scope, setScope]         = useState(0x01);
  const [ttl, setTtl]             = useState(3_600);
  const [loading, setLoading]     = useState<"grant" | "revoke" | null>(null);
  const [status, setStatus]       = useState<{ ok: boolean; msg: string } | null>(null);

  if (!publicKey || !program) return null;

  const handleGrant = async () => {
    if (!grantee.trim()) return;
    setStatus(null);
    setLoading("grant");
    try {
      const expiresAt = new BN(Math.floor(Date.now() / 1000) + ttl);
      const sig = await program.methods
        .grantAccess(scope, expiresAt)
        .accounts({ grantee })
        .rpc();
      setStatus({ ok: true, msg: `Granted! Tx: ${sig.slice(0, 16)}…` });
      setGrantee("");
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  };

  const handleRevoke = async () => {
    if (!grantee.trim()) return;
    setStatus(null);
    setLoading("revoke");
    try {
      const sig = await program.methods
        .revokeAccess()
        .accounts({ grantee })
        .rpc();
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

          <Select value={String(ttl)} onValueChange={(v) => setTtl(Number(v))}>
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
