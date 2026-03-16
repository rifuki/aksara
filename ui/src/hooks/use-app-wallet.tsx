import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useWallet } from "@solana/wallet-adapter-react";

import {
  clearAppWallet,
  createAppWallet,
  loadAppWallet,
  saveAppWallet,
  toSigner,
  type AppWalletSigner,
} from "@/lib/app-wallet";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppWalletState {
  isActive: boolean;
  isLoading: boolean;
  publicKey: string | null;
  timeRemaining: string;
  enable: (expiresInMs?: number) => Promise<void>;
  disable: () => Promise<void>;
  getSigner: () => AppWalletSigner | null;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AppWalletContext = createContext<AppWalletState | null>(null);

export function AppWalletProvider({ children }: { children: ReactNode }) {
  const { publicKey: mainPubkey, signMessage } = useWallet();

  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState("");
  const signerRef = useRef<AppWalletSigner | null>(null);

  // Load existing wallet from IndexedDB on mount
  useEffect(() => {
    loadAppWallet()
      .then((stored) => {
        if (stored) {
          signerRef.current = toSigner(stored);
          setPublicKey(stored.publicKeyBase58);
          setExpiresAt(stored.expiresAt);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Countdown timer — updates every second while app wallet is active
  useEffect(() => {
    if (!expiresAt) {
      setTimeRemaining("");
      return;
    }
    const tick = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        signerRef.current = null;
        setPublicKey(null);
        setExpiresAt(null);
        clearAppWallet();
        setTimeRemaining("expired");
        return;
      }
      const m = Math.floor(remaining / 60_000);
      const s = Math.floor((remaining % 60_000) / 1000);
      setTimeRemaining(`${m}m ${s.toString().padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const enable = useCallback(
    async (expiresInMs = 3_600_000) => {
      if (!mainPubkey || !signMessage) {
        throw new Error("Main wallet not connected");
      }

      setIsLoading(true);
      try {
        // 1. Generate non-extractable Ed25519 keypair
        const wallet = await createAppWallet(expiresInMs);

        // 2. Ask main wallet to sign an authorization message (1 popup)
        //    This proves the owner explicitly approved this session key.
        const expiryDate = new Date(wallet.expiresAt).toISOString();
        const authMessage =
          `Aksara Auto-Sign Authorization\n` +
          `Owner:     ${mainPubkey.toBase58()}\n` +
          `App wallet: ${wallet.publicKeyBase58}\n` +
          `Expires:   ${expiryDate}\n\n` +
          `This authorizes the browser session key to sign API requests on your behalf.`;

        await signMessage(new TextEncoder().encode(authMessage));

        // 3. Save to IndexedDB and activate
        await saveAppWallet(wallet);
        signerRef.current = toSigner(wallet);
        setPublicKey(wallet.publicKeyBase58);
        setExpiresAt(wallet.expiresAt);
      } finally {
        setIsLoading(false);
      }
    },
    [mainPubkey, signMessage]
  );

  const disable = useCallback(async () => {
    await clearAppWallet();
    signerRef.current = null;
    setPublicKey(null);
    setExpiresAt(null);
  }, []);

  const getSigner = useCallback(() => signerRef.current, []);

  return (
    <AppWalletContext.Provider
      value={{
        isActive: publicKey !== null,
        isLoading,
        publicKey,
        timeRemaining,
        enable,
        disable,
        getSigner,
      }}
    >
      {children}
    </AppWalletContext.Provider>
  );
}

export function useAppWallet(): AppWalletState {
  const ctx = useContext(AppWalletContext);
  if (!ctx) throw new Error("useAppWallet must be used within AppWalletProvider");
  return ctx;
}
