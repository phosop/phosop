import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SolanaModule } from './solana/solana.module';
import { AccountsModule } from './accounts/accounts.module';
import { PayoutsModule } from './payouts/payouts.module';
import { ApiKeysModule } from './apikeys/apikeys.module';
import { CommonModule } from './common/common.module';
import { LedgerModule } from './ledger/ledger.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { MonitorModule } from './monitor/monitor.module';
import { HealthController } from './health.controller';
import { ConfigController } from './config.controller';
import { BalanceController } from './balance/balance.controller';

@Module({
  imports: [
    // Load env from the app dir first, then fall back to the repo root .env so
    // it works whether you run from the monorepo root or from apps/api.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/phosop',
    ),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: (process.env.RATE_LIMIT_TTL ? Number(process.env.RATE_LIMIT_TTL) : 60) * 1000,
        limit: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 120,
      },
    ]),
    CommonModule,
    SolanaModule,
    ApiKeysModule,
    AccountsModule,
    LedgerModule,
    WebhooksModule,
    PayoutsModule,
    MonitorModule,
  ],
  controllers: [HealthController, ConfigController, BalanceController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
