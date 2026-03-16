import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ALL_ENDPOINTS, METHOD_COLORS, buildPath, type Endpoint } from "@/api/endpoints";
import { usePublicQuery, useProtectedQuery, useProtectedMutation } from "@/hooks/use-protected-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

export function ApiTester() {
  const { connected } = useWallet();
  const [selected, setSelected] = useState<Endpoint>(ALL_ENDPOINTS[0]);
  const [params, setParams] = useState<Record<string, string>>({});
  const [body, setBody] = useState<Record<string, string>>({});

  const resolvedPath = buildPath(selected, params);
  const isGet = selected.method === "GET";
  const isPrivate = selected.auth === "private";

  function handleSelect(label: string) {
    const endpoint = ALL_ENDPOINTS.find((e) => e.label === label)!;
    setSelected(endpoint);
    setParams({});
    setBody({});
  }

  // Private endpoints require wallet connection
  const locked = isPrivate && !connected;

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Tester</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select onValueChange={handleSelect} defaultValue={selected.label}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_ENDPOINTS.map((e) => (
              <SelectItem key={e.label} value={e.label}>
                <span className={METHOD_COLORS[e.method]}>{e.method}</span>
                <span className="ml-2 text-muted-foreground">{e.label}</span>
                <span className="ml-2">
                  {e.auth === "public" ? "🌐" : "🔒"}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selected.params?.map((field) => (
          <div key={field.name} className="space-y-1">
            <Label>{field.label}</Label>
            <Input
              placeholder={field.placeholder}
              value={params[field.name] ?? ""}
              onChange={(e) => setParams({ ...params, [field.name]: e.target.value })}
            />
          </div>
        ))}

        {selected.body?.map((field) => (
          <div key={field.name} className="space-y-1">
            <Label>{field.label}</Label>
            <Input
              placeholder={field.placeholder}
              value={body[field.name] ?? ""}
              onChange={(e) => setBody({ ...body, [field.name]: e.target.value })}
            />
          </div>
        ))}

        <Separator />

        <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
          <Badge variant="outline" className={METHOD_COLORS[selected.method]}>
            {selected.method}
          </Badge>
          <Badge variant={isPrivate ? "default" : "secondary"} className="text-xs">
            {isPrivate ? "🔒 private" : "🌐 public"}
          </Badge>
          <span className="truncate">{resolvedPath}</span>
        </div>

        {locked ? (
          <p className="text-sm text-muted-foreground">
            Connect your wallet to use private endpoints.
          </p>
        ) : isGet ? (
          <GetAction path={resolvedPath} auth={selected.auth} />
        ) : (
          <MutateAction endpoint={selected} path={resolvedPath} body={body} />
        )}
      </CardContent>
    </Card>
  );
}

function GetAction({
  path,
  auth,
}: {
  path: string;
  auth: "public" | "private";
}) {
  const pub = usePublicQuery<unknown>({ path, enabled: false });
  const priv = useProtectedQuery<unknown>({ path, enabled: false });

  const { data, isFetching, isError, error, refetch } =
    auth === "public" ? pub : priv;

  return (
    <div className="space-y-3">
      <Button onClick={() => refetch()} disabled={isFetching} className="w-full">
        {isFetching ? "Fetching..." : "Send"}
      </Button>
      <ResponseBox data={data} isLoading={isFetching} isError={isError} error={error} />
    </div>
  );
}

function MutateAction({
  endpoint,
  path,
  body,
}: {
  endpoint: Endpoint;
  path: string;
  body: Record<string, string>;
}) {
  const mutation = useProtectedMutation<
    { path: string; body: Record<string, string> },
    unknown
  >(({ path, body }) => ({
    method: endpoint.method as "POST" | "PUT" | "DELETE",
    path,
    body,
  }));

  return (
    <div className="space-y-3">
      <Button
        onClick={() => mutation.mutate({ path, body })}
        disabled={mutation.isPending}
        className="w-full"
      >
        {mutation.isPending ? "Sending..." : "Send"}
      </Button>
      <ResponseBox
        data={mutation.data}
        isLoading={mutation.isPending}
        isError={mutation.isError}
        error={mutation.error}
      />
    </div>
  );
}

function ResponseBox({
  data,
  isLoading,
  isError,
  error,
}: {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}) {
  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground animate-pulse">
        Waiting for response...
      </p>
    );
  if (isError) return <p className="text-sm text-red-500">{error?.message}</p>;
  if (!data) return null;
  return (
    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-60">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
