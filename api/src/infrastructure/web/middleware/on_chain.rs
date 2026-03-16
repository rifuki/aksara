/// On-chain AccessGrant verification.
///
/// Derives the PDA [b"access", owner, grantee], fetches the account data via
/// Solana JSON-RPC, deserializes it (Borsh, 8-byte discriminator prefix skipped),
/// and validates: not revoked, not expired, scope covers required_scope.
use std::time::{SystemTime, UNIX_EPOCH};

use borsh::BorshDeserialize;
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;

use crate::infrastructure::config::SolanaConfig;

// ── AccessGrant mirror (must match the Anchor account layout) ─────────────────

#[allow(dead_code)]
#[derive(BorshDeserialize, Debug)]
struct AccessGrant {
    pub owner: [u8; 32],
    pub grantee: [u8; 32],
    pub scope: u8,
    pub expires_at: i64,
    pub revoked: bool,
    pub bump: u8,
}

// ── Scope bitmask ──────────────────────────────────────────────────────────────

pub const SCOPE_READ: u8 = 0x01;
pub const SCOPE_WRITE: u8 = 0x02;
pub const SCOPE_DELETE: u8 = 0x04;

// ── Public API ────────────────────────────────────────────────────────────────

/// Errors that can occur during on-chain verification.
#[derive(Debug)]
pub enum OnChainError {
    /// AccessGrant PDA does not exist
    NotFound,
    /// Grant is revoked
    Revoked,
    /// Grant has expired
    Expired,
    /// Grant scope does not cover the required scope
    InsufficientScope,
    /// RPC or deserialization failure
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

/// Verify that `grantee_base58` has a valid on-chain grant from the owner
/// with at least `required_scope`.
///
/// Returns `Ok(())` if the grant is valid, `Err(OnChainError)` otherwise.
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

    // Derive AccessGrant PDA — seeds: ["access", owner, grantee]
    let (pda, _bump) = Pubkey::find_program_address(
        &[b"access", owner.as_ref(), grantee.as_ref()],
        &program_id,
    );

    // Fetch account data (synchronous RPC call)
    let client = RpcClient::new(config.rpc_url.clone());
    let account = client
        .get_account(&pda)
        .map_err(|_| OnChainError::NotFound)?;

    // Skip 8-byte Anchor discriminator, then deserialize
    let data = account
        .data
        .get(8..)
        .ok_or_else(|| OnChainError::RpcError("Account data too short".to_string()))?;

    let grant = AccessGrant::try_from_slice(data)
        .map_err(|e| OnChainError::RpcError(format!("Deserialization failed: {e}")))?;

    // Validate
    if grant.revoked {
        return Err(OnChainError::Revoked);
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    if grant.expires_at <= now {
        return Err(OnChainError::Expired);
    }

    if (grant.scope & required_scope) == 0 {
        return Err(OnChainError::InsufficientScope);
    }

    Ok(())
}
