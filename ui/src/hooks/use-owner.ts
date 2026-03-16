import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { client } from "@/api/client";
import type { ApiSuccess } from "@/api/types";

interface OwnerResponse {
  owner: string | null;
}

async function fetchOwner(): Promise<string | null> {
  const res = await client.get<ApiSuccess<OwnerResponse>>("/aksara/owner");
  return res.data.data?.owner ?? null;
}

export function useOwner() {
  const { connected } = useWallet();

  const { data: ownerPubkey, isLoading } = useQuery({
    queryKey: ["owner"],
    queryFn: fetchOwner,
    enabled: connected,
    staleTime: Infinity, // owner pubkey tidak berubah selama runtime
  });

  return { ownerPubkey: ownerPubkey ?? null, isLoading };
}
