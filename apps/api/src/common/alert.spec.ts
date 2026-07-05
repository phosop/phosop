import { AlertService } from './alert.service';

describe('AlertService', () => {
  beforeEach(() => {
    delete process.env.SLACK_WEBHOOK_URL;
    process.env.ALERT_MIN_INTERVAL_SECONDS = '3600';
  });

  it('throttles repeated alerts with the same key', async () => {
    const svc = new AlertService();
    const spy = jest.spyOn((svc as any).notifier, 'send');
    await svc.alert('warning', 'k1', 'first');
    await svc.alert('warning', 'k1', 'second');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('allows alerts with different keys', async () => {
    const svc = new AlertService();
    const spy = jest.spyOn((svc as any).notifier, 'send');
    await svc.alert('warning', 'a', 'x');
    await svc.alert('critical', 'b', 'y');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
