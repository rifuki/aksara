import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Editor from "@monaco-editor/react";
import { 
  computeContentDigest, 
  buildSignatureBase, 
  generateNonce,
  serializeSignatureInput,
  serializeSignature,
  type SignatureParams 
} from "@/lib/sign-request";
import { ALL_ENDPOINTS, METHOD_COLORS, AUTH_CONFIG, buildPath, type Endpoint } from "@/api/endpoints";
import { useAppWallet } from "@/hooks/use-app-wallet";
import { client } from "@/api/client";
import { Send, History, Lock } from "lucide-react";

type RequestHistoryItem = {
  id: string;
  timestamp: number;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  status: "success" | "error";
  duration: number;
};

export function Playground() {
  const { publicKey, signMessage, connected } = useWallet();
  const { getSigner } = useAppWallet();
  
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(ALL_ENDPOINTS[2]); // Default to POST
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [bodyContent, setBodyContent] = useState('{"content": "Hello Aksara"}');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<RequestHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"preview" | "history">("preview");

  const resolvedPath = buildPath(selectedEndpoint, pathParams);
  const authority = typeof window !== 'undefined' 
    ? new URL(import.meta.env.VITE_API_URL || "http://localhost:8080").host
    : "localhost:8080";

  // Compute signature data
  const [sigData, setSigData] = useState<{
    digest: string;
    base: string;
    params: SignatureParams;
  } | null>(null);

  useEffect(() => {
    const compute = async () => {
      const hasBody = selectedEndpoint.method !== "GET" && selectedEndpoint.body;
      const body = hasBody ? bodyContent : "";
      
      const digest = await computeContentDigest(body || "");
      const now = Math.floor(Date.now() / 1000);
      const params: SignatureParams = {
        created: now,
        expires: now + 60,
        keyid: publicKey?.toBase58() || "unknown",
        nonce: generateNonce(),
      };
      
      const components = ["@authority", "@method", "@path"];
      const extra: Record<string, string> = {};
      
      if (hasBody) {
        components.push("content-digest");
        extra["content-digest"] = digest;
      }
      
      const base = buildSignatureBase(
        selectedEndpoint.method, 
        authority, 
        resolvedPath, 
        components, 
        extra, 
        params
      );
      
      setSigData({ digest, base, params });
    };
    
    compute();
  }, [bodyContent, selectedEndpoint, resolvedPath, authority, publicKey]);

  const handleSend = useCallback(async () => {
    if (!connected || !publicKey) {
      setError("Connect wallet first");
      return;
    }
    
    setLoading(true);
    setError(null);
    setResponse(null);
    const startTime = Date.now();
    
    try {
      const appSigner = getSigner();
      const signer = appSigner?.sign || signMessage;
      const signerKey = appSigner?.publicKeyBase58 || publicKey.toBase58();
      
      if (!signer) throw new Error("No signer available");
      
      const hasBody = selectedEndpoint.method !== "GET" && selectedEndpoint.body;
      const components = ["@authority", "@method", "@path"];
      const extra: Record<string, string> = {};
      
      if (hasBody) {
        components.push("content-digest");
        extra["content-digest"] = sigData?.digest || "";
      }
      
      const now = Math.floor(Date.now() / 1000);
      const params: SignatureParams = {
        created: now,
        expires: now + 60,
        keyid: signerKey,
        nonce: generateNonce(),
      };
      
      const base = buildSignatureBase(
        selectedEndpoint.method,
        authority,
        resolvedPath,
        components,
        extra,
        params
      );
      
      const sigBytes = await signer(new TextEncoder().encode(base));
      const sigStr = serializeSignature(sigBytes);
      
      const res = await client.request({
        method: selectedEndpoint.method as any,
        url: resolvedPath,
        data: hasBody ? JSON.parse(bodyContent) : undefined,
        headers: {
          ...(hasBody && { "content-digest": sigData?.digest }),
          "signature-input": serializeSignatureInput(components, params),
          "signature": sigStr,
        },
      });
      
      setResponse(res.data);
      
      const newItem: RequestHistoryItem = {
        id: Math.random().toString(36).slice(2),
        timestamp: Date.now(),
        method: selectedEndpoint.method,
        path: resolvedPath,
        status: "success",
        duration: Date.now() - startTime,
      };
      setHistory(prev => [newItem, ...prev].slice(0, 10));
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
      const errorItem: RequestHistoryItem = {
        id: Math.random().toString(36).slice(2),
        timestamp: Date.now(),
        method: selectedEndpoint.method,
        path: resolvedPath,
        status: "error",
        duration: Date.now() - startTime,
      };
      setHistory(prev => [errorItem, ...prev].slice(0, 10));
    } finally {
      setLoading(false);
    }
  }, [connected, publicKey, getSigner, signMessage, selectedEndpoint, resolvedPath, bodyContent, sigData, authority]);

  const needsAuth = selectedEndpoint.auth !== "public";
  const locked = needsAuth && !connected;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left: Endpoint Explorer */}
      <div className="col-span-12 lg:col-span-3 space-y-4">
        <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">
          Endpoints
        </div>
        
        <div className="space-y-2">
          {ALL_ENDPOINTS.map((ep) => {
            const auth = AUTH_CONFIG[ep.auth];
            const isSelected = selectedEndpoint.label === ep.label;
            
            return (
              <button
                key={ep.label}
                onClick={() => {
                  setSelectedEndpoint(ep);
                  setPathParams({});
                  setError(null);
                  setResponse(null);
                }}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  isSelected 
                    ? "bg-slate-800 border-slate-600" 
                    : "bg-transparent border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${METHOD_COLORS[ep.method]}`}>
                    {ep.method}
                  </span>
                  <span className={`text-xs ${auth.color}`}>
                    {auth.icon}
                  </span>
                </div>
                <div className="text-sm text-slate-300 mt-1">{ep.label}</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">
                  {ep.path}
                </div>
              </button>
            );
          })}
        </div>
        
        <div className="pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-500 mb-2">Access Levels</div>
          <div className="space-y-1">
            {Object.entries(AUTH_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span>{cfg.icon}</span>
                <span className={cfg.color}>{cfg.label}</span>
                <span className="text-slate-600">-</span>
                <span className="text-slate-500">
                  {key === "public" ? "No auth" : key === "signature" ? "Wallet sign" : "On-chain grant"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center: Request Builder */}
      <div className="col-span-12 lg:col-span-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-wider">
            Request
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`text-xs ${AUTH_CONFIG[selectedEndpoint.auth].color}`}>
              {AUTH_CONFIG[selectedEndpoint.auth].icon} {AUTH_CONFIG[selectedEndpoint.auth].label}
            </span>
          </div>
        </div>

        <div className="bg-[#0f0f0f] rounded-xl border border-slate-800 overflow-hidden">
          {/* Method/Path Bar */}
          <div className="flex items-center border-b border-slate-800 bg-[#0a0a0a]">
            <div className="px-4 py-3 border-r border-slate-800">
              <span className={`text-sm font-bold ${METHOD_COLORS[selectedEndpoint.method]}`}>
                {selectedEndpoint.method}
              </span>
            </div>
            <div className="flex-1 px-4 py-3 font-mono text-sm text-slate-400">
              {resolvedPath}
            </div>
          </div>

          {/* Params */}
          {selectedEndpoint.params?.map((param) => (
            <div key={param.name} className="border-b border-slate-800">
              <div className="px-4 py-2 bg-slate-900/50 text-xs text-slate-500 font-mono border-b border-slate-800">
                :{param.name}
              </div>
              <input
                type="text"
                placeholder={param.placeholder}
                value={pathParams[param.name] || ""}
                onChange={(e) => setPathParams(p => ({ ...p, [param.name]: e.target.value }))}
                className="w-full px-4 py-3 bg-transparent text-sm text-slate-300 focus:outline-none placeholder:text-slate-700"
              />
            </div>
          ))}

          {/* Body Editor */}
          {selectedEndpoint.body && (
            <div className="border-b border-slate-800">
              <div className="px-4 py-2 bg-slate-900/50 text-xs text-slate-500 font-mono">
                BODY
              </div>
              <div className="h-48">
                <Editor
                  height="100%"
                  language="json"
                  value={bodyContent}
                  onChange={(v) => setBodyContent(v || "")}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    lineNumbers: "off",
                    fontSize: 13,
                    fontFamily: "JetBrains Mono, monospace",
                    padding: { top: 12, bottom: 12 },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    folding: false,
                    renderLineHighlight: "none",
                  }}
                />
              </div>
            </div>
          )}

          {/* Send Button */}
          <div className="p-4">
            {locked ? (
              <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-900 text-slate-500 text-sm">
                <Lock className="w-4 h-4" />
                <span>Connect wallet to send</span>
              </div>
            ) : (
              <button
                onClick={handleSend}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-100 hover:bg-white text-black font-medium text-sm transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {loading ? "Signing..." : "Send Request"}
              </button>
            )}
          </div>
        </div>

        {selectedEndpoint.description && (
          <div className="text-xs text-slate-500">
            {selectedEndpoint.description}
          </div>
        )}
      </div>

      {/* Right: Preview/History */}
      <div className="col-span-12 lg:col-span-4 space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab("preview")}
            className={`text-xs font-mono uppercase tracking-wider transition-colors ${
              activeTab === "preview" ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Signature Preview
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`text-xs font-mono uppercase tracking-wider transition-colors flex items-center gap-1 ${
              activeTab === "history" ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <History className="w-3 h-3" />
            History {history.length > 0 && `(${history.length})`}
          </button>
        </div>

        {activeTab === "preview" ? (
          <div className="space-y-4">
            {/* Content Digest */}
            {sigData && selectedEndpoint.body && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Content-Digest</span>
                  <span className="text-slate-700">•</span>
                  <span className="font-mono text-[10px]">RFC 9530</span>
                </div>
                <div className="p-3 bg-[#0f0f0f] rounded-lg border border-slate-800">
                  <code className="text-xs font-mono text-emerald-400 break-all">
                    {sigData.digest.slice(0, 60)}...
                  </code>
                </div>
              </div>
            )}

            {/* Signature Base */}
            {sigData && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Signature Base</span>
                  <span className="text-slate-700">•</span>
                  <span className="font-mono text-[10px]">RFC 9421</span>
                </div>
                <pre className="p-3 bg-[#0f0f0f] rounded-lg border border-slate-800 text-xs font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap max-h-48">
                  {sigData.base.slice(0, 400)}
                  {sigData.base.length > 400 && "..."}
                </pre>
              </div>
            )}

            {/* Response */}
            {(response || error) && (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 text-xs ${error ? "text-red-400" : "text-emerald-400"}`}>
                  <span>{error ? "Error" : "Response"}</span>
                </div>
                <pre className={`p-3 rounded-lg border text-xs font-mono overflow-x-auto max-h-64 ${
                  error 
                    ? "bg-red-950/20 border-red-900/50 text-red-400" 
                    : "bg-emerald-950/20 border-emerald-900/50 text-emerald-400"
                }`}>
                  {JSON.stringify(response || { error }, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-center py-12 text-slate-600 text-sm">
                No requests yet
              </div>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-[#0f0f0f] rounded-lg border border-slate-800"
                >
                  <span className={`text-xs font-bold ${METHOD_COLORS[item.method]}`}>
                    {item.method}
                  </span>
                  <span className="flex-1 text-xs text-slate-400 truncate font-mono">
                    {item.path}
                  </span>
                  <span className={`text-xs ${item.status === "success" ? "text-emerald-500" : "text-red-500"}`}>
                    {item.status === "success" ? "✓" : "✗"}
                  </span>
                  <span className="text-xs text-slate-600">
                    {item.duration}ms
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
