# Aksara API

Axum REST API with RFC 9421 wallet-signed request verification and on-chain `AccessGrant` authorization.

## Endpoints

### Public (no auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/health/detail` | Health check with version + timestamp |
| `GET` | `/aksara/messages` | List all messages |
| `GET` | `/aksara/messages/:id` | Get a single message |

### Private (wallet signature + on-chain grant required)

| Method | Path | Required scope | Description |
|---|---|---|---|
| `GET` | `/aksara/messages/mine` | `READ` | Messages created by the caller |
| `POST` | `/aksara/messages` | `WRITE` | Create a message |
| `PUT` | `/aksara/messages/:id` | `WRITE` | Update any message |
| `DELETE` | `/aksara/messages/:id` | `DELETE` | Delete any message |

Every private request must carry RFC 9421 headers:

```
Content-Digest:  sha-256=:<base64>:          (when body present)
Signature-Input: sol=("@authority" "@method" "@path" ["content-digest"]);created=<unix>;expires=<unix>;keyid="<base58>";nonce="<hex>"
Signature:       sol=:<base64-ed25519>:
```

## Quick Start

```bash
cp .env.example .env
# fill in .env
cargo run
```

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | Yes | — | Server port |
| `RUST_ENV` | Yes | — | `development` or `production` |
| `CORS_ALLOWED_ORIGINS` | No | `*` | Comma-separated allowed origins |
| `OWNER_PUBKEY` | No* | — | Base58 pubkey of the grant issuer |
| `SOLANA_RPC_URL` | No | devnet | Solana JSON-RPC URL |
| `PROGRAM_ID` | No* | — | Aksara program ID |

\* If `OWNER_PUBKEY` is omitted the API runs in **dev mode** — signatures are verified but on-chain grant check is skipped. If `OWNER_PUBKEY` is set, `PROGRAM_ID` is required.

## Project Structure

```
src/
├── main.rs
├── lib.rs
├── routes.rs
├── state.rs
├── feature/
│   ├── aksara/
│   │   ├── handlers.rs   — public + private handlers
│   │   ├── model.rs      — Message, CreateMessageRequest, UpdateMessageRequest
│   │   ├── routes.rs     — public / private route split
│   │   └── mod.rs
│   └── health/
└── infrastructure/
    ├── config.rs         — ServerConfig + SolanaConfig
    ├── env.rs
    ├── logging.rs        — terminal + daily rolling file
    ├── server.rs         — TCP listener + shutdown signal
    └── web/
        ├── cors.rs
        ├── extractor/    — WalletAddress extractor
        ├── middleware/
        │   ├── wallet_auth.rs   — RFC 9421 verification + on-chain check
        │   ├── on_chain.rs      — AccessGrant PDA fetch + validation
        │   └── http_trace.rs    — request/response logging
        └── response/     — ApiSuccess + ApiError
```
