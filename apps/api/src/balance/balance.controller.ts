import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/api-key.guard';
import { Network, PhosopNetwork } from '../common/network';
import { SolanaService } from '../solana/solana.service';

/**
 * Returns the operator's balances for the network implied by the API key.
 * usdc_available = platform wallet USDC; fee_payer_sol = gas wallet SOL.
 */
@UseGuards(ApiKeyGuard)
@Controller('balance')
export class BalanceController {
  constructor(private readonly solana: SolanaService) {}

  @Get()
  async get(@Network() network: PhosopNetwork) {
    const [usdc, sol] = await Promise.all([
      this.solana.platformUsdcBalance(network),
      this.solana.feePayerSolBalance(network),
    ]);
    return {
      object: 'balance',
      network,
      usdc_available: usdc,
      fee_payer_sol: sol,
    };
  }
}
