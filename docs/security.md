# Security — hot wallet & secrets

Phosop moves real USDC, so wallet-secret handling is the single most important
thing to get right. This document explains what the code does and what YOU must
add for production.

## Threat model

The platform wallet (holds USDC) and the fee-payer wallet (holds SOL for gas)
are **hot wallets** — their private keys live on the server to sign payouts.
If those keys leak, funds are gone. There is no chargeback on Solana.

## What Phosop provides out of the box

### 1. Encrypted secrets at rest
Wallet secrets in `.env` may be stored **encrypted** instead of plaintext:

```
DEVNET_PLATFORM_WALLET_SECRET=enc.v1:BASE64...
```

- Algorithm: AES-256-GCM, key derived (SHA-256) from `WALLET_MASTER_KEY`.
- Encrypt a secret:
  ```bash
  WALLET_MASTER_KEY=... pnpm --filter @phosop/api encrypt-secret "<base58-secret>"
  ```
- On boot, `loadWalletSecret()` transparently decrypts `enc.v1:` values.
- In `NODE_ENV=production`, plaintext secrets are **rejected** unless you set
  `ALLOW_PLAINTEXT_SECRETS=true` (not recommended).

### 2. Master key stays out of the repo
`WALLET_MASTER_KEY` should be injected at runtime from a real secrets manager
(AWS Secrets Manager, GCP Secret Manager, Vault, Doppler, etc.), never committed.

## What you must add for production (not in scope of this OSS scaffold)

1. **KMS / HSM signing.** Ideally the private key never exists in process memory.
   Use AWS KMS, GCP KMS, or an HSM and replace the `Keypair`-based signer with a
   KMS signing call. The `loadWalletSecret` boundary is where you plug this in.
2. **Hot/cold split.** Keep only a small operating balance in the hot platform
   wallet; sweep the rest to cold storage. Top up the hot wallet on a schedule.
3. **Multisig / policy engine** (e.g. Squads) for large or unusual payouts, with
   per-day and per-payout limits enforced server-side (`MAX_PAYOUT_UNITS` is a
   starting point, not a full policy engine).
4. **Key rotation** runbook for both wallet keys and `WALLET_MASTER_KEY`.
5. **Network isolation.** Run signing in a locked-down service/subnet with no
   inbound internet and audited egress.

## Related safety features (see code)

- Production startup rejects empty or placeholder `API_KEY_PEPPER`,
  `ADMIN_API_SECRET`, `WEBHOOK_SIGNING_SECRET`, enabled network wallet secrets,
  and metrics tokens.
- Webhook endpoints are validated before registration. Production webhooks must
  use HTTPS, private/localhost hosts are blocked, DNS is checked for private
  addresses, and deliveries have a timeout. For local webhook tunneling during
  development only, set `ALLOW_PRIVATE_WEBHOOK_URLS=true`.
- `/v1/metrics` is token-protected in production unless explicitly made public.
- Payouts are never marked `failed` after broadcast — see `SolanaService.sendPayout`
  and `ConfirmTimeoutError`; reconciliation verifies on-chain by signature.
- Idempotency is **required** on payout endpoints and backed by a DB lock, so
  concurrent/retried requests cannot double-send.
- Amounts use BigInt/string end to end (no float precision loss).
- Pre-flight balance check before every send.
