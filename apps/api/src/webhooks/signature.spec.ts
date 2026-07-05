import { signPayload, verifySignature } from './signature';

describe('webhook signature', () => {
  const secret = 'whsec_test';
  const payload = JSON.stringify({ id: 'evt_1', type: 'payout.paid' });

  it('verifies a freshly signed payload', () => {
    const header = signPayload(payload, secret);
    expect(verifySignature(payload, header, secret)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const header = signPayload(payload, secret);
    expect(verifySignature(payload + 'x', header, secret)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const header = signPayload(payload, secret);
    expect(verifySignature(payload, header, 'whsec_wrong')).toBe(false);
  });

  it('rejects an expired timestamp', () => {
    const old = Math.floor(Date.now() / 1000) - 10_000;
    const header = signPayload(payload, secret, old);
    expect(verifySignature(payload, header, secret, 300)).toBe(false);
  });
});
