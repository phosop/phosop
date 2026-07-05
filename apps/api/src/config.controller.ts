import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SolanaService } from './solana/solana.service';

/**
 * Public config endpoint so clients (and nervous users) can see which
 * networks are enabled before doing anything.
 */
@SkipThrottle()
@Controller('config')
export class ConfigController {
  constructor(private readonly solana: SolanaService) {}

  @Get()
  get() {
    const networks = this.solana.enabledNetworks();
    return {
      object: 'config',
      networks,
      devnet_enabled: networks.includes('devnet'),
      mainnet_enabled: networks.includes('mainnet-beta'),
    };
  }
}
