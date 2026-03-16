import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { WalletButton } from "@/components/wallet-button";
import { AppWalletProvider } from "@/hooks/use-app-wallet";
import { Shield } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { connected, publicKey } = useWallet();

  return (
    <QueryClientProvider client={queryClient}>
      <AppWalletProvider>
      <div className="min-h-screen bg-[#0a0a0a] text-slate-200 flex flex-col">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#0a0a0a]/95 backdrop-blur">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-500" />
                <span className="font-bold text-white">Aksara</span>
              </Link>
              
              <nav className="hidden sm:flex items-center gap-1">
                <NavLink to="/">Playground</NavLink>
                <NavLink to="/grants">Grants</NavLink>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {connected && publicKey && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <code className="text-xs text-slate-400">
                    {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                  </code>
                </div>
              )}
              <WalletButton />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6">
          <Outlet />
        </main>

        {/* Simple Footer */}
        <footer className="border-t border-slate-800 mt-auto">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span>RFC 9421</span>
              <span className="text-slate-800">•</span>
              <span>RFC 9530</span>
              <span className="text-slate-800">•</span>
              <span>Solana</span>
            </div>
            
            <a 
              href="https://github.com/rifuki/aksara"
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-slate-400 transition-colors"
            >
              GitHub
            </a>
          </div>
        </footer>
      </div>
      </AppWalletProvider>
    </QueryClientProvider>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-md hover:bg-slate-800/50 transition-colors"
      activeProps={{ className: "text-white bg-slate-800" }}
    >
      {children}
    </Link>
  );
}
