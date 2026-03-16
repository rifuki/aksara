Aksara
=======

**Aksara** is a Solana-native, on-chain access-control framework for APIs.
It combines wallet-signed HTTP requests with a simple on-chain permission model (PDA-based grants), so API authorization can be audited on-chain without server-side session storage.

**Aksara** = **A**ccess **K**ontrol with **S**igned **A**PI **R**equest **A**uthorization

What it solves
-------------

- Replace classic auth patterns (API keys/JWT sessions) with wallet-owned signing.
- Keep authorization decisions transparent and auditable with deterministic PDA state.
- Enable instant revocation and scope-based permissions without waiting on token lifecycles.
- Keep request verification stateless and replay-resistant when needed.

Core Concepts
-------------

- **Owner wallet**: account owner that grants/revokes access.
- **Grantee wallet**: account that can call protected endpoints when authorized.
- **AccessGrant PDA**: on-chain record keyed by `owner + grantee` that stores scope and expiry.
- **Signed request**: Ed25519 signature over `METHOD\nPATH\nTIMESTAMP\nSHA256(body)`.
- **Scopes**:
  - `READ = 0x01`
  - `WRITE = 0x02`
  - `DELETE = 0x04`
  - `ADMIN = 0x08`

High-level flow
--------------

1. Owner grants access on-chain (`grant_access`) with scope + expiry.
2. Client signs each API request with wallet key (`Aksara` signer).
3. Backend verifies Ed25519 signature and checks on-chain grant state.
4. Request is accepted only when signature and grant are valid.

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
- Wallet-signed HTTP request verification (Ed25519)
- `WalletAddress` extractor for protected handlers
- Health check endpoints
- Structured logging with file rotation
- HTTP request tracing middleware
- CORS configuration
- Graceful shutdown handling

### UI (`ui/`)

React dashboard built with Vite:
- Solana wallet connect (Wallet Standard — auto-detects all wallets)
- Signed HTTP requests to protected API endpoints
- TanStack Router + TanStack Query

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
- [x] Wallet-signed HTTP request middleware (Ed25519 verification)
- [x] React dashboard with Solana wallet connect (`ui/`)
- [x] Signed GET request from UI to protected API
- [ ] Initialize smart contract module (`contract/`)
- [ ] Add TypeScript SDK for signing/verification helpers (`sdk/`)
- [ ] On-chain grant verification in middleware
- [ ] Add integration tests and demo flow

License
-------

MIT
