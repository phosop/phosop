import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ApiKeyDocument = HydratedDocument<ApiKey>;

@Schema({ collection: 'apikeys', timestamps: true })
export class ApiKey {
  @Prop({ required: true, unique: true })
  hashedKey!: string;

  @Prop({ required: true })
  prefix!: string; // e.g. sk_p_test_abcd (first chars, for display)

  // 'devnet' for test keys, 'mainnet-beta' for live keys.
  @Prop({ required: true, enum: ['devnet', 'mainnet-beta'], default: 'devnet' })
  network!: string;

  @Prop()
  label?: string;

  @Prop({ default: false })
  revoked!: boolean;

  @Prop()
  lastUsedAt?: Date;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);
