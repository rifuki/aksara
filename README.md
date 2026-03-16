Aksara
=======

**Aksara** is a Solana-native, on-chain access-control framework for APIs.
It combines wallet-signed HTTP requests (RFC 9421) with a PDA-based permission model, so API authorization is auditable on-chain without server-side session storage.

**Aksara** = **A**ccess **K**ontrol with **S**igned **A**PI **R**equest **A**uthorization

What it solves
--------------

- Replace classic auth patterns (API keys / JWT sessions) with wallet-owned signing.
- Keep authorization decisions transparent and auditable with deterministic PDA state.
- Enable instant revocation and scope-based permissions without waiting on token lifecycles.
- Keep request verification stateless and replay-resistant (nonce-based anti-replay).

Core Concepts
-------------

- **Owner wallet** — issues and revokes grants.
- **Grantee wallet** — calls protected endpoints when authorized.
- **AccessGrant PDA** — on-chain record keyed by `[owner, grantee]` storing scope and expiry.
- **Signed request** — RFC 9421 HTTP Message Signature (Ed25519) covering `@authority`, `@method`, `@path`, and `Content-Digest`.
- **Scopes** (bitmask):

  | Constant | Value | Allows |
  |---|---|---|
  | `READ` | `0x01` | `GET /messages/mine` |
  | `WRITE` | `0x02` | `POST /messages`, `PUT /messages/:id` |
  | `DELETE` | `0x04` | `DELETE /messages/:id` |

  Scopes are composable: `0x07` = READ + WRITE + DELETE.

Signing Protocol
----------------

Aksara implements **RFC 9421 HTTP Message Signatures** with **RFC 9530 Content-Digest**:

```
Content-Digest:  sha-256=:<base64-sha256-of-body>:
Signature-Input: sol=("@authority" "@method" "@path" "content-digest");created=<unix>;expires=<unix>;keyid="<base58-pubkey>";nonce="<hex>"
Signature:       sol=:<base64-ed25519-signature>:
```

- `keyid` — base58-encoded Solana public key (wallet address)
- Nonce — random 16-byte hex string per request (anti-replay)
- TTL — 60 s; server enforces `created`/`expires` with ±5 s clock skew

Access Model
------------

```
GET  /aksara/messages        — public, no auth
GET  /aksara/messages/:id    — public, no auth

GET    /aksara/messages/mine   — private, requires READ grant
POST   /aksara/messages        — private, requires WRITE grant
PUT    /aksara/messages/:id    — private, requires WRITE grant
DELETE /aksara/messages/:id    — private, requires DELETE grant
```

Grant holders can operate on **any** message (admin-scoped), not just their own.
A wallet with no grant gets `403 Forbidden` on all private endpoints.

High-level Flow
---------------

```
1. Owner calls grant_access on-chain  →  AccessGrant PDA created
2. Grantee signs each API request     →  RFC 9421 headers attached
3. Backend verifies signature         →  Ed25519 + nonce + Content-Digest
4. Backend checks PDA on devnet       →  scope valid + not revoked + not expired
5. Request proceeds or 403            →  instant effect on revoke
```

Web2 vs Aksara
--------------

| Concern | Web2 | Aksara |
|---|---|---|
| **Identity** | Username / OAuth token | Wallet public key (Ed25519) |
| **Auth token** | JWT / API key (stealable) | Per-request Ed25519 signature (non-transferable) |
| **Request integrity** | HTTPS only | Content-Digest (SHA-256) signed by wallet |
| **Signing standard** | Proprietary HMAC or Bearer | RFC 9421 — open, interoperable |
| **Replay protection** | Token expiry + session blacklist | Nonce + `expires` — stateless |
| **Authorization store** | RBAC table in Postgres | `AccessGrant` PDA on-chain — self-service |
| **Revocation** | Invalidate session table | `revoked = true` on-chain (~400 ms) |
| **Auditability** | Application logs (mutable) | On-chain state — immutable, public |
| **Scope** | Role strings in DB / JWT claims | Bitmask `u8` in PDA — compact, composable |
| **Session storage** | Redis / DB — scaling pain | Stateless — none needed |

Repository Structure
--------------------

```
aksara/
├── api/       — Axum REST API (Rust)
├── ui/        — React dashboard (Vite + TanStack + Solana wallet adapter)
└── contract/  — Anchor program (Solana devnet)
```

Getting Started
---------------

### Prerequisites

- Rust (latest stable)
- [Bun](https://bun.sh)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation)
- Solana CLI + a funded devnet wallet

### 1. Contract (already deployed)

Program ID: `6GXa5BEKNu7dBtCd3x6UnxkUjbvaoAMQnA9BvQbhavVc` (devnet)

To redeploy:

```bash
cd contract
ln -sf ~/.config/solana/aksara-keypair.json target/deploy/aksara-keypair.json
anchor build
anchor deploy
```

### 2. API

```bash
cd api
cp .env.example .env
# Edit .env — see Configuration below
cargo run
```

### 3. UI

```bash
cd ui
cp .env.example .env
# Edit .env — set VITE_API_URL and VITE_PROGRAM_ID
bun install
bun dev
```

Configuration
-------------

#### `api/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | Yes | — | Server port |
| `RUST_ENV` | Yes | — | `development` or `production` |
| `CORS_ALLOWED_ORIGINS` | No | `*` | Comma-separated allowed origins |
| `OWNER_PUBKEY` | No* | — | Base58 pubkey of the grant issuer |
| `SOLANA_RPC_URL` | No | devnet | Solana JSON-RPC URL |
| `PROGRAM_ID` | No* | — | Aksara program ID |

\* `OWNER_PUBKEY` and `PROGRAM_ID` are optional together — if `OWNER_PUBKEY` is omitted the API runs in **dev mode** (signature verified, on-chain grant skipped). If `OWNER_PUBKEY` is set, `PROGRAM_ID` becomes required.

#### `ui/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | API base URL (e.g. `http://localhost:8080`) |
| `VITE_PROGRAM_ID` | Yes | Aksara program ID |

Demo Flow
---------

1. Open the UI (`http://localhost:5173`) — `List All Messages` works immediately without a wallet.
2. Connect your wallet.
3. Enable **Auto-Sign** to avoid wallet popups on every request.
4. Try **Create Message** → `403 Forbidden` (no grant yet).
5. In **Access Grant Manager**, grant your own wallet (or another) with desired scope + TTL.
6. After the devnet transaction confirms, try **Create Message** again → `201 Created`.
7. Revoke the grant → subsequent write requests return `403` immediately.

Roadmap
-------

- [x] RFC 9421 HTTP Message Signature middleware (Ed25519 + Content-Digest + nonce anti-replay)
- [x] Public / private endpoint split
- [x] Anchor program with `AccessGrant` PDA (`grant_access` / `revoke_access`)
- [x] On-chain grant verification in middleware (scope + expiry + revoke)
- [x] React dashboard — wallet connect, auto-sign session key, grant manager, API tester
- [x] IDL-driven UI (`@coral-xyz/anchor`) — no hardcoded discriminators
- [x] Deployed to Solana devnet
- [ ] TypeScript SDK for signing / verification helpers
- [ ] Integration tests

License
-------

MIT
