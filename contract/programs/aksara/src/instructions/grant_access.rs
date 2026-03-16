use anchor_lang::prelude::*;

use crate::{errors::AksaraError, events::GrantCreated, state::AccessGrant};

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

impl<'info> GrantAccess<'info> {
    pub fn grant_access(&mut self, scope: u8, expires_at: i64, bump: u8) -> Result<()> {
        require!(scope > 0, AksaraError::InvalidScope);
        require!(
            expires_at > Clock::get()?.unix_timestamp,
            AksaraError::AlreadyExpired
        );

        let grant = &mut self.access_grant;
        grant.owner = self.owner.key();
        grant.grantee = self.grantee.key();
        grant.scope = scope;
        grant.expires_at = expires_at;
        grant.revoked = false;
        grant.bump = bump;

        emit!(GrantCreated {
            owner: grant.owner,
            grantee: grant.grantee,
            scope,
            expires_at,
        });

        msg!(
            "Access granted: owner={} grantee={} scope={:#04x} expires_at={}",
            grant.owner,
            grant.grantee,
            scope,
            expires_at,
        );

        Ok(())
    }
}
