use anchor_lang::prelude::*;

declare_id!("H2MUTZ1NSYpGJ1aQgksemfADNfTPurE7doJ77kffCZaE");

// ── Scope bitmask (same as README) ────────────────────────────────────────────
pub const SCOPE_READ: u8 = 0x01;
pub const SCOPE_WRITE: u8 = 0x02;
pub const SCOPE_DELETE: u8 = 0x04;

#[program]
pub mod contract {
    use super::*;

    /// Owner grants API access to a grantee wallet with a scope bitmask and expiry.
    /// Creates an `AccessGrant` PDA keyed by [owner, grantee].
    pub fn grant_access(
        ctx: Context<GrantAccess>,
        scope: u8,
        expires_at: i64,
    ) -> Result<()> {
        require!(scope > 0, AksaraError::InvalidScope);
        require!(
            expires_at > Clock::get()?.unix_timestamp,
            AksaraError::AlreadyExpired
        );

        let grant = &mut ctx.accounts.access_grant;
        grant.owner = ctx.accounts.owner.key();
        grant.grantee = ctx.accounts.grantee.key();
        grant.scope = scope;
        grant.expires_at = expires_at;
        grant.revoked = false;
        grant.bump = ctx.bumps.access_grant;

        emit!(GrantCreated {
            owner: grant.owner,
            grantee: grant.grantee,
            scope,
            expires_at,
        });

        msg!(
            "Access granted: owner={} grantee={} scope={} expires_at={}",
            grant.owner,
            grant.grantee,
            scope,
            expires_at,
        );

        Ok(())
    }

    /// Owner revokes a previously issued grant.
    /// Sets `revoked = true`; owner can close the account to reclaim rent.
    pub fn revoke_access(ctx: Context<RevokeAccess>) -> Result<()> {
        let grant = &mut ctx.accounts.access_grant;
        require!(!grant.revoked, AksaraError::AlreadyRevoked);

        grant.revoked = true;

        emit!(GrantRevoked {
            owner: grant.owner,
            grantee: grant.grantee,
        });

        msg!(
            "Access revoked: owner={} grantee={}",
            grant.owner,
            grant.grantee,
        );

        Ok(())
    }
}

// ── Account structs ───────────────────────────────────────────────────────────

#[account]
pub struct AccessGrant {
    pub owner: Pubkey,      // 32
    pub grantee: Pubkey,    // 32
    pub scope: u8,          // 1  — bitmask: READ=1 WRITE=2 DELETE=4
    pub expires_at: i64,    // 8  — unix seconds
    pub revoked: bool,      // 1
    pub bump: u8,           // 1
}

impl AccessGrant {
    // 8 (discriminator) + 32 + 32 + 1 + 8 + 1 + 1
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 1 + 1;

    /// Returns true if the grant is currently valid for the required scope.
    pub fn is_valid(&self, required_scope: u8, now: i64) -> bool {
        !self.revoked
            && self.expires_at > now
            && (self.scope & required_scope) != 0
    }
}

// ── Contexts ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct GrantAccess<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: grantee is just a pubkey being granted access; no constraints needed
    pub grantee: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = owner,
        space = AccessGrant::LEN,
        seeds = [b"access", owner.key().as_ref(), grantee.key().as_ref()],
        bump,
    )]
    pub access_grant: Account<'info, AccessGrant>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeAccess<'info> {
    pub owner: Signer<'info>,

    /// CHECK: grantee pubkey used only for PDA derivation
    pub grantee: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"access", owner.key().as_ref(), grantee.key().as_ref()],
        bump = access_grant.bump,
        constraint = access_grant.owner == owner.key() @ AksaraError::Unauthorized,
    )]
    pub access_grant: Account<'info, AccessGrant>,
}

// ── Errors ────────────────────────────────────────────────────────────────────

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

// ── Events ────────────────────────────────────────────────────────────────────

#[event]
pub struct GrantCreated {
    pub owner: Pubkey,
    pub grantee: Pubkey,
    pub scope: u8,
    pub expires_at: i64,
}

#[event]
pub struct GrantRevoked {
    pub owner: Pubkey,
    pub grantee: Pubkey,
}
