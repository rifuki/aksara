export type ParamField = {
  name: string;
  label: string;
  placeholder: string;
};

export type Endpoint = {
  label: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  params?: ParamField[];
  body?: ParamField[];
};

export const ENDPOINTS = {
  messages: {
    list: {
      label: "List All Messages",
      method: "GET" as const,
      path: "/aksara/messages",
    },
    mine: {
      label: "My Messages",
      method: "GET" as const,
      path: "/aksara/messages/mine",
    },
    get: {
      label: "Get Message",
      method: "GET" as const,
      path: "/aksara/messages/:id",
      params: [{ name: "id", label: "Message ID", placeholder: "uuid..." }],
    },
    create: {
      label: "Create Message",
      method: "POST" as const,
      path: "/aksara/messages",
      body: [
        { name: "content", label: "Content", placeholder: "Hello world" },
      ],
    },
    update: {
      label: "Update Message",
      method: "PUT" as const,
      path: "/aksara/messages/:id",
      params: [{ name: "id", label: "Message ID", placeholder: "uuid..." }],
      body: [
        {
          name: "content",
          label: "Content",
          placeholder: "Updated content",
        },
      ],
    },
    delete: {
      label: "Delete Message",
      method: "DELETE" as const,
      path: "/aksara/messages/:id",
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
