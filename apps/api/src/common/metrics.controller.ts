import { Controller, Get, Header, Headers } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { PhosopError } from './errors';
import { MetricsService } from './metrics.service';

/**
 * Prometheus scrape endpoint. Public in local development, token-protected by
 * default in production because balances and failure counters are operationally
 * sensitive.
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  get(@Headers('authorization') authorization?: string, @Headers('x-metrics-token') token?: string): string {
    this.assertCanReadMetrics(authorization, token);
    return this.metrics.render();
  }

  private assertCanReadMetrics(authorization?: string, token?: string): void {
    if (process.env.METRICS_PUBLIC === 'true') return;
    if (process.env.NODE_ENV !== 'production' && process.env.METRICS_PUBLIC !== 'false') return;

    const expected = process.env.METRICS_TOKEN || '';
    if (!expected) {
      throw PhosopError.invalidRequest('metrics_not_configured', 'METRICS_TOKEN is not set');
    }

    const provided = authorization?.match(/^Bearer\s+(.+)$/)?.[1] ?? token ?? '';
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw PhosopError.auth('Invalid metrics token');
    }
  }
}
