import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorVault } from "../target/types/anchor_vault";
import { expect } from "chai";

describe("anchor-vault", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.anchorVault as Program<AnchorVault>;
  const user = provider.wallet.publicKey;

  const [vaultStatePda, stateBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault_state"),user.toBuffer()],
    program.programId
  )

  const [vaultPda, vaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"),vaultStatePda.toBuffer()],
    program.programId
  )

  before(async () => {
    // Airdrop for fees 
    await provider.connection.requestAirdrop(user, 10 * anchor.web3.LAMPORTS_PER_SOL);
    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 1000));
  });



  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods
    .initialize()
    .accountsStrict({
      user: user,
      vaultState: vaultStatePda,
      vault: vaultPda,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .rpc();

    console.log("tx sucess", tx);

    const vaultState = await program.account.vaultState.fetch(vaultStatePda);
    console.log("vault state pda",vaultState);
    expect(vaultState.vaultBump).to.equal(vaultBump);
    expect(vaultState.stateBump).to.equal(stateBump);
    console.log("vault state pda exists");

    const vaultBalance = await provider.connection.getBalance(vaultPda);
    console.log("vault exists", vaultBalance);
    const rentExempt = await provider.connection.getMinimumBalanceForRentExemption(0);
    console.log({rentExempt})
    expect(vaultBalance).to.equal(rentExempt);

  });
});
