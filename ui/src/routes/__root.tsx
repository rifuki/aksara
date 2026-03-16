import { createRootRoute, Outlet } from "@tanstack/react-router";
import { SolanaProvider } from "@/providers/solana";
import { TanstackQueryProvider } from "@/providers/tanstack-query";
import { AppWalletProvider } from "@/hooks/use-app-wallet";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <TanstackQueryProvider>
      <SolanaProvider>
        <AppWalletProvider>
          <Outlet />
        </AppWalletProvider>
      </SolanaProvider>
    </TanstackQueryProvider>
  );
}
