import { createFileRoute } from "@tanstack/react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/wallet-button";
import { ApiTester } from "@/components/api-tester";
import { AutoSignToggle } from "@/components/auto-sign-toggle";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { connected } = useWallet();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Aksara</h1>
        <WalletButton />
      </div>
      {!connected && (
        <p className="text-sm text-muted-foreground">
          Connect your wallet to get started.
        </p>
      )}
      <AutoSignToggle />
      <ApiTester />
    </div>
  );
}
