import { useWallet } from "@solana/wallet-adapter-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ApiResponse } from "@/api/types";
import { useSignedApi } from "@/hooks/use-signed-api";

const queryProctectedKey = ({
  publicKey,
  path,
}: {
  publicKey?: string;
  path: string;
}) => ["protected", publicKey, path];

export function useProtectedQuery<T>({ 
  path,
  enabled = true,
}: { 
  path: string;
  enabled?: boolean;
}) {
  const wallet = useWallet();
  const api = useSignedApi();

  return useQuery<ApiResponse<T>>({
    queryKey: queryProctectedKey({
      path,
      publicKey: wallet.publicKey?.toBase58(),
    }),
    queryFn: async () => {
      const res = await api.get<ApiResponse<T>>(path);
      return res.data;
    },
    enabled: !!wallet.connected && !!wallet.publicKey && enabled,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

interface MutationRequest {
  method: "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
}

export function useProtectedMutation<TInput, TData = unknown>(
  buildRequest: (input: TInput) => MutationRequest,
  options?: { invalidates?: string[] },
) {
  const wallet = useWallet();
  const api = useSignedApi();

  const queryClient = useQueryClient();

  return useMutation<ApiResponse<TData>, Error, TInput>({
    mutationFn: async (input) => {
      const { method, path, body } = buildRequest(input);
      const res = await api.request<ApiResponse<TData>>({
        method,
        url: path,
        data: body,
      });
      return res.data;
    },
    onSuccess: () => {
      options?.invalidates?.forEach((path) => {
        queryClient.invalidateQueries({
          queryKey: queryProctectedKey({
            path,
            publicKey: wallet.publicKey?.toBase58(),
          }),
        });
      });
    },
  });
}
