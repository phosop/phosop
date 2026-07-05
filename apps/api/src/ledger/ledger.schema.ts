import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomBytes } from 'crypto';

export type LedgerEntryDocument = HydratedDocument<LedgerEntry>;

export function genLedgerId(): string {
  return `le_${randomBytes(12).toString('hex')}`;
}

/**
 * Append-only double-entry ledger. Every confirmed payout writes a balanced
 * pair: a DEBIT on the 'platform' account (USDC leaves) and a CREDIT on the
 * seller account (USDC arrives). Entries are never updated or deleted — the
 * ledger is the immutable source of truth for reconciliation and disputes.
 */
@Schema({ collection: 'ledger_entries', timestamps: { createdAt: true, updatedAt: false } })
export class LedgerEntry {
  @Prop({ required: true, unique: true, default: genLedgerId })
  _id!: string;

  @Prop({ required: true, enum: ['devnet', 'mainnet-beta'] })
  network!: string;

  // Accounting side.
  @Prop({ required: true, enum: ['debit', 'credit'] })
  side!: string;

  // Logical account: 'platform' or a seller account id (acct_...).
  @Prop({ required: true })
  account!: string;

  @Prop({ required: true })
  payoutId!: string;

  // Smallest units as string (BigInt-safe). Always positive; `side` gives direction.
  @Prop({ required: true })
  amount!: string;

  @Prop({ default: 'usdc' })
  currency!: string;

  @Prop()
  txSignature?: string;

  @Prop()
  description?: string;
}

export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);
LedgerEntrySchema.index({ network: 1, createdAt: -1 });
LedgerEntrySchema.index({ account: 1, createdAt: -1 });
// Unique per (payoutId, side) so create + reconcile can never double-write the
// same balanced pair, even under a race. recordPayout() swallows the resulting
// duplicate-key error, making ledger writes truly idempotent.
LedgerEntrySchema.index({ payoutId: 1, side: 1 }, { unique: true });
