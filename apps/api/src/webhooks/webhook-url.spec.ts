import { normalizeWebhookUrl } from './webhook-url';

const ORIGINAL_ENV = process.env;

describe('normalizeWebhookUrl', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('requires HTTPS in production', async () => {
    process.env.NODE_ENV = 'production';
    await expect(normalizeWebhookUrl('http://example.com/hook')).rejects.toMatchObject({
      response: { error: { message: expect.stringMatching(/HTTPS/) } },
    });
  });

  it('blocks localhost/private hosts by default', async () => {
    process.env.NODE_ENV = 'production';
    await expect(normalizeWebhookUrl('https://127.0.0.1/hook')).rejects.toMatchObject({
      response: { error: { message: expect.stringMatching(/not allowed/) } },
    });
  });

  it('allows private webhook URLs only when explicitly enabled in development', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_PRIVATE_WEBHOOK_URLS = 'true';
    await expect(normalizeWebhookUrl('http://localhost:3000/hook#secret')).resolves.toBe(
      'http://localhost:3000/hook',
    );
  });
});
