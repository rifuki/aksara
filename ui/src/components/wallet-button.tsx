import { useState } from "react";
import { SolanaIcon } from "./icons/solana";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Copy, LogOut } from "lucide-react";

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
    setTimeout(() => setIsCopied(false), 2000);
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
      <button
        onClick={() => setVisible(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-white text-black text-sm font-medium transition-colors cursor-pointer"
      >
        <SolanaIcon />
        Connect Wallet
      </button>
    );
  }

  const address = publicKey.toBase58();
  const short_address = shortenAddress(address);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <code className="text-xs text-slate-300 font-mono">{short_address}</code>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-mono text-xs text-slate-500">
          Connected Wallet
        </DropdownMenuLabel>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => copyToClipboard({ text: address, setIsCopied })}
        >
          <Copy className="w-4 h-4 mr-2" />
          {isCopied ? "Copied!" : "Copy Address"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-red-400 focus:text-red-400"
          onSelect={disconnect}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
