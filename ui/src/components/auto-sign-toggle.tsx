import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAppWallet } from "@/hooks/use-app-wallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TTL_OPTIONS = [
  { label: "5 minutes", ms: 5 * 60_000 },
  { label: "30 minutes", ms: 30 * 60_000 },
  { label: "1 hour", ms: 60 * 60_000 },
  { label: "2 hours", ms: 120 * 60_000 },
];

export function AutoSignToggle() {
  const { connected } = useWallet();
  const appWallet = useAppWallet();
  const [ttlMs, setTtlMs] = useState(TTL_OPTIONS[2].ms);
  const [error, setError] = useState<string | null>(null);

  if (!connected) return null;

  if (appWallet.isActive) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                Auto-Sign Active
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-red-500 hover:text-red-600 h-7 px-2"
              onClick={appWallet.disable}
            >
              Disable
            </Button>
          </div>

          <p className="text-xs font-mono text-muted-foreground">
            {appWallet.publicKey?.slice(0, 8)}…{appWallet.publicKey?.slice(-8)}
            {" · "}
            <span className="tabular-nums">{appWallet.timeRemaining}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Requests signed automatically · non-extractable key (Web Crypto)
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleEnable = async () => {
    setError(null);
    try {
      await appWallet.enable(ttlMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable auto-sign");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Auto-Sign (App Wallet)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Generates a non-extractable Ed25519 keypair in your browser (Web Crypto API).
          Private key stays in IndexedDB — never exposed to JavaScript. All API
          requests are signed automatically without wallet popups.
        </p>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Session TTL</span>
          <Select
            value={String(ttlMs)}
            onValueChange={(v) => setTtlMs(Number(v))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TTL_OPTIONS.map((o) => (
                <SelectItem key={o.ms} value={String(o.ms)} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          className="w-full"
          size="sm"
          onClick={handleEnable}
          disabled={appWallet.isLoading}
        >
          {appWallet.isLoading ? "Generating keypair…" : "Enable Auto-Sign"}
        </Button>

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
