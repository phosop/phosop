import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WebhookEndpoint } from './webhook-endpoint.schema';
import { WebhookDelivery, genEventId } from './webhook-delivery.schema';
import { signPayload } from './signature';
import { normalizeWebhookUrl } from './webhook-url';
import { AlertService } from '../common/alert.service';

// Retry backoff in seconds; index = attempt number. After the last, mark dead.
const BACKOFF = [0, 30, 120, 600, 3600, 21600];
const MAX_ATTEMPTS = BACKOFF.length;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectModel(WebhookEndpoint.name) private readonly endpoints: Model<WebhookEndpoint>,
    @InjectModel(WebhookDelivery.name) private readonly deliveries: Model<WebhookDelivery>,
    private readonly alerts: AlertService,
  ) {}

  async registerEndpoint(url: string, enabledEvents?: string[]) {
    const doc = await this.endpoints.create({
      url: await normalizeWebhookUrl(url),
      enabledEvents: enabledEvents?.length ? enabledEvents : ['*'],
    });
    return this.serialize(doc);
  }

  async listEndpoints() {
    const docs = await this.endpoints.find({ active: true }).sort({ createdAt: -1 });
    return docs.map((d) => this.serialize(d));
  }

  private serialize(doc: any) {
    return {
      id: doc._id,
      object: 'webhook_endpoint',
      url: doc.url,
      enabled_events: doc.enabledEvents,
      active: doc.active,
      created: Math.floor(new Date(doc.createdAt).getTime() / 1000),
    };
  }

  /** Emits an event to all matching endpoints and attempts immediate delivery. */
  async emit(type: string, data: Record<string, unknown>) {
    const event = {
      id: genEventId(),
      object: 'event',
      type,
      data,
      created: Math.floor(Date.now() / 1000),
    };
    const endpoints = await this.endpoints.find({ active: true });
    for (const ep of endpoints) {
      if (!ep.enabledEvents.includes('*') && !ep.enabledEvents.includes(type)) continue;
      const delivery = await this.deliveries.create({
        endpointId: ep._id,
        url: ep.url,
        eventId: event.id,
        eventType: type,
        payload: event,
        status: 'pending',
        nextAttemptAt: new Date(),
      });
      this.attemptDelivery(delivery._id).catch((e) =>
        this.logger.warn(`delivery ${delivery._id} failed: ${e.message}`),
      );
    }
    return event;
  }

  async attemptDelivery(deliveryId: string) {
    const d = await this.deliveries.findById(deliveryId);
    if (!d || d.status === 'delivered' || d.status === 'dead') return;

    const body = JSON.stringify(d.payload);
    const secret = this.webhookSecret();
    const signature = signPayload(body, secret);
    d.attempts += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.deliveryTimeoutMs());

    try {
      const res = await fetch(d.url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Phosop-Signature': signature,
          'Phosop-Event-Type': d.eventType,
        },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      d.status = 'delivered';
      d.nextAttemptAt = undefined;
    } catch (e) {
      d.lastError = (e as Error).name === 'AbortError' ? 'webhook delivery timed out' : (e as Error).message;
      if (d.attempts >= MAX_ATTEMPTS) {
        d.status = 'dead';
        d.nextAttemptAt = undefined;
        this.logger.error(`delivery ${d._id} dead-lettered after ${d.attempts} attempts`);
        await this.alerts.alert(
          'warning',
          `webhook-dead:${d.endpointId}`,
          'webhook dead-lettered',
          `delivery ${d._id} to ${d.url} after ${d.attempts} attempts (${d.lastError})`,
        );
      } else {
        d.status = 'failed';
        d.nextAttemptAt = new Date(Date.now() + BACKOFF[d.attempts] * 1000);
      }
    } finally {
      clearTimeout(timeout);
    }
    await d.save();
  }

  private webhookSecret(): string {
    const secret = process.env.WEBHOOK_SIGNING_SECRET || '';
    if (!secret || secret === 'whsec_dev' || secret === 'whsec_change_me') {
      throw new Error('WEBHOOK_SIGNING_SECRET is not configured');
    }
    return secret;
  }

  private deliveryTimeoutMs(): number {
    const parsed = process.env.WEBHOOK_TIMEOUT_MS ? Number(process.env.WEBHOOK_TIMEOUT_MS) : 10000;
    if (!Number.isFinite(parsed) || parsed < 1000) return 10000;
    return Math.min(parsed, 60000);
  }

  /** Called by the monitor cron to retry due deliveries. */
  async processRetries() {
    const due = await this.deliveries
      .find({ status: 'failed', nextAttemptAt: { $lte: new Date() } })
      .limit(50);
    for (const d of due) {
      await this.attemptDelivery(d._id);
    }
    return due.length;
  }
}
