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

    const vaultState = await program.account.vaultState.fetch(vaultStatePda);
    expect(vaultState.vaultBump).to.equal(vaultBump);
    expect(vaultState.stateBump).to.equal(stateBump);

    const vaultBalance = await provider.connection.getBalance(vaultPda);
    const rentExempt = await provider.connection.getMinimumBalanceForRentExemption(0);
    expect(vaultBalance).to.equal(rentExempt);

  });

  it("Deposit SOL to vault", async()=> {
    const amount = 1 * anchor.web3.LAMPORTS_PER_SOL;
    const userBalanceBefore = await provider.connection.getBalance(user);
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);
     
    const tx = await program.methods
     .deposit(new anchor.BN(amount))
     .accountsStrict({
      user: user,
      vaultState: vaultStatePda,
      vault: vaultPda,
      systemProgram: anchor.web3.SystemProgram.programId
     })
     .rpc();
    const userBalanceAfter = await provider.connection.getBalance(user);
    const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);

    expect(vaultBalanceAfter-vaultBalanceBefore).to.equal(amount);
    //user balance 1SOL - fees
    expect(userBalanceAfter).to.equal(userBalanceBefore - amount - 5000);
  })

  it("Withdraws SOL from vault", async()=> {
    const amount = 0.4 * anchor.web3.LAMPORTS_PER_SOL;
    const userBalanceBefore = await provider.connection.getBalance(user);
    const vaultBalanceBefore = await provider.connection.getBalance(vaultPda);
     
    const tx = await program.methods
     .withdraw(new anchor.BN(amount))
     .accountsStrict({
      user: user,
      vaultState: vaultStatePda,
      vault: vaultPda,
      systemProgram: anchor.web3.SystemProgram.programId
     })
     .rpc();
    const userBalanceAfter = await provider.connection.getBalance(user);
    const vaultBalanceAfter = await provider.connection.getBalance(vaultPda);

    expect(vaultBalanceBefore-vaultBalanceAfter).to.equal(amount);
    //user balance +0.4SOL - fees
    expect(userBalanceAfter).to.equal(userBalanceBefore + amount - 5000);
  })

   it("Close the vault", async () => {
    const initialVaultBalance = await provider.connection.getBalance(vaultPda);
    const initialVaultStateBalance = await provider.connection.getBalance(vaultStatePda);
    const initialUserBalance = await provider.connection.getBalance(user);

    await program.methods
      .close()
      .accountsStrict({
        user: user,
        vault: vaultPda,
        vaultState: vaultStatePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const finalUserBalance = await provider.connection.getBalance(user);

    // Vault should be 0
    expect(await provider.connection.getBalance(vaultPda)).to.equal(0);

    // VaultState should be closed (null)
    const vaultStateInfo = await provider.connection.getAccountInfo(vaultStatePda);
    expect(vaultStateInfo).to.be.null;

    // User gets back the remaining balance - fees
    expect(finalUserBalance).to.equal(initialUserBalance + initialVaultBalance + initialVaultStateBalance - 5000);
  });

});
