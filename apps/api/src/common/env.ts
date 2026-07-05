const PLACEHOLDER_FRAGMENTS = ['change-me', 'YOUR_KEY', 'whsec_change_me', 'whsec_dev'];

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function isEnabled(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function hasPlaceholder(value: string): boolean {
  return PLACEHOLDER_FRAGMENTS.some((fragment) => value.includes(fragment));
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  if (hasPlaceholder(value)) throw new Error(`${name} still contains a placeholder value`);
  return value;
}

function requireStrongSecret(name: string): void {
  const value = requireEnv(name);
  if (value.length < 32) {
    throw new Error(`${name} must be at least 32 characters in production`);
  }
}

function validateEnabledNetwork(prefix: 'DEVNET' | 'MAINNET'): void {
  requireEnv(`${prefix}_RPC_URL`);
  requireEnv(`${prefix}_USDC_MINT`);
  requireEnv(`${prefix}_PLATFORM_WALLET_SECRET`);
  requireEnv(`${prefix}_FEE_PAYER_WALLET_SECRET`);
}

export function validateRuntimeConfig(): void {
  if (isEnabled(process.env.ENABLE_DEVNET, true)) validateEnabledNetwork('DEVNET');
  if (isEnabled(process.env.ENABLE_MAINNET)) validateEnabledNetwork('MAINNET');

  if (!isProduction()) return;

  requireStrongSecret('API_KEY_PEPPER');
  requireStrongSecret('ADMIN_API_SECRET');
  requireStrongSecret('WEBHOOK_SIGNING_SECRET');

  if (process.env.METRICS_PUBLIC !== 'true') {
    requireStrongSecret('METRICS_TOKEN');
  }
}

export function corsOptions() {
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origin =
    configuredOrigins.length > 0
      ? configuredOrigins
      : isProduction()
        ? false
        : [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];

  return {
    origin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Idempotency-Key',
      'X-Admin-Secret',
      'X-Metrics-Token',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
  };
}
