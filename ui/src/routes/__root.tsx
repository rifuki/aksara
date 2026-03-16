import { createRootRoute, Outlet } from "@tanstack/react-router";
import { SolanaProvider } from "@/providers/solana";
import { TanstackQueryProvider } from "@/providers/tanstack-query";
import { WalletButton } from "@/components/wallet-button";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <TanstackQueryProvider>
      <SolanaProvider>
        <WalletButton />
        <Outlet />
      </SolanaProvider>
    </TanstackQueryProvider>
  );
}
