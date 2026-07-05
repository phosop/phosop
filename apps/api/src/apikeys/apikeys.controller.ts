import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiKeysService } from './apikeys.service';
import { AdminGuard } from '../common/admin.guard';

class CreateKeyDto {
  @IsOptional() @IsString() label?: string;
  // test => devnet (default), live => mainnet-beta
  @IsOptional() @IsIn(['test', 'live']) mode?: 'test' | 'live';
}

/**
 * Admin-only key management. Authenticate with the X-Admin-Secret header.
 * The raw API key is returned ONCE on creation — store it securely.
 */
@UseGuards(AdminGuard)
@Controller('admin/api_keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Post()
  async create(@Body() dto: CreateKeyDto) {
    const { apiKey, prefix, network } = await this.apiKeys.create(dto.mode ?? 'test', dto.label);
    return { object: 'api_key', api_key: apiKey, prefix, network, mode: dto.mode ?? 'test', label: dto.label };
  }

  @Get()
  async list() {
    return { object: 'list', data: await this.apiKeys.list() };
  }

  @Post(':prefix/revoke')
  async revoke(@Param('prefix') prefix: string) {
    const ok = await this.apiKeys.revoke(prefix);
    return { prefix, revoked: ok };
  }
}
