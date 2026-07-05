import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebhooksService } from '../webhooks/webhooks.service';
import { SolanaService } from '../solana/solana.service';
import { PayoutsService } from '../payouts/payouts.service';
import { AlertService } from '../common/alert.service';
import { MetricsService } from '../common/metrics.service';

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);

  constructor(
    private readonly webhooks: WebhooksService,
    private readonly solana: SolanaService,
    private readonly payouts: PayoutsService,
    private readonly alerts: AlertService,
    private readonly metrics: MetricsService,
  ) {}

  /** Retry due webhook deliveries every minute. */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryWebhooks() {
    try {
      const n = await this.webhooks.processRetries();
      if (n) this.logger.log(`Retried ${n} webhook deliveries`);
    } catch (e) {
      this.logger.warn(`webhook retry cron failed: ${(e as Error).message}`);
    }
  }

  /** Reconcile payouts stuck in `pending` every minute. */
  @Cron(CronExpression.EVERY_MINUTE)
  async reconcile() {
    try {
      const n = await this.payouts.reconcilePending();
      if (n) this.logger.log(`Reconciled ${n} stale payouts`);
    } catch (e) {
      this.logger.warn(`reconcile cron failed: ${(e as Error).message}`);
    }
  }

  /** Check hot-wallet balances on every enabled network every 5 minutes. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkBalances() {
    const threshold = Number(process.env.LOW_BALANCE_ALERT_USDC || 100);
    const solFloor = Number(process.env.LOW_FEE_PAYER_SOL || 0.05);
    for (const network of this.solana.enabledNetworks()) {
      try {
        const usdc = await this.solana.platformUsdcBalance(network);
        const sol = await this.solana.feePayerSolBalance(network);
        this.metrics.gauge(`usdc_balance_${network}`, usdc);
        this.metrics.gauge(`fee_payer_sol_${network}`, sol);
        if (usdc < threshold) {
          await this.alerts.alert(
            'warning',
            `low-usdc:${network}`,
            `[${network}] low USDC balance`,
            `${usdc} < ${threshold}`,
          );
        }
        if (sol < solFloor) {
          await this.alerts.alert(
            'critical',
            `low-sol:${network}`,
            `[${network}] low fee-payer SOL — payouts may fail`,
            `${sol} < ${solFloor}`,
          );
        }
      } catch (e) {
        this.logger.warn(`[${network}] balance check failed: ${(e as Error).message}`);
      }
    }
  }
}
