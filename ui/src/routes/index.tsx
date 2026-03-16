import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useProtectedGet } from "@/hooks/use-protected-api";
import { type ApiResponse } from "@/lib/types";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <h1 className="text-2xl font-bold">Welcome to Aksara</h1>
      <AksaraCard />
    </>
  );
}

function AksaraCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState("/aksara");

  const { data, isLoading, isError, error, refetch } =
    useProtectedGet<ApiResponse>(path);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aksara</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input ref={inputRef} defaultValue="/aksara" placeholder="/aksara" />
          <Button
            onClick={() => {
              const value = inputRef.current?.value ?? path;
              if (value === path) refetch();
              else setPath(value);
            }}
            disabled={isLoading}
          >
            {isLoading ? "Fetching..." : "GET"}
          </Button>
        </div>
        {isError && <p className="text-sm text-red-500">{error.message}</p>}
        {data && (
          <pre className="text-sm bg-muted p-3 rounded-md overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
