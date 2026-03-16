import { createFileRoute, Link } from "@tanstack/react-router";
import { GrantPanel } from "@/components/grant-panel";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/grants")({
  component: GrantsPage,
});

function GrantsPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Playground</span>
        </Link>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Grants</h1>
          <p className="text-slate-500">
            Manage on-chain permissions via Solana PDA
          </p>
        </div>

        <div className="p-6 bg-[#0f0f0f] rounded-xl border border-slate-800">
          <GrantPanel />
        </div>

        <div className="p-4 bg-slate-900/30 rounded-lg border border-slate-800">
          <div className="text-xs font-mono text-slate-500 mb-2">PDA SEED</div>
          <code className="text-xs font-mono text-emerald-400">
            ["access", owner, grantee]
          </code>
          
          <div className="mt-4 text-xs font-mono text-slate-500 mb-2">SCOPES</div>
          <div className="flex gap-4 text-xs">
            <span className="text-blue-400">READ (0x01)</span>
            <span className="text-purple-400">WRITE (0x02)</span>
            <span className="text-red-400">DELETE (0x04)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
