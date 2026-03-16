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
import { Textarea } from "@/components/ui/textarea";
import { Send, Globe, Lock, ChevronRight, Clock } from "lucide-react";

export function ApiTester() {
  const { connected } = useWallet();
  const [selected, setSelected] = useState<Endpoint>(ALL_ENDPOINTS[0]);
  const [params, setParams] = useState<Record<string, string>>({});
  const [body, setBody] = useState<Record<string, string>>({});

  const resolvedPath = buildPath(selected, params);
  const isGet = selected.method === "GET";
  const isPrivate = selected.auth === "private";
  const locked = isPrivate && !connected;

  function handleSelect(label: string) {
    const endpoint = ALL_ENDPOINTS.find((e) => e.label === label)!;
    setSelected(endpoint);
    setParams({});
    setBody({});
  }

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-purple-500" />
            <CardTitle className="text-base">API Tester</CardTitle>
          </div>
          <Badge 
            variant={isPrivate ? "default" : "secondary"} 
            className="text-xs gap-1"
          >
            {isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
            {isPrivate ? "Signature Required" : "Public"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Test endpoints with live request signing. {isPrivate && "Private endpoints require wallet signature."}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Endpoint Selector */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Endpoint</Label>
          <Select onValueChange={handleSelect} defaultValue={selected.label}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_ENDPOINTS.map((e) => (
                <SelectItem key={e.label} value={e.label}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${METHOD_COLORS[e.method]}`}>
                      {e.method}
                    </span>
                    <span className="text-sm">{e.label}</span>
                    <span className="ml-auto text-xs opacity-50">
                      {e.auth === "public" ? "🌐" : "🔒"}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Request Preview */}
        <div className="p-3 bg-slate-900 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className={`font-bold ${METHOD_COLORS[selected.method]}`}>
              {selected.method}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-500" />
            <span className="text-slate-300 font-mono text-xs truncate">{resolvedPath}</span>
          </div>
        </div>

        {/* Parameters */}
        {selected.params?.map((field) => (
          <div key={field.name} className="space-y-1">
            <Label className="text-xs font-medium">{field.label}</Label>
            <Input
              placeholder={field.placeholder}
              value={params[field.name] ?? ""}
              onChange={(e) => setParams({ ...params, [field.name]: e.target.value })}
              className="h-9"
            />
          </div>
        ))}

        {/* Body Editor */}
        {selected.body?.map((field) => (
          <div key={field.name} className="space-y-1">
            <Label className="text-xs font-medium">{field.label}</Label>
            <Textarea
              placeholder={field.placeholder}
              value={body[field.name] ?? ""}
              onChange={(e) => setBody({ ...body, [field.name]: e.target.value })}
              className="font-mono text-xs min-h-[60px]"
            />
          </div>
        ))}

        <Separator />

        {/* Action Area */}
        {locked ? (
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center">
            <Lock className="w-5 h-5 text-amber-600 mx-auto mb-2" />
            <p className="text-sm text-amber-800">
              Connect your wallet to call this private endpoint.
            </p>
          </div>
        ) : isGet ? (
          <GetAction path={resolvedPath} auth={selected.auth} />
        ) : (
          <MutateAction endpoint={selected} path={resolvedPath} body={body} />
        )}
      </CardContent>
    </Card>
  );
}

function GetAction({ path, auth }: { path: string; auth: "public" | "private" }) {
  const pub = usePublicQuery<unknown>({ path, enabled: false });
  const priv = useProtectedQuery<unknown>({ path, enabled: false });

  const { data, isFetching, isError, error, refetch } =
    auth === "public" ? pub : priv;

  return (
    <div className="space-y-3">
      <Button 
        onClick={() => refetch()} 
        disabled={isFetching} 
        className="w-full gap-2"
      >
        <Send className="w-4 h-4" />
        {isFetching ? "Sending..." : "Send Request"}
      </Button>
      <ResponseInspector data={data} isLoading={isFetching} isError={isError} error={error} />
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
        className="w-full gap-2"
      >
        <Send className="w-4 h-4" />
        {mutation.isPending ? "Signing & Sending..." : "Sign & Send Request"}
      </Button>
      <ResponseInspector 
        data={mutation.data} 
        isLoading={mutation.isPending} 
        isError={mutation.isError} 
        error={mutation.error} 
      />
    </div>
  );
}

function ResponseInspector({
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

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-50 rounded-lg border border-dashed">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4 animate-spin" />
          <span>Signing request with Ed25519...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
        <div className="text-sm font-medium text-red-800 mb-1">Error</div>
        <div className="text-sm text-red-700">{error?.message || "Request failed"}</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b">
        <Badge variant="secondary" className="text-xs">200 OK</Badge>
      </div>
      <pre className="text-xs bg-white p-3 overflow-auto max-h-60">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
