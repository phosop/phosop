import { encryptSecret, decryptSecret, isEncrypted, loadWalletSecret } from './secrets';

describe('wallet secret encryption', () => {
  const master = 'test-master-key-please-change';
  const plaintext = '4xEXAMPLEbase58secretvalue';

  it('round-trips encrypt -> decrypt', () => {
    const enc = encryptSecret(plaintext, master);
    expect(isEncrypted(enc)).toBe(true);
    expect(enc.startsWith('enc.v1:')).toBe(true);
    expect(decryptSecret(enc, master)).toBe(plaintext);
  });

  it('fails to decrypt with the wrong master key', () => {
    const enc = encryptSecret(plaintext, master);
    expect(() => decryptSecret(enc, 'wrong-key')).toThrow();
  });

  it('loadWalletSecret decrypts an encrypted env value', () => {
    process.env.WALLET_MASTER_KEY = master;
    process.env.TEST_SECRET = encryptSecret(plaintext, master);
    expect(loadWalletSecret('TEST_SECRET')).toBe(plaintext);
  });

  it('loadWalletSecret returns plaintext in non-production', () => {
    process.env.NODE_ENV = 'development';
    process.env.TEST_PLAIN = plaintext;
    expect(loadWalletSecret('TEST_PLAIN')).toBe(plaintext);
  });

  it('loadWalletSecret rejects plaintext in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_PLAINTEXT_SECRETS = 'false';
    process.env.TEST_PLAIN2 = plaintext;
    expect(() => loadWalletSecret('TEST_PLAIN2')).toThrow();
    process.env.NODE_ENV = 'development';
  });
});
