use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("6GXa5BEKNu7dBtCd3x6UnxkUjbvaoAMQnA9BvQbhavVc");

#[program]
pub mod aksara {
    use super::*;

    /// Owner grants API access to a grantee wallet with a scope bitmask and expiry.
    /// Creates (or resets) an `AccessGrant` PDA keyed by [owner, grantee].
    pub fn grant_access(ctx: Context<GrantAccess>, scope: u8, expires_at: i64) -> Result<()> {
        let bump = ctx.bumps.access_grant;
        ctx.accounts.grant_access(scope, expires_at, bump)
    }

    /// Owner revokes a previously issued grant (sets `revoked = true`).
    pub fn revoke_access(ctx: Context<RevokeAccess>) -> Result<()> {
        ctx.accounts.revoke_access()
    }
}
