use anchor_lang::prelude::*;

declare_id!("GmPQtALTvRqx5YE1VW4BN2od73xBpSfqbNapnbRPBkYZ");

#[program]
pub mod anchor_vault {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
