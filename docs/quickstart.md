# Phosop Quickstart

## 1. Prerequisites
- Node 22+, pnpm 11+
- Docker (for MongoDB) or a MongoDB URI
- Per network you enable, two Solana wallets (base58 secret keys):
  - **Platform wallet** — holds and sends USDC
  - **Fee-payer wallet** — pays gas + ATA rent (needs some SOL)

Start with **devnet only** — it's free and safe.

## 2. Install & configure
```bash
pnpm install
cp .env.example .env
```
Edit `.env`:
- Keep `ENABLE_DEVNET=true`, `ENABLE_MAINNET=false` for now.
- Fill `DEVNET_PLATFORM_WALLET_SECRET` and `DEVNET_FEE_PAYER_WALLET_SECRET`.
- Fund those devnet wallets: https://faucet.solana.com
- Set strong `API_KEY_PEPPER`, `ADMIN_API_SECRET`, `WEBHOOK_SIGNING_SECRET`.
- Keep `METRICS_PUBLIC=false` for production and set a strong `METRICS_TOKEN`.

## 3. Run
```bash
docker compose up -d mongo
pnpm --filter @phosop/shared build
pnpm --filter @phosop/api dev
```
API on `http://localhost:3333`. Verify networks: `curl http://localhost:3333/v1/config`.

## 4. Create an API key (admin)
Test key => devnet. Live key => mainnet.
```bash
curl -X POST http://localhost:3333/v1/admin/api_keys \
  -H "X-Admin-Secret: $ADMIN_API_SECRET" -H 'Content-Type: application/json' \
  -d '{"label":"my-devnet-key","mode":"test"}'
# => { "api_key": "sk_p_test_...", "network": "devnet" }  (shown once)
```

## 5. Onboard a seller & pay out (devnet)
```bash
KEY=sk_p_test_...

curl -X POST http://localhost:3333/v1/accounts \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"email":"seller@example.com"}'

curl -X POST http://localhost:3333/v1/accounts/acct_xxx/wallet \
  -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"walletAddress":"<seller_solana_address>"}'

# pay out 10 USDC (smallest units, 6 decimals => 10_000000)
curl -X POST http://localhost:3333/v1/payouts \
  -H "Authorization: Bearer $KEY" -H 'Idempotency-Key: unique-123' -H 'Content-Type: application/json' \
  -d '{"amount":10000000,"currency":"usdc","destination":"acct_xxx"}'
# response includes "network": "devnet"
```

## 6. SDK
```ts
import { Phosop } from '@phosop/node';
const phosop = new Phosop('sk_p_test_...', { baseUrl: 'http://localhost:3333' });
await phosop.payouts.create({ amount: 10000000, currency: 'usdc', destination: 'acct_xxx' });
```

## 7. Go to mainnet (when confident)
1. Set `ENABLE_MAINNET=true` and fill the `MAINNET_*` wallet/RPC vars (use a real RPC like Helius).
2. Restart the API.
3. Create a **live** key: `-d '{"mode":"live"}'` => `sk_p_live_...`.
4. Repeat step 5 with the live key and small amounts first. Mainnet USDC transfers are irreversible.
