import { useProtectedMutation } from "@/hooks/use-protected-api";
import { ENDPOINTS } from "@/api/endpoints";
import type { Message } from "@/api/types";

const e = ENDPOINTS.messages;

export function useCreateMessage() {
  return useProtectedMutation<{ content: string }, Message>(
    (body) => ({ method: e.create.method, path: e.create.path, body }),
    { invalidates: [e.list.path, e.mine.path] },
  );
}
