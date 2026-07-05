import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies a Phosop webhook signature header (`Phosop-Signature`).
 * Header format: `t=<unix>,v1=<hex>` where hex = HMAC_SHA256(secret, `${t}.${rawBody}`).
 */
export function verifyWebhookSignature(
  rawBody: string,
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
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
