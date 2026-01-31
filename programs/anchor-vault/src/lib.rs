use anchor_lang::{prelude::*, system_program::{Transfer,transfer}};

declare_id!("GmPQtALTvRqx5YE1VW4BN2od73xBpSfqbNapnbRPBkYZ");

#[program]
pub mod anchor_vault {
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps)
    }

    pub fn deposit(ctx: Context<Deposit>, amount:u64) -> Result<()> {
       ctx.accounts.deposit(amount)
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"vault_state",user.key().as_ref()],
        bump = vault_state.state_bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"vault",vault_state.key().as_ref()],
        bump = vault_state.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program : Program<'info, System>,
}

impl<'info> Deposit<'info> {
    pub fn deposit(&mut self, amount:u64) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();
        let cpi_account = Transfer{
            from: self.user.to_account_info(),
            to:self.vault.to_account_info()
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_account);
        transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        // with this init, we already deposited the rent amount of SOL 
        init,
        payer = user,
        seeds = [b"vault_state",user.key().as_ref()],
        space = VaultState::DISCRIMINATOR.len() + VaultState::INIT_SPACE,
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        // we do not neeed an init here, it will be created when the transfer is called
        mut,
        seeds = [b"vault",vault_state.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    pub system_program : Program<'info, System>,
}

impl <'info> Initialize<'info> {
    pub fn initialize(&mut self, bump:&InitializeBumps) -> Result<()> {

        let rent_exempt = Rent::get()?.minimum_balance(self.vault_state.to_account_info().data_len());
        
        let cpi_program = self.system_program.to_account_info();
        let cpi_accounts = Transfer {
            from: self.user.to_account_info(),
            to:self.vault.to_account_info()
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, rent_exempt)?;

        self.vault_state.vault_bump = bump.vault;
        self.vault_state.state_bump = bump.vault_state;
        Ok(())
    }
}

#[derive(InitSpace)]
#[account]
pub struct VaultState {
    vault_bump:u8,
    state_bump:u8
}

