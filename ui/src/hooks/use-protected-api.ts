import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { signedFetch } from "@/lib/signed-fetch";

const API_BASE: string = import.meta.env.VITE_API_URL!;

export function useProtectedGet<T>(path: string) {
  const wallet = useWallet();

  return useQuery<T>({
    queryKey: ["protected", path, wallet.publicKey?.toBase58()],
    queryFn: async () => {
      const res = await signedFetch(wallet, `${API_BASE}${path}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? res.statusText);
      }
      return res.json();
    },
    enabled: !!wallet.connected && !!wallet.publicKey,
    retry: false,
  });
}
