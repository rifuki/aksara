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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppWallet } from "@/hooks/use-app-wallet";
import { Send } from "lucide-react";
import { client } from "@/api/client";

const DEFAULT_BODY = `{
  "content": "Hello from Aksara"
}`;

export function Playground() {
  const { publicKey, signMessage } = useWallet();
  const { getSigner } = useAppWallet();
  
  const [method, setMethod] = useState("POST");
  const [path, setPath] = useState("/aksara/messages");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [contentDigest, setContentDigest] = useState("");
  const [sigBase, setSigBase] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keyId = publicKey?.toBase58() || "<connect-wallet>";
  const authority = typeof window !== 'undefined' 
    ? new URL(import.meta.env.VITE_API_URL || "http://localhost:8080").host
    : "localhost:8080";

  // Compute digest and signature base
  useEffect(() => {
    const compute = async () => {
      try {
        const digest = await computeContentDigest(body);
        setContentDigest(digest);
        
        const now = Math.floor(Date.now() / 1000);
        const params: SignatureParams = {
          created: now,
          expires: now + 60,
          keyid: keyId,
          nonce: generateNonce(),
        };
        
        const components = ["@authority", "@method", "@path", "content-digest"];
        const extra = { "content-digest": digest };
        
        const base = buildSignatureBase(method, authority, path, components, extra, params);
        setSigBase(base);
      } catch (e) {
        console.error(e);
      }
    };
    
    compute();
  }, [body, method, path, authority, keyId]);

  const handleSignAndSend = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("Connect wallet first");
      return;
    }
    
    setLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      // Get signer (prefer app wallet)
      const appSigner = getSigner();
      const signer = appSigner?.sign || signMessage;
      const signerKey = appSigner?.publicKeyBase58 || publicKey.toBase58();
      
      // Build params
      const now = Math.floor(Date.now() / 1000);
      const params: SignatureParams = {
        created: now,
        expires: now + 60,
        keyid: signerKey,
        nonce: generateNonce(),
      };
      
      // Build signature
      const components = ["@authority", "@method", "@path", "content-digest"];
      const extra = { "content-digest": contentDigest };
      const base = buildSignatureBase(method, authority, path, components, extra, params);
      
      const sigBytes = await signer(new TextEncoder().encode(base));
      const sigStr = serializeSignature(sigBytes);
      
      // Send request
      const res = await client.request({
        method: method as any,
        url: path,
        data: JSON.parse(body),
        headers: {
          "content-digest": contentDigest,
          "signature-input": serializeSignatureInput(components, params),
          "signature": sigStr,
        },
      });
      
      setResponse(res.data);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage, getSigner, method, path, body, contentDigest, authority]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-800">
      {/* Left Panel - Request Builder */}
      <div className="bg-[#0a0a0a] p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-mono text-sm">01 //</span>
            <span className="text-slate-300 font-mono text-sm">COMPOSE REQUEST</span>
          </div>
          <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500">
            {keyId.slice(0, 8)}...{keyId.slice(-4)}
          </Badge>
        </div>

        {/* Method & Path */}
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <select 
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="bg-[#111] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-slate-500"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="bg-[#111] border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-slate-500"
            placeholder="/aksara/messages"
          />
        </div>

        {/* Body Editor */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-mono text-xs">BODY (JSON)</span>
          </div>
          
          <div className="border border-slate-700 rounded overflow-hidden">
            <Editor
              height="200px"
              language="json"
              value={body}
              onChange={(v) => setBody(v || "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                lineNumbers: "on",
                fontSize: 13,
                fontFamily: "JetBrains Mono, monospace",
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        {/* Components */}
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-slate-500 font-mono text-sm">02 //</span>
            <span className="text-slate-300 font-mono text-sm">SIGNATURE COMPONENTS</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {["@method", "@path", "content-digest", "nonce"].map((comp) => (
              <div key={comp} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-xs font-mono text-slate-400">{comp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 space-y-2">
          <Button 
            onClick={handleSignAndSend}
            disabled={loading || !publicKey}
            className="w-full h-11 bg-slate-100 hover:bg-white text-black font-mono text-sm"
          >
            <Send className="w-4 h-4 mr-2" />
            {loading ? "SIGNING..." : "SIGN & SEND REQUEST"}
          </Button>
        </div>
      </div>

      {/* Right Panel - Preview & Result */}
      <div className="bg-[#0a0a0a] p-6 space-y-6">
        {/* Content-Digest */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-mono text-sm">03 //</span>
            <span className="text-slate-300 font-mono text-sm">CONTENT-DIGEST</span>
            <Badge className="ml-auto text-[10px] bg-slate-800 text-slate-400 border-0">
              RFC 9530
            </Badge>
          </div>
          
          <div className="p-3 bg-[#111] rounded border border-slate-800">
            <code className="text-xs font-mono text-emerald-400 break-all">
              {contentDigest || "sha-256=:...:"}
            </code>
          </div>
        </div>

        {/* Signature Base */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-mono text-sm">04 //</span>
            <span className="text-slate-300 font-mono text-sm">SIGNATURE BASE</span>
            <Badge className="ml-auto text-[10px] bg-slate-800 text-slate-400 border-0">
              RFC 9421 §2.5
            </Badge>
          </div>
          
          <pre className="p-3 bg-[#111] rounded border border-slate-800 text-xs font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap">
            {sigBase || "Waiting for request..."}
          </pre>
        </div>

        {/* Result */}
        {(response || error) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-mono text-sm">05 //</span>
              <span className={error ? "text-red-400" : "text-emerald-400"} >
                {error ? "ERROR" : "RESPONSE"}
              </span>
            </div>
            
            <pre className="p-3 bg-[#111] rounded border border-slate-800 text-xs font-mono overflow-x-auto max-h-60">
              <code className={error ? "text-red-400" : "text-slate-300"}>
                {JSON.stringify(response || { error }, null, 2)}
              </code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
