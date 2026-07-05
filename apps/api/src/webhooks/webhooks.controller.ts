import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsUrl } from 'class-validator';
import { WebhooksService } from './webhooks.service';
import { ApiKeyGuard } from '../common/api-key.guard';

class CreateEndpointDto {
  @IsUrl({ require_tld: process.env.NODE_ENV === 'production' }) url!: string;
  @IsOptional() @IsArray() enabled_events?: string[];
}

@UseGuards(ApiKeyGuard)
@Controller('webhook_endpoints')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post()
  create(@Body() dto: CreateEndpointDto) {
    return this.webhooks.registerEndpoint(dto.url, dto.enabled_events);
  }

  @Get()
  async list() {
    return { object: 'list', data: await this.webhooks.listEndpoints() };
  }
}
