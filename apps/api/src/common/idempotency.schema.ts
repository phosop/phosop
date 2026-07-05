import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IdempotencyDocument = HydratedDocument<IdempotencyKey>;

@Schema({ collection: 'idempotency_keys', timestamps: true })
export class IdempotencyKey {
  @Prop({ required: true, unique: true })
  key!: string;

  @Prop({ required: true })
  requestHash!: string;

  @Prop({ type: Object })
  responseSnapshot?: Record<string, unknown>;

  @Prop({ default: () => new Date(), expires: 86400 })
  createdAt!: Date;
}

export const IdempotencyKeySchema = SchemaFactory.createForClass(IdempotencyKey);
