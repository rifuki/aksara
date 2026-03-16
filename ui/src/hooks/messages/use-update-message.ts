import { useProtectedMutation } from "@/hooks/use-protected-api";
import { ENDPOINTS } from "@/api/endpoints";
import type { Message } from "@/api/types";

const e = ENDPOINTS.messages;

export function useUpdateMessage() {
  return useProtectedMutation<{ id: string; content: string }, Message>(
    ({ id, content }) => ({
      method: e.update.method,
      path: e.update.path.replace(":id", id),
      body: { content },
    }),
    { invalidates: [e.list.path, e.mine.path] },
  );
}
