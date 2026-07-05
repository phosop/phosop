import { Injectable, Logger } from '@nestjs/common';

export type AlertLevel = 'info' | 'warning' | 'critical';

export interface Notifier {
  send(level: AlertLevel, title: string, detail?: string): Promise<void>;
}

/** Default when no channel is configured: alerts are logged only. */
class NoopNotifier implements Notifier {
  async send(): Promise<void> {
    /* no-op */
  }
}

/** Posts to a Slack (or Slack-compatible) incoming webhook URL. */
class SlackNotifier implements Notifier {
  constructor(private readonly webhookUrl: string) {}

  async send(level: AlertLevel, title: string, detail?: string): Promise<void> {
    const emoji =
      level === 'critical' ? ':rotating_light:' : level === 'warning' ? ':warning:' : ':information_source:';
    const text = `${emoji} *[phosop:${level}]* ${title}${detail ? `\n${detail}` : ''}`;
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  }
}

/**
 * Central alerting. Always logs; forwards to a Notifier (Slack today, easy to
 * swap for PagerDuty/email) when SLACK_WEBHOOK_URL is set. De-dupes by `key`
 * within ALERT_MIN_INTERVAL_SECONDS so a recurring condition (e.g. low balance
 * checked every 5 min) does not spam the channel.
 */
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly notifier: Notifier;
  private readonly minIntervalMs: number;
  private readonly lastSent = new Map<string, number>();

  constructor() {
    const url = process.env.SLACK_WEBHOOK_URL;
    this.notifier = url ? new SlackNotifier(url) : new NoopNotifier();
    this.minIntervalMs = Number(process.env.ALERT_MIN_INTERVAL_SECONDS || 300) * 1000;
  }

  async alert(level: AlertLevel, key: string, title: string, detail?: string): Promise<void> {
    const line = `${title}${detail ? ` — ${detail}` : ''}`;
    if (level === 'critical') this.logger.error(line);
    else this.logger.warn(line);

    const now = Date.now();
    const last = this.lastSent.get(key) ?? 0;
    if (now - last < this.minIntervalMs) return; // throttled
    this.lastSent.set(key, now);

    try {
      await this.notifier.send(level, title, detail);
    } catch (e) {
      this.logger.warn(`alert notifier failed: ${(e as Error).message}`);
    }
  }
}
