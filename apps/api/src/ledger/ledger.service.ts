import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LedgerEntry } from './ledger.schema';
import { PhosopNetwork } from '../common/network';

export interface PayoutLedgerInput {
  network: PhosopNetwork;
  payoutId: string;
  account: string;
  amount: string; // smallest units
  currency: string;
  txSignature?: string;
  description?: string;
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(@InjectModel(LedgerEntry.name) private readonly model: Model<LedgerEntry>) {}

  /**
   * Records the balanced double-entry for a confirmed payout. Idempotent per
   * payout: if entries already exist for this payoutId it does nothing, so it
   * is safe to call from both the create path and reconciliation.
   */
  async recordPayout(input: PayoutLedgerInput): Promise<void> {
    try {
      const existing = await this.model.exists({ payoutId: input.payoutId });
      if (existing) return;
      const base = {
        network: input.network,
        payoutId: input.payoutId,
        amount: input.amount,
        currency: input.currency,
        txSignature: input.txSignature,
        description: input.description ?? `payout ${input.payoutId}`,
      };
      await this.model.create([
        { ...base, side: 'debit', account: 'platform' },
        { ...base, side: 'credit', account: input.account },
      ]);
    } catch (e) {
      // Never let ledger writes break a payout; log for reconciliation follow-up.
      this.logger.warn(`ledger record failed for ${input.payoutId}: ${(e as Error).message}`);
    }
  }

  /** Cursor pagination over ledger entries for a network (newest first). */
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

  /** Total USDC that has left the platform on this network (sum of debits). */
  async platformOutflow(network: PhosopNetwork): Promise<string> {
    const debits = await this.model.find({ network, side: 'debit', account: 'platform' });
    let total = 0n;
    for (const d of debits) total += BigInt(d.amount);
    return total.toString();
  }

  private serialize(doc: any) {
    return {
      id: doc._id,
      object: 'ledger_entry',
      network: doc.network,
      side: doc.side,
      account: doc.account,
      payout: doc.payoutId,
      amount: doc.amount,
      currency: doc.currency,
      tx_signature: doc.txSignature,
      description: doc.description,
      created: Math.floor(new Date(doc.createdAt).getTime() / 1000),
    };
  }
}
