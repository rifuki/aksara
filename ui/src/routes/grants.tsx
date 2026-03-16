import { createFileRoute } from "@tanstack/react-router";
import { GrantPanel } from "@/components/grant-panel";
import { WalletButton } from "@/components/wallet-button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/grants")({
  component: GrantsPage,
});

function GrantsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 font-mono">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">back to playground</span>
            </Link>
          </div>
          <WalletButton />
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-white">Access Grant Manager</h1>
          <p className="text-sm text-slate-500">
            Issue and revoke on-chain access grants via Solana PDA
          </p>
        </div>

        {/* Grant Panel */}
        <Card className="bg-[#111] border-slate-800">
          <CardContent className="p-6">
            <GrantPanel />
          </CardContent>
        </Card>

        {/* Info */}
        <div className="p-4 bg-slate-900/50 rounded border border-slate-800 text-xs text-slate-500 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">PDA Seed:</span>
            <code className="text-emerald-400">["access", owner, grantee]</code>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Scopes:</span>
            <span className="text-blue-400">READ (0x01)</span>
            <span className="text-slate-600">|</span>
            <span className="text-purple-400">WRITE (0x02)</span>
            <span className="text-slate-600">|</span>
            <span className="text-red-400">DELETE (0x04)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
