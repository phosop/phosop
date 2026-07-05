import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomBytes } from 'crypto';

export type PayoutDocument = HydratedDocument<Payout>;

export function genPayoutId(): string {
  return `po_${randomBytes(12).toString('hex')}`;
}

@Schema({ collection: 'payouts', timestamps: true })
export class Payout {
  @Prop({ required: true, unique: true, default: genPayoutId })
  _id!: string;

  @Prop({ required: true })
  account!: string;

  // Smallest units, stored as STRING to preserve full precision (BigInt-safe).
  @Prop({ required: true })
  amount!: string;

  @Prop({ default: 'usdc' })
  currency!: string;

  // Which network this payout ran on (from the API key: test=>devnet, live=>mainnet-beta).
  @Prop({ required: true, enum: ['devnet', 'mainnet-beta'] })
  network!: string;

  @Prop({ default: 'pending', enum: ['pending', 'paid', 'failed'] })
  status!: string;

  @Prop()
  description?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, string>;

  @Prop()
  txSignature?: string;

  @Prop()
  error?: string;
}

export const PayoutSchema = SchemaFactory.createForClass(Payout);

// Query index for reconciliation and network-scoped listing.
PayoutSchema.index({ status: 1, createdAt: 1 });
PayoutSchema.index({ network: 1, createdAt: -1 });
