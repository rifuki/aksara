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

Initial repository status
------------------------

This repository is initialized with the base project documentation.
Code modules for contract, SDK, backend, and frontend can be added next as separate directories (`contract/`, `sdk/`, `backend/`, `frontend/`).

Getting started (template)
--------------------------

After adding source modules:

1. Install dependencies in each workspace folder.
2. Configure on-chain program and frontend/backend endpoints.
3. Run backend + frontend services.
4. Grant access on-chain and test signed protected endpoints.

Roadmap
-------

- Initialize smart contract module (`contract/`).
- Add TypeScript SDK for signing/verification helpers.
- Add Axum backend middleware for request verification.
- Add React dashboard with wallet + auto-sign app-wallet mode.
- Add integration tests and demo flow.

License
-------

MIT
