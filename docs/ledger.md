# Ledger (double-entry)

Phosop keeps an **append-only, double-entry ledger** as the immutable source of
truth for money movement. It is separate from the `payouts` collection (which
tracks operational status) and exists for **reconciliation, accounting, and
dispute resolution**.

## How it works

Every time a payout is **confirmed on-chain** (either on the create path or via
reconciliation), Phosop writes a balanced pair of entries:

| side | account | meaning |
|------|---------|---------|
| `debit` | `platform` | USDC left the platform wallet |
| `credit` | `acct_...` (seller) | USDC arrived at the seller |

Both entries share the same `payoutId`, `amount` (smallest units, string /
BigInt-safe), `currency`, and `txSignature`.

### Guarantees

- **Append-only** — entries are never updated or deleted (`updatedAt` disabled).
- **Idempotent** — recording is keyed by `payoutId`, so create + reconcile can
  both call it without producing duplicates.
- **Balanced** — for any period, `sum(debit) == sum(credit)`.

## API

```
GET /v1/ledger?limit=20&starting_after=le_...
Authorization: Bearer sk_p_test_...   # network is derived from the key
```

Returns entries newest-first with cursor pagination (`has_more`,
`starting_after`).

## Reconciliation

`LedgerService.platformOutflow(network)` sums all platform debits — compare it
against the actual on-chain drop in the platform wallet to detect drift. A
mismatch means a payout moved funds without a ledger entry (or vice versa) and
should be investigated.
