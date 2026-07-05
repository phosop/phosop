import { validateRuntimeConfig } from './env';

const ORIGINAL_ENV = process.env;

describe('validateRuntimeConfig', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('rejects placeholder secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEVNET = 'false';
    process.env.ENABLE_MAINNET = 'false';
    process.env.API_KEY_PEPPER = 'change-me-to-a-long-random-string';
    process.env.ADMIN_API_SECRET = 'a'.repeat(32);
    process.env.WEBHOOK_SIGNING_SECRET = 'b'.repeat(32);
    process.env.METRICS_TOKEN = 'c'.repeat(32);

    expect(() => validateRuntimeConfig()).toThrow(/API_KEY_PEPPER/);
  });

  it('requires a metrics token in production unless metrics are explicitly public', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEVNET = 'false';
    process.env.ENABLE_MAINNET = 'false';
    process.env.API_KEY_PEPPER = 'a'.repeat(32);
    process.env.ADMIN_API_SECRET = 'b'.repeat(32);
    process.env.WEBHOOK_SIGNING_SECRET = 'c'.repeat(32);
    process.env.METRICS_PUBLIC = 'false';
    delete process.env.METRICS_TOKEN;

    expect(() => validateRuntimeConfig()).toThrow(/METRICS_TOKEN/);
  });
});
