use anchor_lang::prelude::*;

use crate::{errors::AksaraError, events::GrantRevoked, state::AccessGrant};

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

impl<'info> RevokeAccess<'info> {
    pub fn revoke_access(&mut self) -> Result<()> {
        let grant = &mut self.access_grant;
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
