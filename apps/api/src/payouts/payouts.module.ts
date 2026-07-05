import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payout, PayoutSchema } from './payout.schema';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { AccountsModule } from '../accounts/accounts.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payout.name, schema: PayoutSchema }]),
    AccountsModule,
    LedgerModule,
  ],
  providers: [PayoutsService],
  controllers: [PayoutsController],
  exports: [PayoutsService],
})
export class PayoutsModule {}
