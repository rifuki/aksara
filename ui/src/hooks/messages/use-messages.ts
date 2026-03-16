import { useProtectedQuery } from "@/hooks/use-protected-api";
import { ENDPOINTS } from "@/api/endpoints";
import type { Message } from "@/api/types";

export function useMessages() {
  return useProtectedQuery<Message[]>({ path: ENDPOINTS.messages.list.path });
}
