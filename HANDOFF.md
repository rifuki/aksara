# Aksara — Handoff Document

> Tulis untuk AI baru yang masuk ke codebase ini. Baca seluruh dokumen sebelum menyentuh kode apapun.

---

## Apa ini

**Aksara** adalah proof-of-concept on-chain API access control di Solana.

Idenya: ganti API key / JWT dengan wallet signature. Owner wallet bisa grant/revoke akses ke wallet lain via on-chain PDA. Setiap request ke API private harus membawa RFC 9421 HTTP Message Signature — backend verifikasi signature Ed25519 + cek PDA di devnet.

**Program ID (devnet):** `6GXa5BEKNu7dBtCd3x6UnxkUjbvaoAMQnA9BvQbhavVc`

---

## Struktur repo

```
aksara/
├── api/        — Rust/Axum REST API
├── ui/         — React/Vite dashboard
└── contract/   — Anchor program (Solana)
```

---

## contract/

### Program
- Satu program: `programs/aksara/`
- Sudah dideploy ke devnet, Program ID di atas
- Keypair ada di `~/.config/solana/aksara-keypair.json` (di luar repo)
- Untuk deploy ulang: `ln -sf ~/.config/solana/aksara-keypair.json target/deploy/aksara-keypair.json && anchor build && anchor deploy`

### Struktur modular
```
programs/aksara/src/
├── lib.rs                    — declare_id! + #[program] saja
├── constants.rs              — SCOPE_READ=0x01, SCOPE_WRITE=0x02, SCOPE_DELETE=0x04
├── state.rs                  — AccessGrant struct + is_valid()
├── errors.rs                 — AksaraError enum
├── events.rs                 — GrantCreated, GrantRevoked
└── instructions/
    ├── mod.rs
    ├── grant_access.rs       — impl<'info> GrantAccess { fn grant_access() }
    └── revoke_access.rs      — impl<'info> RevokeAccess { fn revoke_access() }
```

### Pattern penting: `impl<'info> Accounts`
Instruction logic ada di `impl` block pada context struct, bukan fungsi `handle` terpisah. `lib.rs` memanggil via `ctx.accounts.grant_access(...)`. Ini menghindari naming collision saat glob re-export.

### AccessGrant PDA
- Seeds: `[b"access", owner.key(), grantee.key()]`
- Fields: `owner`, `grantee`, `scope: u8`, `expires_at: i64`, `revoked: bool`, `bump: u8`
- `init_if_needed` — re-grant ke grantee yang sama akan **overwrite** data lama (termasuk reset revoked)
- `revoke_access` hanya set `revoked = true`, account tidak di-close (rent tidak diklaim)

### IDL
- Di `contract/target/idl/aksara.json`
- Juga di-copy ke `ui/src/idl/aksara.json` untuk frontend
- Discriminator `AccessGrant`: `[167, 55, 184, 237, 74, 242, 0, 109]`

---

## api/

### Stack
Rust + Axum 0.8 + Tokio. Crate name: `aksara-api` (bukan `aksara` — untuk menghindari collision dengan program crate kalau suatu saat di-depend).

### Endpoint split: public vs private

**Public (no auth):**
- `GET /health`
- `GET /health/detail`
- `GET /aksara/messages`
- `GET /aksara/messages/:id`

**Private (RFC 9421 signature + on-chain grant):**
- `GET /aksara/messages/mine` — butuh scope READ
- `POST /aksara/messages` — butuh scope WRITE
- `PUT /aksara/messages/:id` — butuh scope WRITE
- `DELETE /aksara/messages/:id` — butuh scope DELETE

Grant holder bisa operasi pada **message siapapun** (bukan hanya milik sendiri) — ini disengaja, grant = admin access.

### Middleware stack (luar → dalam)
1. `CorsLayer`
2. `http_trace_middleware` — logging request/response, slow log >500ms
3. `wallet_auth_middleware` — hanya pada private routes

### wallet_auth_middleware (`middleware/wallet_auth.rs`)
Urutan verifikasi:
1. Parse `Signature-Input` header (RFC 9421)
2. Validasi timestamp: `created` tidak di masa depan, `expires` belum lewat, TTL max 300s
3. Nonce anti-replay via `DashMap` global (lazy static)
4. Baca body, verifikasi `Content-Digest` jika ada di signature components
5. Reconstruct signature base string
6. Verifikasi Ed25519 signature dengan pubkey dari `keyid`
7. Jika `SolanaConfig` ada di extensions → panggil `verify_on_chain()`
8. Inject `WalletAddress(keyid)` ke request extensions

### on_chain.rs (`middleware/on_chain.rs`)
- Tidak depend ke program crate, tidak pakai `anchor-client`
- Pakai `anchor-lang` saja: `AccountDeserialize` + `AnchorDeserialize`
- Struct `AccessGrant` didefinisikan lokal dengan discriminator dari IDL
- `try_deserialize()` otomatis validasi 8-byte discriminator
- `RpcClient::new()` dibuat per-call (belum di-cache — lihat Known Issues)

### Config (`infrastructure/config.rs`)
- `OWNER_PUBKEY` opsional → kalau tidak ada: **dev mode**, on-chain check di-skip
- Kalau `OWNER_PUBKEY` ada tapi `PROGRAM_ID` kosong → **error saat startup** (pakai `require_env`)
- `SolanaConfig::from_env()` return `Result<Option<Self>>` bukan `Option<Self>`

### Storage
In-memory `HashMap<String, Message>` dalam `RwLock`. **Tidak persisten** — data hilang saat restart. Ini by design untuk demo.

### `.env` setup
```env
# Minimal (dev mode — no on-chain check)
PORT=8080
RUST_ENV=development
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Tambah ini untuk on-chain check aktif
OWNER_PUBKEY=<base58 pubkey wallet owner>
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=6GXa5BEKNu7dBtCd3x6UnxkUjbvaoAMQnA9BvQbhavVc
```

---

## ui/

### Stack
React 19 + Vite + TanStack Router + TanStack Query + `@solana/wallet-adapter` + `@coral-xyz/anchor` + shadcn/ui + Tailwind v4

### Signing flow
Ada dua mode signing:

**Normal mode:** setiap request → wallet popup untuk sign

**Auto-Sign (App Wallet):**
- Generate Ed25519 keypair via `crypto.subtle.generateKey` (non-extractable)
- Simpan di IndexedDB (`aksara-keystore`)
- Main wallet sign authorization message 1x saat enable
- Semua request signed otomatis tanpa popup
- TTL configurable (5 menit - 2 jam)
- File: `src/lib/app-wallet.ts`, `src/hooks/use-app-wallet.tsx`

### RFC 9421 signing (`src/lib/sign-request.ts` + `src/hooks/use-signed-api.ts`)
`useSignedApi` pasang Axios interceptor yang:
1. Compute `Content-Digest` (SHA-256) kalau ada body
2. Build signature base string (RFC 9421 §2.5)
3. Sign dengan app wallet atau main wallet
4. Attach `Signature-Input` + `Signature` headers

### Grant Panel (`src/components/grant-panel.tsx`)
- Pakai `@coral-xyz/anchor` + IDL dari `src/idl/aksara.json`
- `useAksaraProgram` hook (`src/hooks/use-aksara-program.ts`) buat `Program` instance
- Panggil via `program.methods.grantAccess(scope, new BN(expiresAt)).accounts({ grantee }).rpc()`
- Anchor otomatis resolve PDA dari seeds di IDL — tidak perlu compute manual

### API Tester (`src/components/api-tester.tsx`)
- Visible tanpa wallet connect (public endpoints bisa ditest langsung)
- `auth: "public" | "private"` di tiap endpoint (lihat `src/api/endpoints.ts`)
- Public endpoint pakai `usePublicQuery` (unsigned axios)
- Private endpoint pakai `useProtectedQuery` / `useProtectedMutation` (signed axios)
- Badge 🌐/🔒 per endpoint

### `.env` setup
```env
VITE_API_URL=http://localhost:8080
VITE_PROGRAM_ID=6GXa5BEKNu7dBtCd3x6UnxkUjbvaoAMQnA9BvQbhavVc
```
Kedua var **wajib** — tidak ada fallback hardcode. Error saat load kalau kosong (`getRequiredEnv`).

---

## Known Issues / Yang Belum Dikerjakan

### 1. `RpcClient` dibuat per request
Di `on_chain.rs`, `RpcClient::new()` dipanggil setiap request masuk. Harusnya di-cache di `AppState` atau minimal pakai connection pool. Ini bisa jadi bottleneck di load tinggi.

### 2. `verify_on_chain` blocking di async context
`RpcClient::get_account()` adalah synchronous blocking call, dipanggil dari dalam Axum async handler via middleware. Harusnya di-wrap `tokio::task::spawn_blocking` atau pakai `solana-client`'s async RPC client.

### 3. Storage in-memory
`HashMap<String, Message>` di `AppState`. Data hilang saat restart. Untuk production, ganti dengan database (PostgreSQL/SQLite).

### 4. Nonce store tidak pernah di-cleanup secara aktif
`NONCE_STORE` (`DashMap`) hanya cleanup lazily saat ada request baru (via `retain`). Kalau traffic sepi, expired nonces menumpuk. Bisa tambah background task cleanup.

### 5. Tidak ada integration test
Belum ada test end-to-end yang test full flow: grant → sign request → verify on-chain → response.

### 6. IDL di UI tidak auto-sync dengan contract
`ui/src/idl/aksara.json` adalah copy manual dari `contract/target/idl/aksara.json`. Kalau contract diubah dan di-redeploy, IDL di UI harus di-copy ulang manual.

### 7. `SolanaConfig` tidak di-inject ke public routes
Secara teknis betul (public routes tidak butuh Solana check), tapi kalau ada kebutuhan baca data on-chain dari public handler, perlu pass config via `AppState` bukan via `Extension`.

---

## Demo Flow

1. Jalankan API: `cd api && cargo run`
2. Jalankan UI: `cd ui && bun dev`
3. Buka `http://localhost:5173`
4. **Tanpa connect wallet:** coba `List All Messages` di API Tester → berhasil (public)
5. **Connect wallet**
6. Enable **Auto-Sign** (opsional, hindari popup)
7. Coba `Create Message` → **403** (belum punya grant)
8. Di **Access Grant Manager**: isi wallet address (bisa wallet sendiri), pilih scope READ+WRITE+DELETE, pilih TTL, klik Grant Access
9. Tunggu devnet confirm
10. Coba `Create Message` lagi → **201 Created**
11. Coba `Update Message` dengan ID dari step 10 → berhasil (bisa update message siapapun)
12. Revoke grant dari Grant Manager
13. Coba `Create Message` lagi → **403**

---

## Keputusan Desain Yang Perlu Diketahui

| Keputusan | Alasan |
|---|---|
| Tidak pakai `anchor-client` di API | Overkill untuk read-only. Cukup `anchor-lang` untuk `AccountDeserialize` + `solana-client` untuk RPC |
| Tidak depend ke program crate dari API | Build target conflict (SBF vs host). Struct `AccessGrant` didefinisikan lokal di API dengan discriminator dari IDL |
| `impl<'info> Accounts` pattern di contract | Menghindari naming collision `handle` saat glob re-export di `instructions/mod.rs` |
| Grant = admin access (bukan ownership-scoped) | Lebih compelling untuk demo — scope jadi benar-benar meaningful (WRITE = edit siapapun, bukan hanya milik sendiri) |
| Public/private split | Tanpa ini, Grant Panel tidak ada gunanya di dev mode. Sekarang terlihat jelas kontras: public bisa diakses bebas, private butuh grant |
| `OWNER_PUBKEY` opsional (dev mode) | Development experience — bisa test API tanpa setup Solana |
| Crate name `aksara-api` bukan `aksara` | Collision dengan program crate yang juga bernama `aksara` di Cargo workspace |
