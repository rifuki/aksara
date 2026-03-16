import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAppWallet } from "@/hooks/use-app-wallet";
import { Zap, X } from "lucide-react";

const TTL_OPTIONS = [
  { label: "5m", ms: 5 * 60_000 },
  { label: "30m", ms: 30 * 60_000 },
  { label: "1h", ms: 60 * 60_000 },
  { label: "2h", ms: 120 * 60_000 },
];

export function AutoSignToggle() {
  const { connected } = useWallet();
  const appWallet = useAppWallet();
  const [ttlMs, setTtlMs] = useState(TTL_OPTIONS[2].ms);
  const [error, setError] = useState<string | null>(null);

  if (!connected) return null;

  if (appWallet.isActive) {
    return (
      <div className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-slate-800 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-slate-300">Auto-sign active</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500">{appWallet.timeRemaining}</span>
          <button
            onClick={appWallet.disable}
            className="p-1 text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const handleEnable = async () => {
    setError(null);
    try {
      await appWallet.enable(ttlMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {TTL_OPTIONS.map((o) => (
          <button
            key={o.ms}
            onClick={() => setTtlMs(o.ms)}
            className={`flex-1 py-2 px-2 text-[11px] font-mono rounded-md transition-all cursor-pointer ${
              ttlMs === o.ms
                ? "bg-slate-700 text-slate-200 border border-slate-600"
                : "bg-transparent text-slate-500 border border-slate-800 hover:border-slate-700 hover:text-slate-400"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleEnable}
        disabled={appWallet.isLoading}
        className="w-full py-2.5 px-3 bg-slate-100 hover:bg-white disabled:bg-slate-800 disabled:text-slate-600 text-black text-sm font-medium rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {appWallet.isLoading ? (
          <span>Generating...</span>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            <span>Enable Auto-Sign</span>
          </>
        )}
      </button>

      {error && (
        <p className="text-[11px] text-red-400">{error}</p>
      )}
    </div>
  );
}
