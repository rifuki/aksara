import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { useAksaraProgram } from "@/hooks/use-aksara-program";
import { useOwner } from "@/hooks/use-owner";
import { Lock, Unlock, Clock, Shield } from "lucide-react";

const SCOPE_OPTIONS = [
  { label: "READ", value: 0x01, desc: "0x01" },
  { label: "READ + WRITE", value: 0x03, desc: "0x03" },
  { label: "READ + WRITE + DELETE", value: 0x07, desc: "0x07" },
];

const TTL_OPTIONS = [
  { label: "1h", seconds: 3_600 },
  { label: "24h", seconds: 86_400 },
  { label: "7d", seconds: 7 * 86_400 },
];

export function GrantPanel() {
  const { publicKey } = useWallet();
  const program = useAksaraProgram();
  const { ownerPubkey, isLoading: ownerLoading } = useOwner();

  const [grantee, setGrantee] = useState("");
  const [scope, setScope] = useState(0x01);
  const [ttl, setTtl] = useState(3_600);
  const [loading, setLoading] = useState<"grant" | "revoke" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string; sig?: string } | null>(null);

  if (!publicKey || !program) {
    return (
      <div className="p-8 text-center text-slate-500">
        <Shield className="w-8 h-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Connect wallet to manage grants</p>
      </div>
    );
  }

  const isOwner = ownerPubkey === null
    ? true
    : publicKey.toBase58() === ownerPubkey;

  const isDisabled = !isOwner || loading !== null;

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
      setStatus({ ok: true, msg: "Access granted", sig });
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
      setStatus({ ok: true, msg: "Access revoked", sig });
      setGrantee("");
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Owner Warning */}
      {!ownerLoading && !isOwner && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-500 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-amber-200">Owner only</p>
              <p className="text-xs text-amber-500/80">
                Only {ownerPubkey?.slice(0, 8)}...{ownerPubkey?.slice(-4)} can manage grants
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grantee Input */}
      <div className="space-y-2">
        <label className="text-xs text-slate-500 font-mono">GRANTEE ADDRESS</label>
        <input
          type="text"
          placeholder="Base58 wallet address..."
          value={grantee}
          onChange={(e) => setGrantee(e.target.value)}
          disabled={isDisabled}
          className="w-full bg-[#111] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-slate-500 disabled:opacity-50"
        />
      </div>

      {/* Scope Selection */}
      <div className="space-y-2">
        <label className="text-xs text-slate-500 font-mono">PERMISSION SCOPE</label>
        <div className="grid grid-cols-3 gap-2">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => !isDisabled && setScope(opt.value)}
              disabled={isDisabled}
              className={`p-3 rounded border text-left transition-colors cursor-pointer disabled:cursor-not-allowed ${
                scope === opt.value
                  ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                  : "bg-[#111] border-slate-700 text-slate-400 hover:border-slate-600"
              } disabled:opacity-50`}
            >
              <div className="text-xs font-medium">{opt.label}</div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* TTL Selection */}
      <div className="space-y-2">
        <label className="text-xs text-slate-500 font-mono">EXPIRATION</label>
        <div className="flex gap-2">
          {TTL_OPTIONS.map((opt) => (
            <button
              key={opt.seconds}
              onClick={() => !isDisabled && setTtl(opt.seconds)}
              disabled={isDisabled}
              className={`flex-1 p-2 rounded border text-sm font-mono transition-colors cursor-pointer disabled:cursor-not-allowed ${
                ttl === opt.seconds
                  ? "bg-slate-700 border-slate-500 text-white"
                  : "bg-[#111] border-slate-700 text-slate-400 hover:border-slate-600"
              } disabled:opacity-50`}
            >
              <Clock className="w-3 h-3 inline mr-1" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={handleGrant}
          disabled={!grantee.trim() || isDisabled}
          className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {loading === "grant" ? "Confirming..." : "Grant Access"}
        </button>
        
        <button
          onClick={handleRevoke}
          disabled={!grantee.trim() || isDisabled}
          className="p-3 bg-red-600/80 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {loading === "revoke" ? "Confirming..." : "Revoke"}
        </button>
      </div>

      {/* Status */}
      {status && (
        <div className={`p-3 rounded text-sm ${
          status.ok 
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
            : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          <div className="flex items-center gap-2">
            {status.ok ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            <span>{status.msg}</span>
          </div>
          {status.sig && (
            <div className="mt-1 text-xs font-mono">
              <span className="text-slate-500">tx: </span>
              <a 
                href={`https://explorer.solana.com/tx/${status.sig}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline break-all"
              >
                {status.sig}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
