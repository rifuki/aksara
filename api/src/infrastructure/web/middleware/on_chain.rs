/// On-chain AccessGrant verification.
///
/// Fetches the PDA via Solana JSON-RPC and deserializes using anchor-lang's
/// `AccountDeserialize` — validates the 8-byte discriminator automatically,
/// without depending on anchor-client or the program crate.
use std::time::{SystemTime, UNIX_EPOCH};

use anchor_lang::{prelude::borsh, AccountDeserialize, AnchorDeserialize, Discriminator};
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;

use crate::infrastructure::config::SolanaConfig;

// ── Scope bitmask ─────────────────────────────────────────────────────────────

pub const SCOPE_READ: u8 = 0x01;
pub const SCOPE_WRITE: u8 = 0x02;
pub const SCOPE_DELETE: u8 = 0x04;

// ── AccessGrant ───────────────────────────────────────────────────────────────
//
// Fields must match the on-chain layout exactly.
// Discriminator = sha256("account:AccessGrant")[..8], sourced from target/idl/aksara.json.

// AccessGrant account layout (must match on-chain exactly)
// Borsh serialized: no padding between fields
#[derive(AnchorDeserialize, Debug)]
struct AccessGrant {
    _owner: Pubkey,      // 32 bytes
    _grantee: Pubkey,    // 32 bytes
    pub scope: u8,       // 1 byte
    pub expires_at: i64, // 8 bytes (Borsh uses little-endian)
    pub revoked: bool,   // 1 byte (Borsh: 0=false, 1=true)
    _bump: u8,           // 1 byte
}

impl Discriminator for AccessGrant {
    const DISCRIMINATOR: &'static [u8] = &[167, 55, 184, 237, 74, 242, 0, 109];
}

impl AccountDeserialize for AccessGrant {
    fn try_deserialize(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
        if buf.len() < 8 || &buf[..8] != Self::DISCRIMINATOR {
            return Err(anchor_lang::error::ErrorCode::AccountDiscriminatorMismatch.into());
        }
        *buf = &buf[8..];
        Self::try_deserialize_unchecked(buf)
    }

    fn try_deserialize_unchecked(buf: &mut &[u8]) -> anchor_lang::Result<Self> {
        AnchorDeserialize::deserialize(buf)
            .map_err(|_| anchor_lang::error::ErrorCode::AccountDidNotDeserialize.into())
    }
}

impl AccessGrant {
    fn is_valid(&self, required_scope: u8, now: i64) -> bool {
        !self.revoked && self.expires_at > now && (self.scope & required_scope) != 0
    }
}

// ── Errors ────────────────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum OnChainError {
    NotFound,
    Revoked,
    Expired,
    InsufficientScope,
    RpcError(String),
}

impl std::fmt::Display for OnChainError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound => write!(f, "No active access grant found"),
            Self::Revoked => write!(f, "Access grant has been revoked"),
            Self::Expired => write!(f, "Access grant has expired"),
            Self::InsufficientScope => write!(f, "Insufficient scope for this operation"),
            Self::RpcError(msg) => write!(f, "RPC error: {msg}"),
        }
    }
}

// ── Verification ──────────────────────────────────────────────────────────────

pub fn verify_on_chain(
    config: &SolanaConfig,
    grantee_base58: &str,
    required_scope: u8,
) -> Result<(), OnChainError> {
    let owner: Pubkey = config
        .owner_pubkey
        .parse()
        .map_err(|e| OnChainError::RpcError(format!("Invalid owner pubkey: {e}")))?;

    let grantee: Pubkey = grantee_base58
        .parse()
        .map_err(|e| OnChainError::RpcError(format!("Invalid grantee pubkey: {e}")))?;

    let program_id: Pubkey = config
        .program_id
        .parse()
        .map_err(|e| OnChainError::RpcError(format!("Invalid program_id: {e}")))?;

    let (pda, _) =
        Pubkey::find_program_address(&[b"access", owner.as_ref(), grantee.as_ref()], &program_id);

    tracing::info!("Looking for AccessGrant PDA: {}", pda);
    tracing::info!("Seeds: owner={}, grantee={}", owner, grantee);

    let client = RpcClient::new(config.rpc_url.clone());
    let account = client
        .get_account(&pda)
        .map_err(|_| OnChainError::NotFound)?;

    tracing::info!(
        "Raw account data len: {}, first 20 bytes: {:?}",
        account.data.len(),
        &account.data[..20.min(account.data.len())]
    );

    let grant = AccessGrant::try_deserialize(&mut account.data.as_ref())
        .map_err(|e| OnChainError::RpcError(format!("Deserialization failed: {e}")))?;

    tracing::info!(
        "AccessGrant: scope={}, expires_at={}, revoked={}",
        grant.scope,
        grant.expires_at,
        grant.revoked
    );
    tracing::debug!(
        "revoked={}, expires_at={}, scope={}",
        grant.revoked,
        grant.expires_at,
        grant.scope
    );

    if grant.revoked {
        return Err(OnChainError::Revoked);
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    if !grant.is_valid(required_scope, now) {
        return Err(if grant.expires_at <= now {
            OnChainError::Expired
        } else {
            OnChainError::InsufficientScope
        });
    }

    Ok(())
}
