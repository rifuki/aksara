export type ParamField = {
  name: string;
  label: string;
  placeholder: string;
};

export type AuthLevel = "public" | "signature" | "grant";

export type Endpoint = {
  label: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  auth: AuthLevel;
  description?: string;
  params?: ParamField[];
  body?: ParamField[];
};

export const ENDPOINTS = {
  messages: {
    list: {
      label: "List Messages",
      method: "GET" as const,
      path: "/aksara/messages",
      auth: "public" as const,
      description: "Browse all messages without authentication",
    },
    get: {
      label: "Get Message",
      method: "GET" as const,
      path: "/aksara/messages/:id",
      auth: "public" as const,
      description: "View a specific message by ID",
      params: [{ name: "id", label: "Message ID", placeholder: "uuid..." }],
    },
    create: {
      label: "Post Message",
      method: "POST" as const,
      path: "/aksara/messages",
      auth: "signature" as const,
      description: "Create new message (signature required)",
      body: [{ name: "content", label: "Content", placeholder: "Hello world" }],
    },
    mine: {
      label: "My Messages",
      method: "GET" as const,
      path: "/aksara/messages/mine",
      auth: "grant" as const,
      description: "View your messages (requires access grant)",
    },
    update: {
      label: "Edit Message",
      method: "PUT" as const,
      path: "/aksara/messages/:id",
      auth: "grant" as const,
      description: "Update your message (requires access grant)",
      params: [{ name: "id", label: "Message ID", placeholder: "uuid..." }],
      body: [{ name: "content", label: "Content", placeholder: "Updated content" }],
    },
    delete: {
      label: "Delete Message",
      method: "DELETE" as const,
      path: "/aksara/messages/:id",
      auth: "grant" as const,
      description: "Remove your message (requires access grant)",
      params: [{ name: "id", label: "Message ID", placeholder: "uuid..." }],
    },
  },
};

export function buildPath(
  endpoint: Endpoint,
  params: Record<string, string>,
): string {
  let path = endpoint.path;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, value || `:${key}`);
  }
  return path;
}

export const ALL_ENDPOINTS: Endpoint[] = Object.values(ENDPOINTS).flatMap(
  (group) => Object.values(group),
);

export const METHOD_COLORS: Record<Endpoint["method"], string> = {
  GET: "text-emerald-500",
  POST: "text-blue-500",
  PUT: "text-amber-500",
  DELETE: "text-red-500",
};

export const AUTH_CONFIG: Record<AuthLevel, { label: string; color: string }> = {
  public: { label: "Open", color: "text-slate-400" },
  signature: { label: "Sign", color: "text-blue-400" },
  grant: { label: "Grant", color: "text-purple-400" },
};
