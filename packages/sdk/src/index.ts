import type {
  PhosopAccount,
  PhosopPayout,
  PhosopWebhookEndpoint,
  PhosopConfig,
  PhosopBalance,
  PhosopList,
  PhosopNetwork,
  PhosopMetadata,
} from '@phosop/shared';

export interface PhosopOptions {
  baseUrl?: string; // e.g. http://localhost:3333
}

export interface CreatePayoutParams {
  amount: number | string | bigint; // smallest units
  destination: string; // acct_...
  currency?: string;
  description?: string;
  metadata?: PhosopMetadata;
  idempotencyKey?: string;
}

function newIdempotencyKey(): string {
  const g = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Minimal Stripe-shaped client for Phosop.
 *
 * The network is decided by your API key:
 *   sk_p_test_... => devnet, sk_p_live_... => mainnet-beta.
 *
 * Payout endpoints REQUIRE an Idempotency-Key. If you don't pass one, the SDK
 * generates a fresh UUID per call so a single call is never accidentally sent
 * twice. Reuse the SAME key when you retry a failed request.
 */
export class Phosop {
  private readonly baseUrl: string;

  constructor(private readonly apiKey: string, opts: PhosopOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? 'http://localhost:3333').replace(/\/$/, '');
  }

  /** Inferred network from the API key prefix (no network call). */
  get network(): PhosopNetwork {
    return this.apiKey.startsWith('sk_p_live_') ? 'mainnet-beta' : 'devnet';
  }

  private async request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const res = await fetch(`${this.baseUrl}/v1${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as any;
    if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    return json as T;
  }

  /** Which networks the server has enabled (public endpoint, no auth needed). */
  async config(): Promise<PhosopConfig> {
    const res = await fetch(`${this.baseUrl}/v1/config`);
    return (await res.json()) as PhosopConfig;
  }

  /** Operator balances for this key's network. */
  balance = {
    retrieve: () => this.request<PhosopBalance>('GET', '/balance'),
  };

  accounts = {
    create: (data: { email?: string; country?: string; type?: string; metadata?: PhosopMetadata }) =>
      this.request<PhosopAccount>('POST', '/accounts', data),
    retrieve: (id: string) => this.request<PhosopAccount>('GET', `/accounts/${id}`),
    attachWallet: (id: string, walletAddress: string) =>
      this.request<PhosopAccount>('POST', `/accounts/${id}/wallet`, { walletAddress }),
  };

  payouts = {
    create: (data: CreatePayoutParams) => {
      const { idempotencyKey, amount, ...rest } = data;
      const body = { ...rest, amount: String(amount) };
      return this.request<PhosopPayout>('POST', '/payouts', body, idempotencyKey ?? newIdempotencyKey());
    },
    createBatch: (
      payouts: Omit<CreatePayoutParams, 'idempotencyKey'>[],
      idempotencyKey?: string,
    ) => {
      const body = { payouts: payouts.map((p) => ({ ...p, amount: String(p.amount) })) };
      return this.request<PhosopList<PhosopPayout>>('POST', '/payouts/batch', body, idempotencyKey ?? newIdempotencyKey());
    },
    retrieve: (id: string) => this.request<PhosopPayout>('GET', `/payouts/${id}`),
    list: (params: { limit?: number; startingAfter?: string } = {}) => {
      const q = new URLSearchParams();
      if (params.limit) q.set('limit', String(params.limit));
      if (params.startingAfter) q.set('starting_after', params.startingAfter);
      const qs = q.toString();
      return this.request<PhosopList<PhosopPayout>>('GET', `/payouts${qs ? `?${qs}` : ''}`);
    },
  };

  webhookEndpoints = {
    create: (data: { url: string; enabled_events?: string[] }) =>
      this.request<PhosopWebhookEndpoint>('POST', '/webhook_endpoints', data),
    list: () => this.request<PhosopList<PhosopWebhookEndpoint>>('GET', '/webhook_endpoints'),
  };
}

export default Phosop;
export * from './webhooks';
export * from '@phosop/shared';
