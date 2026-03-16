import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Contract } from "../target/types/contract";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("aksara — access grant", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Contract as Program<Contract>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  const owner = provider.wallet as anchor.Wallet;
  const grantee = Keypair.generate();

  const SCOPE_READ = 0x01;
  const SCOPE_WRITE = 0x02;
  const ONE_HOUR = 3600;

  function getGrantPda(ownerPk: PublicKey, granteePk: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("access"), ownerPk.toBuffer(), granteePk.toBuffer()],
      program.programId
    );
  }

  it("grant_access: creates AccessGrant PDA with correct data", async () => {
    const [grantPda] = getGrantPda(owner.publicKey, grantee.publicKey);
    const expiresAt = new BN(Math.floor(Date.now() / 1000) + ONE_HOUR);

    await program.methods
      .grantAccess(SCOPE_READ | SCOPE_WRITE, expiresAt)
      .accounts({
        owner: owner.publicKey,
        grantee: grantee.publicKey,
        accessGrant: grantPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const grant = await program.account.accessGrant.fetch(grantPda);
    assert.equal(grant.owner.toBase58(), owner.publicKey.toBase58());
    assert.equal(grant.grantee.toBase58(), grantee.publicKey.toBase58());
    assert.equal(grant.scope, SCOPE_READ | SCOPE_WRITE);
    assert.isTrue(grant.expiresAt.gt(new BN(0)));
    assert.isFalse(grant.revoked);
  });

  it("grant_access: fails with scope=0", async () => {
    const [grantPda] = getGrantPda(owner.publicKey, Keypair.generate().publicKey);
    const expiresAt = new BN(Math.floor(Date.now() / 1000) + ONE_HOUR);

    try {
      await program.methods
        .grantAccess(0, expiresAt)
        .accounts({
          owner: owner.publicKey,
          grantee: Keypair.generate().publicKey,
          accessGrant: grantPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have thrown InvalidScope");
    } catch (err: any) {
      assert.include(err.message, "InvalidScope");
    }
  });

  it("revoke_access: sets revoked=true", async () => {
    const [grantPda] = getGrantPda(owner.publicKey, grantee.publicKey);

    await program.methods
      .revokeAccess()
      .accounts({
        owner: owner.publicKey,
        grantee: grantee.publicKey,
        accessGrant: grantPda,
      })
      .rpc();

    const grant = await program.account.accessGrant.fetch(grantPda);
    assert.isTrue(grant.revoked);
  });

  it("revoke_access: fails if already revoked", async () => {
    const [grantPda] = getGrantPda(owner.publicKey, grantee.publicKey);

    try {
      await program.methods
        .revokeAccess()
        .accounts({
          owner: owner.publicKey,
          grantee: grantee.publicKey,
          accessGrant: grantPda,
        })
        .rpc();
      assert.fail("Should have thrown AlreadyRevoked");
    } catch (err: any) {
      assert.include(err.message, "AlreadyRevoked");
    }
  });

  it("grant_access: re-grant after revoke resets the PDA", async () => {
    const [grantPda] = getGrantPda(owner.publicKey, grantee.publicKey);
    const expiresAt = new BN(Math.floor(Date.now() / 1000) + ONE_HOUR * 2);

    await program.methods
      .grantAccess(SCOPE_READ, expiresAt)
      .accounts({
        owner: owner.publicKey,
        grantee: grantee.publicKey,
        accessGrant: grantPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const grant = await program.account.accessGrant.fetch(grantPda);
    assert.isFalse(grant.revoked, "re-grant should reset revoked flag");
    assert.equal(grant.scope, SCOPE_READ);
  });
});
