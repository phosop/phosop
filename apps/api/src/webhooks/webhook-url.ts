import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { PhosopError } from '../common/errors';

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  );
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '');
}

function privateWebhookUrlsAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_PRIVATE_WEBHOOK_URLS === 'true';
}

function isBlockedIp(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) === 6) return isPrivateIpv6(normalized);
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized === 'metadata.google.internal'
  ) {
    return true;
  }
  if (isBlockedIp(normalized)) return true;
  return false;
}

export async function normalizeWebhookUrl(rawUrl: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw PhosopError.invalidRequest('invalid_webhook_url', 'Webhook URL must be a valid HTTP(S) URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw PhosopError.invalidRequest('invalid_webhook_url', 'Webhook URL must use HTTP or HTTPS');
  }

  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw PhosopError.invalidRequest('invalid_webhook_url', 'Webhook URL must use HTTPS in production');
  }

  if (!privateWebhookUrlsAllowed() && isBlockedHostname(parsed.hostname)) {
    throw PhosopError.invalidRequest('invalid_webhook_url', 'Webhook URL host is not allowed');
  }

  if (!privateWebhookUrlsAllowed() && isIP(normalizeHostname(parsed.hostname)) === 0) {
    let addresses: { address: string }[];
    try {
      addresses = await lookup(parsed.hostname, { all: true });
    } catch {
      throw PhosopError.invalidRequest('invalid_webhook_url', 'Webhook URL host could not be resolved');
    }
    if (addresses.some((item) => isBlockedIp(item.address))) {
      throw PhosopError.invalidRequest('invalid_webhook_url', 'Webhook URL resolves to a private address');
    }
  }

  parsed.hash = '';
  return parsed.toString();
}
