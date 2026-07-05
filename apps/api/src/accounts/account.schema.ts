import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomBytes } from 'crypto';

export type AccountDocument = HydratedDocument<Account>;

export function genAccountId(): string {
  return `acct_${randomBytes(12).toString('hex')}`;
}

@Schema({ collection: 'accounts', timestamps: true })
export class Account {
  @Prop({ required: true, unique: true, default: genAccountId })
  _id!: string;

  @Prop()
  email?: string;

  @Prop()
  country?: string;

  @Prop({ default: 'express' })
  type!: string;

  // A Solana address is valid on any network, so accounts are network-agnostic.
  @Prop()
  walletAddress?: string;

  @Prop({ default: 'pending', enum: ['pending', 'active', 'disabled'] })
  status!: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, string>;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
