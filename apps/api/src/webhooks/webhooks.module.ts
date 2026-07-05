import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhookEndpoint, WebhookEndpointSchema } from './webhook-endpoint.schema';
import { WebhookDelivery, WebhookDeliverySchema } from './webhook-delivery.schema';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebhookEndpoint.name, schema: WebhookEndpointSchema },
      { name: WebhookDelivery.name, schema: WebhookDeliverySchema },
    ]),
  ],
  providers: [WebhooksService],
  controllers: [WebhooksController],
  exports: [WebhooksService],
})
export class WebhooksModule {}
