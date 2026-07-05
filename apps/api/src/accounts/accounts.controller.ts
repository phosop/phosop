import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator';
import { AccountsService } from './accounts.service';
import { ApiKeyGuard } from '../common/api-key.guard';

class CreateAccountDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsObject() metadata?: Record<string, string>;
}

class AttachWalletDto {
  @IsString() walletAddress!: string;
}

@UseGuards(ApiKeyGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.accounts.create(dto);
  }

  @Get(':id')
  retrieve(@Param('id') id: string) {
    return this.accounts.retrieve(id);
  }

  @Post(':id/wallet')
  attachWallet(@Param('id') id: string, @Body() dto: AttachWalletDto) {
    return this.accounts.attachWallet(id, dto.walletAddress);
  }
}
