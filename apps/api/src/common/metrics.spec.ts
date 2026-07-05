import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('increments counters (default and custom step)', () => {
    const m = new MetricsService();
    m.inc('payouts_paid_total');
    m.inc('payouts_paid_total', 2);
    expect(m.snapshot().counters.payouts_paid_total).toBe(3);
  });

  it('renders prometheus text for counters and gauges', () => {
    const m = new MetricsService();
    m.inc('http_requests_total');
    m.gauge('usdc_balance', 42);
    const out = m.render();
    expect(out).toContain('phosop_http_requests_total 1');
    expect(out).toContain('phosop_usdc_balance 42');
  });
});
