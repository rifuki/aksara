import { createFileRoute, Link } from "@tanstack/react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/wallet-button";
import { Playground } from "@/components/playground";
import { Shield, Github } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              <span className="font-bold text-white">Aksara</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-4">
              <Link 
                to="/" 
                className="text-sm text-slate-400 hover:text-white transition-colors"
                activeProps={{ className: "text-white" }}
              >
                Playground
              </Link>
              <Link 
                to="/grants" 
                className="text-sm text-slate-400 hover:text-white transition-colors"
                activeProps={{ className: "text-white" }}
              >
                Grants
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {connected && publicKey && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                <span>Connected:</span>
                <code className="text-emerald-400">
                  {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
                </code>
              </div>
            )}
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto">
        <Playground />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-auto">
        <div className="max-w-[1600px] mx-auto px-6 h-10 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span>RFC 9421</span>
            <span>•</span>
            <span>RFC 9530</span>
            <span>•</span>
            <span>Solana PDA</span>
          </div>
          
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-slate-400 transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
