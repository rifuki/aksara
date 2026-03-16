import { useState } from "react";
import { SolanaIcon } from "./icons/solana";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

async function copyToClipboard({
  text,
  setIsCopied,
}: {
  text: string;
  setIsCopied: (value: boolean) => void;
}) {
  try {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
  }
}

function shortenAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [isCopied, setIsCopied] = useState(false);

  if (!connected || !publicKey) {
    return (
      <Button onClick={() => setVisible(true)}>
        <SolanaIcon />
        Connect Wallet
      </Button>
    );
  }

  const address = publicKey.toBase58();
  const short_address = shortenAddress(address);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>{short_address}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel
          className="flex items-center justify-between cursor-pointer"
          onClick={() => copyToClipboard({ text: address, setIsCopied })}
        >
          {isCopied ? "Copied!" : "Copy Address"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={disconnect}>Disconnect</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
