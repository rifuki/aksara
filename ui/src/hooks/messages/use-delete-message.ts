import { useProtectedMutation } from "@/hooks/use-protected-api";
import { ENDPOINTS } from "@/api/endpoints";

const e = ENDPOINTS.messages;

export function useDeleteMessage() {
  return useProtectedMutation<string, null>(
    (id) => ({
      method: e.delete.method,
      path: e.delete.path.replace(":id", id),
    }),
    { invalidates: [e.list.path, e.mine.path] },
  );
}
