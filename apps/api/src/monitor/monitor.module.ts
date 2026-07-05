import { Module } from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [PayoutsModule],
  providers: [MonitorService],
})
export class MonitorModule {}
