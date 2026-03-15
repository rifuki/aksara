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
- **Signed request**: Ed25519 signature over HTTP request metadata (`Signature-Input`, `Signature`, optional `Content-Digest`).
- **Scopes**:
  - `READ = 0x01`
  - `WRITE = 0x02`
  - `DELETE = 0x04`
  - `ADMIN = 0x08`

High-level flow
--------------

1. Owner grants access on-chain (`grant_access`) with scope + expiry.
2. Client signs each API request with wallet/app-wallet key (`Aksara` signer).
3. Backend verifies signature and checks on-chain grant state (`verify_on_chain`).
4. Request is accepted only when signature and grant are valid.

Repository Structure
--------------------

```
aksara/
├── api/          # Axum REST API server (Rust)
│   ├── src/
│   └── README.md
├── contract/     # Solana smart contract (Anchor) - Coming soon
├── sdk/          # TypeScript SDK - Coming soon
└── frontend/     # React dashboard - Coming soon
```

### API Server (`api/`)

Production-ready REST API built with Rust and Axum:
- Health check endpoints
- Structured logging with file rotation
- HTTP request tracing middleware
- CORS configuration
- Graceful shutdown handling

See [`api/README.md`](api/README.md) for setup instructions.

Getting started
---------------

### 1. Start the API Server

```bash
cd api
cp .env.example .env
cargo run
```

Server starts on `http://localhost:8080`

### 2. Future modules (coming soon)

```bash
# Deploy smart contract
cd contract
anchor deploy

# Use SDK in your client
cd sdk
npm install

# Run dashboard
cd frontend
npm run dev
```

Roadmap
-------

- [x] Initialize API server with Axum (`api/`)
- [ ] Initialize smart contract module (`contract/`)
- [ ] Add TypeScript SDK for signing/verification helpers (`sdk/`)
- [ ] Add Axum middleware for request verification
- [ ] Add React dashboard with wallet + auto-sign app-wallet mode (`frontend/`)
- [ ] Add integration tests and demo flow

License
-------

MIT
