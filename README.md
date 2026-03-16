Aksara
=======

**Aksara** is a Solana-native, on-chain access-control framework for APIs.
It combines wallet-signed HTTP requests (RFC 9421) with a simple on-chain permission model (PDA-based grants), so API authorization can be audited on-chain without server-side session storage.

**Aksara** = **A**ccess **K**ontrol with **S**igned **A**PI **R**equest **A**uthorization

What it solves
-------------

- Replace classic auth patterns (API keys/JWT sessions) with wallet-owned signing.
- Keep authorization decisions transparent and auditable with deterministic PDA state.
- Enable instant revocation and scope-based permissions without waiting on token lifecycles.
- Keep request verification stateless and replay-resistant (nonce-based anti-replay).

Core Concepts
-------------

- **Owner wallet**: account owner that grants/revokes access.
- **Grantee wallet**: account that can call protected endpoints when authorized.
- **AccessGrant PDA**: on-chain record keyed by `owner + grantee` that stores scope and expiry.
- **Signed request**: RFC 9421 HTTP Message Signature — Ed25519 over a structured signature base covering `@authority`, `@method`, `@path`, and `Content-Digest`.
- **Scopes**:
  - `READ = 0x01`
  - `WRITE = 0x02`
  - `DELETE = 0x04`
  - `ADMIN = 0x08`

Signing Protocol
----------------

Aksara implements **RFC 9421 HTTP Message Signatures** with **RFC 9530 Content-Digest**:

```
Content-Digest: sha-256=:<base64-sha256-of-body>:
Signature-Input: sol=("@authority" "@method" "@path" "content-digest");created=<unix>;expires=<unix>;keyid="<base58-pubkey>";nonce="<hex>"
Signature: sol=:<base64-ed25519-signature>:
```

- `keyid` is the base58-encoded Solana public key (wallet address)
- Nonce is a random 16-byte hex string generated per request (anti-replay)
- TTL is 60 seconds (configurable); server enforces `created`/`expires` with ±5s clock skew

High-level flow
--------------

1. Owner grants access on-chain (`grant_access`) with scope + expiry.
2. Client signs each API request with wallet key using RFC 9421.
3. Backend verifies signature, checks nonce (anti-replay), and validates Content-Digest.
4. Request is accepted only when signature and grant are valid.

Web2 vs Solana
--------------

| Concern | Web2 Pattern | Aksara (Solana) |
|---|---|---|
| **Identity** | Username/password or OAuth token | Wallet public key (Ed25519) |
| **Auth token** | JWT/API key (stealable, copyable) | Per-request Ed25519 signature (non-transferable) |
| **Request integrity** | HTTPS only; body tampering detectable only at TLS layer | Content-Digest (SHA-256) covers body cryptographically, signed by wallet |
| **Signing standard** | Proprietary HMAC or Bearer token in `Authorization` | RFC 9421 HTTP Message Signatures — open, interoperable standard |
| **Replay protection** | Token expiry + server-side session blacklist | Nonce per request + `expires` timestamp — stateless-friendly |
| **Authorization store** | RBAC table in PostgreSQL; admin manages roles | `AccessGrant` PDA on-chain — owner self-service, no admin required |
| **Revocation** | Blacklist token + wait for expiry, or invalidate session table | Set `revoked = true` on-chain — takes effect on next RPC read (~400ms) |
| **Auditability** | Application logs (mutable, trusted actor) | On-chain state — immutable, publicly verifiable |
| **Scope** | Role strings in DB or JWT claims | Bitmask (`u8`) in PDA — compact, composable |
| **Session storage** | Redis/DB session table — horizontal scaling pain | Stateless — no session storage needed |
| **Key rotation** | Re-issue tokens, migrate DB | Generate new wallet + re-grant — owner controls |

Repository Structure
--------------------

```
aksara/
├── api/          # Axum REST API server (Rust)
├── ui/           # React dashboard (Vite + TanStack + Solana wallet)
├── contract/     # Solana smart contract (Anchor) - Coming soon
└── sdk/          # TypeScript SDK - Coming soon
```

### API Server (`api/`)

Production-ready REST API built with Rust and Axum:
- RFC 9421 HTTP Message Signature verification (Ed25519)
- RFC 9530 Content-Digest body integrity verification
- Nonce-based anti-replay protection (in-memory store)
- `WalletAddress` extractor for protected handlers
- Health check endpoints
- Structured logging with file rotation
- HTTP request tracing middleware
- CORS configuration
- Graceful shutdown handling

### UI (`ui/`)

React dashboard built with Vite:
- Solana wallet connect (Wallet Standard — auto-detects all wallets)
- RFC 9421 signed HTTP requests to protected API endpoints
- Guided API tester (select endpoint, fill params, send)
- TanStack Router + TanStack Query + shadcn/ui

Getting started
---------------

### 1. Start the API Server

```bash
cd api
cp .env.example .env
cargo run
```

Server starts on `http://localhost:8080`

### 2. Start the UI

```bash
cd ui
cp .env.example .env
bun install
bun dev
```

UI starts on `http://localhost:5173`

### 3. Future modules (coming soon)

```bash
# Deploy smart contract
cd contract
anchor deploy

# Use SDK in your client
cd sdk
npm install
```

Roadmap
-------

- [x] Initialize API server with Axum (`api/`)
- [x] RFC 9421 HTTP Message Signature middleware (Ed25519 + Content-Digest + nonce anti-replay)
- [x] Protected CRUD endpoints (`/aksara/messages`)
- [x] React dashboard with Solana wallet connect (`ui/`)
- [x] RFC 9421 signed HTTP requests (GET/POST/PUT/DELETE) from UI to protected API
- [x] Guided API tester with endpoint config
- [ ] Initialize smart contract module (`contract/`)
- [ ] Add TypeScript SDK for signing/verification helpers (`sdk/`)
- [ ] On-chain grant verification in middleware
- [ ] Add integration tests and demo flow

License
-------

MIT
