import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { IdempotencyKey, IdempotencyKeySchema } from './idempotency.schema';
import { IdempotencyService } from './idempotency.service';
import { AdminGuard } from './admin.guard';
import { AlertService } from './alert.service';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { LoggingInterceptor } from './logging.interceptor';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IdempotencyKey.name, schema: IdempotencyKeySchema },
    ]),
  ],
  providers: [
    IdempotencyService,
    AdminGuard,
    AlertService,
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
  controllers: [MetricsController],
  exports: [IdempotencyService, AdminGuard, AlertService, MetricsService],
})
export class CommonModule {}
