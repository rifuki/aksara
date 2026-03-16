import { useProtectedQuery } from "@/hooks/use-protected-api";
import { ENDPOINTS } from "@/api/endpoints";
import type { Message } from "@/api/types";

const e = ENDPOINTS.messages.get;

export function useMessage(id: string) {
  return useProtectedQuery<Message>({
    path: e.path.replace(":id", id),
  });
}
