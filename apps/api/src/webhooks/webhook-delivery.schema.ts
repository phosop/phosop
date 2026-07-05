import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomBytes } from 'crypto';

export type WebhookDeliveryDocument = HydratedDocument<WebhookDelivery>;

export function genDeliveryId(): string {
  return `whd_${randomBytes(12).toString('hex')}`;
}

export function genEventId(): string {
  return `evt_${randomBytes(12).toString('hex')}`;
}

@Schema({ collection: 'webhook_deliveries', timestamps: true })
export class WebhookDelivery {
  @Prop({ required: true, unique: true, default: genDeliveryId })
  _id!: string;

  @Prop({ required: true })
  endpointId!: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ required: true })
  eventId!: string;

  @Prop({ required: true })
  eventType!: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  @Prop({ default: 'pending', enum: ['pending', 'delivered', 'failed', 'dead'] })
  status!: string;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop()
  nextAttemptAt?: Date;

  @Prop()
  lastError?: string;
}

export const WebhookDeliverySchema = SchemaFactory.createForClass(WebhookDelivery);
