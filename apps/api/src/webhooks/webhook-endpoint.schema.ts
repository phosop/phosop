import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomBytes } from 'crypto';

export type WebhookEndpointDocument = HydratedDocument<WebhookEndpoint>;

export function genEndpointId(): string {
  return `we_${randomBytes(12).toString('hex')}`;
}

@Schema({ collection: 'webhook_endpoints', timestamps: true })
export class WebhookEndpoint {
  @Prop({ required: true, unique: true, default: genEndpointId })
  _id!: string;

  @Prop({ required: true })
  url!: string;

  @Prop({ type: [String], default: ['*'] })
  enabledEvents!: string[];

  @Prop({ default: true })
  active!: boolean;
}

export const WebhookEndpointSchema = SchemaFactory.createForClass(WebhookEndpoint);
