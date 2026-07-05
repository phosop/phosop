import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Wallet secret loader with at-rest encryption support.
 *
 * A secret can be stored in the environment in two forms:
 *   1. Plaintext base58 (dev only) — e.g. DEVNET_PLATFORM_WALLET_SECRET=4xE...
 *   2. Encrypted        (recommended) — e.g. ...=enc.v1:<base64>
 *
 * Encrypted secrets use AES-256-GCM with a key derived from WALLET_MASTER_KEY.
 * The master key itself should come from a real secrets manager / KMS in
 * production (see docs/security.md), never committed to the repo.
 */

const PREFIX = 'enc.v1:';

function keyFrom(masterKey: string): Buffer {
  return createHash('sha256').update(masterKey).digest();
}

/** Encrypts plaintext -> "enc.v1:<base64(iv|tag|ciphertext)>". */
export function encryptSecret(plaintext: string, masterKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(masterKey), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

/** Decrypts an "enc.v1:..." payload back to plaintext. */
export function decryptSecret(payload: string, masterKey: string): string {
  const raw = payload.startsWith(PREFIX) ? payload.slice(PREFIX.length) : payload;
  const buf = Buffer.from(raw, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(masterKey), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Resolves a wallet secret from an env var name, transparently decrypting if
 * it is stored encrypted. Refuses plaintext secrets in production unless the
 * operator explicitly opts in via ALLOW_PLAINTEXT_SECRETS=true.
 */
export function loadWalletSecret(envName: string): string | undefined {
  const raw = process.env[envName];
  if (!raw) return undefined;

  if (!isEncrypted(raw)) {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_PLAINTEXT_SECRETS !== 'true'
    ) {
      throw new Error(
        `${envName} is a plaintext secret in production. Encrypt it (enc.v1:...) ` +
          `with scripts/encrypt-secret, or set ALLOW_PLAINTEXT_SECRETS=true (not recommended).`,
      );
    }
    return raw;
  }

  const masterKey = process.env.WALLET_MASTER_KEY;
  if (!masterKey) {
    throw new Error(`${envName} is encrypted but WALLET_MASTER_KEY is not set.`);
  }
  return decryptSecret(raw, masterKey);
}
