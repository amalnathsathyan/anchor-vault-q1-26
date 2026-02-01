use anchor_lang::{prelude::*, system_program::{Transfer,transfer}};

declare_id!("7V1X6Eg5PGSKrE1bqCP7oTrHD9sAb6V9iNxhhncj1wJS");
mod error;
use crate::error::VaultError;

#[program]
pub mod anchor_vault {
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.initialize(&ctx.bumps)
    }

    pub fn deposit(ctx: Context<Deposit>, amount:u64) -> Result<()> {
       ctx.accounts.deposit(amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount:u64) -> Result<()> {
        ctx.accounts.withdraw(amount)
    }

    pub fn close(ctx:Context<Close>) -> Result<()> {
        ctx.accounts.close()
    }
}

#[derive(Accounts)]
pub struct Close<'info> {

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        close = user,
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

impl<'info> Close<'info> {
    pub fn close(&mut self) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();
        let vault_balance = self.vault.lamports();
        let cpi_account = Transfer{
            from: self.vault.to_account_info(),
            to:self.user.to_account_info()
        };
        
        let signer_seeds: &[&[&[u8]]] = &[&["vault".as_bytes(),self.vault_state.to_account_info().key.as_ref(),&[self.vault_state.vault_bump]]];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_account, signer_seeds);
        
        transfer(cpi_ctx, vault_balance)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Withdraw<'info> {

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

impl<'info> Withdraw<'info> {
    pub fn withdraw(&mut self, amount:u64) -> Result<()> {
        let vault_balance = self.vault.try_lamports()?;
        let rent_exempt = Rent::get()?.minimum_balance(self.vault.to_account_info().data_len());
        require!((vault_balance-rent_exempt) >= amount,VaultError::InsufficientFunds);
        let cpi_program = self.system_program.to_account_info();
        let cpi_account = Transfer{
            from: self.vault.to_account_info(),
            to:self.user.to_account_info()
        };
        
        let signer_seeds: &[&[&[u8]]] = &[&["vault".as_bytes(),self.vault_state.to_account_info().key.as_ref(),&[self.vault_state.vault_bump]]];
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_account, signer_seeds);
        
        transfer(cpi_ctx, amount)?;
        Ok(())
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

        let rent_exempt = Rent::get()?.minimum_balance(self.vault.to_account_info().data_len());
        
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

