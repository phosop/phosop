import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../common/api-key.guard';
import { Network, PhosopNetwork } from '../common/network';
import { LedgerService } from './ledger.service';

/** Read-only ledger for the network implied by the API key. */
@UseGuards(ApiKeyGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  list(
    @Network() network: PhosopNetwork,
    @Query('limit') limit?: string,
    @Query('starting_after') startingAfter?: string,
  ) {
    return this.ledger.list(network, limit ? Number(limit) : 20, startingAfter);
  }
}
