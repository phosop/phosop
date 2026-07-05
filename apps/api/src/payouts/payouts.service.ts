import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payout } from './payout.schema';
import { AccountsService } from '../accounts/accounts.service';
import { SolanaService } from '../solana/solana.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { LedgerService } from '../ledger/ledger.service';
import { AlertService } from '../common/alert.service';
import { MetricsService } from '../common/metrics.service';
import { ConfirmTimeoutError, PhosopError } from '../common/errors';
import { PhosopNetwork } from '../common/network';

export interface PayoutInput {
  amount: number | string;
  currency?: string;
  destination: string;
  description?: string;
  metadata?: Record<string, string>;
}

function envBig(name: string, fallback: string): bigint {
  return BigInt(process.env[name] ?? fallback);
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? Number(v) : fallback;
}

/**
 * Validates amount as a positive integer (smallest units) using BigInt so we
 * never lose precision on large values. Accepts number or numeric string.
 */
export function validateAmount(amount: unknown): bigint {
  let v: bigint;
  if (typeof amount === 'bigint') {
    v = amount;
  } else if (typeof amount === 'number') {
    if (!Number.isInteger(amount)) {
      throw PhosopError.invalidRequest('amount_invalid', 'amount must be an integer in smallest units');
    }
    v = BigInt(amount);
  } else if (typeof amount === 'string' && /^\d+$/.test(amount.trim())) {
    v = BigInt(amount.trim());
  } else {
    throw PhosopError.invalidRequest('amount_invalid', 'amount must be a non-negative integer (smallest units)');
  }

  if (v <= 0n) {
    throw PhosopError.invalidRequest('amount_invalid', 'amount must be greater than 0');
  }
  const min = envBig('MIN_PAYOUT_UNITS', '10000');
  const max = envBig('MAX_PAYOUT_UNITS', '100000000000');
  if (v < min || v > max) {
    throw PhosopError.invalidRequest(
      'amount_out_of_range',
      `amount must be between ${min.toString()} and ${max.toString()} smallest units`,
    );
  }
  return v;
}

export function validateCurrency(currency?: string): string {
  const cur = (currency ?? 'usdc').toLowerCase();
  const supported = (process.env.SUPPORTED_CURRENCIES ?? 'usdc')
    .split(',')
    .map((c) => c.trim().toLowerCase());
  if (!supported.includes(cur)) {
    throw PhosopError.invalidRequest('currency_unsupported', `currency '${cur}' is not supported`);
  }
  return cur;
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    @InjectModel(Payout.name) private readonly model: Model<Payout>,
    private readonly accounts: AccountsService,
    private readonly solana: SolanaService,
    private readonly webhooks: WebhooksService,
    private readonly ledger: LedgerService,
    private readonly alerts: AlertService,
    private readonly metrics: MetricsService,
  ) {}

  async create(network: PhosopNetwork, data: PayoutInput) {
    if (!this.solana.isEnabled(network)) throw PhosopError.networkNotEnabled(network);
    const amount = validateAmount(data.amount); // bigint
    const currency = validateCurrency(data.currency);
    const wallet = await this.accounts.requireWallet(data.destination);

    const doc = await this.model.create({
      account: data.destination,
      amount: amount.toString(),
      currency,
      network,
      status: 'pending',
      description: data.description,
      metadata: data.metadata ?? {},
    });

    try {
      const sig = await this.solana.sendPayout(
        network,
        { destinationOwner: wallet, amount },
        async (signature) => {
          // Persist signature the instant it is broadcast, before confirmation.
          doc.txSignature = signature;
          await doc.save();
        },
      );
      doc.status = 'paid';
      doc.txSignature = sig;
      await doc.save();
      const serialized = this.serialize(doc);
      await this.ledger.recordPayout({
        network,
        payoutId: doc._id,
        account: doc.account,
        amount: doc.amount,
        currency: doc.currency,
        txSignature: sig,
      });
      await this.webhooks.emit('transfer.created', serialized);
      await this.webhooks.emit('payout.paid', serialized);
      this.metrics.inc('payouts_paid_total');
      this.checkLowBalance(network).catch(() => undefined);
      return serialized;
    } catch (e) {
      if (e instanceof ConfirmTimeoutError) {
        // Tx was broadcast but not confirmed in time. Keep it PENDING with the
        // signature so reconciliation finalizes it. Never mark failed / resend.
        doc.status = 'pending';
        doc.txSignature = e.signature;
        await doc.save();
        this.metrics.inc('payouts_pending_total');
        this.logger.warn(`[${network}] payout ${doc._id} broadcast but unconfirmed; left pending (sig ${e.signature})`);
        return this.serialize(doc);
      }
      // Failure happened BEFORE any broadcast -> safe to mark failed.
      doc.status = 'failed';
      doc.error = (e as Error).message;
      await doc.save();
      this.metrics.inc('payouts_failed_total');
      const serialized = this.serialize(doc);
      await this.webhooks.emit('payout.failed', serialized);
      throw e;
    }
  }

  /** Creates many payouts sequentially; each item succeeds or fails independently. */
  async createBatch(network: PhosopNetwork, items: PayoutInput[]) {
    const max = envInt('MAX_BATCH_SIZE', 50);
    if (!Array.isArray(items) || items.length === 0) {
      throw PhosopError.invalidRequest('batch_empty', 'payouts array must not be empty');
    }
    if (items.length > max) {
      throw PhosopError.invalidRequest('batch_too_large', `batch exceeds MAX_BATCH_SIZE (${max})`);
    }
    const data: any[] = [];
    for (const item of items) {
      try {
        data.push(await this.create(network, item));
      } catch (e: any) {
        data.push({
          object: 'payout',
          status: 'failed',
          destination: item.destination,
          error: e?.response?.error?.message ?? e?.message ?? 'failed',
        });
      }
    }
    return { object: 'list', data, has_more: false };
  }

  async retrieve(id: string, network: PhosopNetwork) {
    const doc = await this.model.findOne({ _id: id, network });
    if (!doc) throw PhosopError.notFound(`No such payout: ${id}`);
    return this.serialize(doc);
  }

  /** Cursor pagination: pass a payout id in starting_after to get older items. */
  async list(network: PhosopNetwork, limit = 20, startingAfter?: string) {
    const take = Math.min(Math.max(limit, 1), 100);
    const filter: Record<string, unknown> = { network };
    if (startingAfter) {
      const cursor = await this.model.findById(startingAfter);
      if (cursor) filter['createdAt'] = { $lt: (cursor as any).createdAt };
    }
    const docs = await this.model.find(filter).sort({ createdAt: -1 }).limit(take + 1);
    const hasMore = docs.length > take;
    return {
      object: 'list',
      data: docs.slice(0, take).map((d) => this.serialize(d)),
      has_more: hasMore,
    };
  }

  /**
   * Reconciles payouts stuck in `pending`. Safety rules:
   *  - has signature + confirmed on-chain -> mark paid
   *  - has signature + not yet confirmed  -> leave pending, unless older than
   *    RECONCILE_GIVEUP_SECONDS (blockhash long expired) -> mark failed
   *  - no signature (never broadcast)     -> mark failed (safe, no double pay)
   */
  async reconcilePending() {
    const timeoutSec = envInt('RECONCILE_TIMEOUT_SECONDS', 120);
    const giveupSec = envInt('RECONCILE_GIVEUP_SECONDS', 3600);
    const cutoff = new Date(Date.now() - timeoutSec * 1000);
    const stale = await this.model.find({ status: 'pending', createdAt: { $lt: cutoff } }).limit(50);
    let reconciled = 0;

    for (const d of stale) {
      const network = d.network as PhosopNetwork;
      const ageSec = (Date.now() - new Date((d as any).createdAt).getTime()) / 1000;

      if (d.txSignature && this.solana.isEnabled(network)) {
        const confirmed = await this.solana.isConfirmed(network, d.txSignature).catch(() => false);
        if (confirmed) {
          d.status = 'paid';
          await d.save();
          await this.ledger.recordPayout({
            network,
            payoutId: d._id,
            account: d.account,
            amount: d.amount,
            currency: d.currency,
            txSignature: d.txSignature,
          });
          await this.webhooks.emit('payout.paid', this.serialize(d));
          this.metrics.inc('payouts_paid_total');
          reconciled++;
          continue;
        }
        // Broadcast but still unconfirmed. Only give up once well past blockhash expiry.
        if (ageSec < giveupSec) continue;
        d.status = 'failed';
        d.error = d.error ?? 'signature_unconfirmed_expired';
        await d.save();
        this.metrics.inc('payouts_failed_total');
        await this.webhooks.emit('payout.failed', this.serialize(d));
        reconciled++;
        continue;
      }

      // No signature => the tx was never broadcast => safe to fail.
      d.status = 'failed';
      d.error = d.error ?? 'reconciled_timeout_no_broadcast';
      await d.save();
      this.metrics.inc('payouts_failed_total');
      await this.webhooks.emit('payout.failed', this.serialize(d));
      reconciled++;
    }
    return reconciled;
  }

  private async checkLowBalance(network: PhosopNetwork) {
    const threshold = Number(process.env.LOW_BALANCE_ALERT_USDC || 100);
    const usdc = await this.solana.platformUsdcBalance(network);
    this.metrics.gauge(`usdc_balance_${network}`, usdc);
    if (usdc < threshold) {
      await this.alerts.alert(
        'warning',
        `low-usdc:${network}`,
        `[${network}] low USDC balance`,
        `${usdc} < ${threshold}`,
      );
    }
  }

  private serialize(doc: any) {
    return {
      id: doc._id,
      object: 'payout',
      account: doc.account,
      amount: doc.amount, // string (smallest units)
      currency: doc.currency,
      network: doc.network,
      status: doc.status,
      description: doc.description,
      metadata: doc.metadata ?? {},
      tx_signature: doc.txSignature,
      error: doc.error,
      created: Math.floor(new Date(doc.createdAt).getTime() / 1000),
    };
  }
}
