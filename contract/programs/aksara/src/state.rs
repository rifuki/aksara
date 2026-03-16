use anchor_lang::prelude::*;

#[account]
pub struct AccessGrant {
    pub owner: Pubkey,   // 32 — who issued the grant
    pub grantee: Pubkey, // 32 — who received it
    pub scope: u8,       // 1  — bitmask: READ=0x01 WRITE=0x02 DELETE=0x04
    pub expires_at: i64, // 8  — unix timestamp (seconds)
    pub revoked: bool,   // 1
    pub bump: u8,        // 1  — PDA bump seed
}

impl AccessGrant {
    // 8 (discriminator) + 32 + 32 + 1 + 8 + 1 + 1
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 1 + 1;

    /// Returns true if the grant is currently valid for the required scope.
    pub fn is_valid(&self, required_scope: u8, now: i64) -> bool {
        !self.revoked && self.expires_at > now && (self.scope & required_scope) != 0
    }
}
