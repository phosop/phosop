/**
 * Encrypts a wallet secret for at-rest storage in .env.
 *
 * Usage:
 *   WALLET_MASTER_KEY=... ts-node scripts/encrypt-secret.ts "<base58-secret>"
 *   (or via package script: pnpm --filter @phosop/api encrypt-secret "<secret>")
 *
 * Paste the printed "enc.v1:..." value into DEVNET_/MAINNET_*_WALLET_SECRET.
 */
import { encryptSecret } from '../src/common/secrets';

const secret = process.argv[2];
const masterKey = process.env.WALLET_MASTER_KEY;

if (!secret) {
  console.error('Usage: encrypt-secret "<plaintext-secret>"  (set WALLET_MASTER_KEY env)');
  process.exit(1);
}
if (!masterKey) {
  console.error('WALLET_MASTER_KEY env is required.');
  process.exit(1);
}

console.log(encryptSecret(secret, masterKey));
