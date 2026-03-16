use anchor_lang::prelude::*;

#[error_code]
pub enum AksaraError {
    #[msg("Scope must be non-zero")]
    InvalidScope,
    #[msg("expires_at must be in the future")]
    AlreadyExpired,
    #[msg("Grant is already revoked")]
    AlreadyRevoked,
    #[msg("Only the owner can revoke a grant")]
    Unauthorized,
}
