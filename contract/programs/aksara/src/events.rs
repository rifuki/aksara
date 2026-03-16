use anchor_lang::prelude::*;

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
