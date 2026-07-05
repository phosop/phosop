import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Stripe-style signature: `t=<unix>,v1=<hex>` where
 * hex = HMAC_SHA256(secret, `${t}.${payload}`).
 */
export function signPayload(payload: string, secret: string, timestamp?: number): string {
  const t = timestamp ?? Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

export function verifySignature(
  payload: string,
  header: string,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((kv) => kv.split('=') as [string, string]),
  );
  const t = Number(parts['t']);
  const v1 = parts['v1'];
  if (!t || !v1) return false;
  if (toleranceSeconds > 0 && Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSeconds) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
