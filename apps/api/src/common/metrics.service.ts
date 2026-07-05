import { Injectable } from '@nestjs/common';

/**
 * Tiny in-process metrics registry (counters + gauges), exposed at
 * GET /v1/metrics in Prometheus text format. This is per-instance; for a
 * multi-instance deployment, scrape each instance or push to a real
 * Prometheus/OpenTelemetry pipeline.
 */
@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();

  inc(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  gauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /** Prometheus text exposition format. */
  render(): string {
    const lines: string[] = [];
    for (const [k, v] of this.counters) lines.push(`phosop_${k} ${v}`);
    for (const [k, v] of this.gauges) lines.push(`phosop_${k} ${v}`);
    return lines.join('\n') + '\n';
  }

  snapshot(): { counters: Record<string, number>; gauges: Record<string, number> } {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
    };
  }
}
