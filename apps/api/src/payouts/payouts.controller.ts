import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PayoutsService } from './payouts.service';
import { ApiKeyGuard } from '../common/api-key.guard';
import { IdempotencyService } from '../common/idempotency.service';
import { PhosopError } from '../common/errors';
import { Network, PhosopNetwork } from '../common/network';

class CreatePayoutDto {
  // number or numeric string (smallest units, BigInt-safe on the server)
  @IsOptional() amount!: number | string;
  @IsOptional() @IsString() currency?: string;
  @IsString() destination!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() metadata?: Record<string, string>;
}

class BatchPayoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePayoutDto)
  payouts!: CreatePayoutDto[];
}

@UseGuards(ApiKeyGuard)
@Controller('payouts')
export class PayoutsController {
  constructor(
    private readonly payouts: PayoutsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  private requireKey(key?: string): string {
    if (!key || !key.trim()) {
      throw PhosopError.invalidRequest(
        'idempotency_key_required',
        'An Idempotency-Key header is required for this endpoint.',
      );
    }
    return key.trim();
  }

  @Post()
  async create(
    @Body() dto: CreatePayoutDto,
    @Network() network: PhosopNetwork,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const key = this.requireKey(idempotencyKey);
    const acq = await this.idempotency.acquire(key, network, dto);
    if (acq.completed) return acq.response;
    try {
      const result = await this.payouts.create(network, dto);
      await this.idempotency.complete(key, network, result);
      return result;
    } catch (e) {
      await this.idempotency.release(key, network);
      throw e;
    }
  }

  @Post('batch')
  async batch(
    @Body() dto: BatchPayoutDto,
    @Network() network: PhosopNetwork,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const key = this.requireKey(idempotencyKey);
    const acq = await this.idempotency.acquire(key, network, dto);
    if (acq.completed) return acq.response;
    try {
      const result = await this.payouts.createBatch(network, dto.payouts);
      await this.idempotency.complete(key, network, result);
      return result;
    } catch (e) {
      await this.idempotency.release(key, network);
      throw e;
    }
  }

  @Get(':id')
  retrieve(@Param('id') id: string, @Network() network: PhosopNetwork) {
    return this.payouts.retrieve(id, network);
  }

  @Get()
  list(
    @Network() network: PhosopNetwork,
    @Query('limit') limit?: string,
    @Query('starting_after') startingAfter?: string,
  ) {
    return this.payouts.list(network, limit ? Number(limit) : 20, startingAfter);
  }
}
