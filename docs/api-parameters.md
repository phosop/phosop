# Phosop API parameters

Base URL: `/v1`. Auth: `Authorization: Bearer sk_p_test_...` (devnet) or
`sk_p_live_...` (mainnet-beta). The network is decided by the key.

## Conventions
- **Amounts** are in USDC smallest units (6 decimals). 1 USDC = `1000000`.
  Amounts are strings/BigInt end to end — send `"10000000"` (or a number) and
  responses return `amount` as a **string** to avoid precision loss.
- Errors: `{ "error": { "type", "code", "message" } }`.
- **Idempotency-Key header is REQUIRED** on `POST /v1/payouts` and
  `POST /v1/payouts/batch`. Reuse the same key to safely retry.

## Accounts

### POST /v1/accounts
| param | type | required | notes |
|-------|------|----------|-------|
| `email` | string | no | seller email |
| `country` | string | no | ISO country code |
| `type` | string | no | defaults to `express` |
| `metadata` | object | no | string->string key/values |

- `POST /v1/accounts/:id/wallet` — body `{ walletAddress }` (validated as a real Solana address).
- `GET /v1/accounts/:id`

## Payouts

### POST /v1/payouts  (requires Idempotency-Key)
| param | type | required | notes |
|-------|------|----------|-------|
| `amount` | string \| number | yes | smallest units; `MIN_PAYOUT_UNITS`..`MAX_PAYOUT_UNITS` |
| `destination` | string | yes | `acct_...` with an attached wallet |
| `currency` | string | no | must be in `SUPPORTED_CURRENCIES` (default `usdc`) |
| `description` | string | no | free text |
| `metadata` | object | no | string->string key/values |

### POST /v1/payouts/batch  (requires Idempotency-Key)
| param | type | required | notes |
|-------|------|----------|-------|
| `payouts` | array | yes | each item = a payout body above; max `MAX_BATCH_SIZE` |

### GET /v1/payouts
| query | type | notes |
|-------|------|-------|
| `limit` | number | 1..100, default 20 |
| `starting_after` | string | payout id cursor for pagination |

### GET /v1/payouts/:id
Returns a single payout scoped to the key's network.

**Payout status**: `pending` -> `paid` | `failed`. A broadcast-but-unconfirmed
payout stays `pending` (never auto-`failed`) and is finalized by reconciliation.

## Balance

### GET /v1/balance
Returns `{ network, usdc_available, fee_payer_sol }` for the key's network.

## Webhook endpoints

### POST /v1/webhook_endpoints
| param | type | required | notes |
|-------|------|----------|-------|
| `url` | string | yes | https endpoint |
| `enabled_events` | string[] | no | defaults to all event types |

Events: `payout.paid`, `payout.failed`, `transfer.created`, `account.updated`.
Signature header: `Phosop-Signature: t=<unix>,v1=<hmac-sha256>`.

## Config (public)

### GET /v1/config
Returns which networks are enabled: `{ networks, devnet_enabled, mainnet_enabled }`.

## Error codes (selected)
| code | meaning |
|------|---------|
| `idempotency_key_required` | missing Idempotency-Key on a payout endpoint |
| `request_in_progress` | same Idempotency-Key still processing (409) |
| `idempotency_key_in_use` | key reused with a different body |
| `amount_invalid` / `amount_out_of_range` | bad amount |
| `currency_unsupported` | currency not in allowlist |
| `invalid_wallet_address` | destination/wallet not a valid Solana address |
| `insufficient_funds` | platform USDC balance too low (pre-flight) |
| `batch_empty` / `batch_too_large` | batch size problems |
| `network_not_enabled` | key's network disabled on this server |
| `transfer_failed` | on-chain send failed before broadcast |
