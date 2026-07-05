# Contributing to Phosop

Thanks for your interest! Phosop is Apache-2.0 open source.

## Dev setup
```bash
pnpm install
cp .env.example .env   # fill devnet wallet secrets (mainnet optional)
docker compose up -d mongo
pnpm --filter @phosop/api dev
```

## Guidelines
- TypeScript everywhere; run `pnpm lint` and `pnpm test` before pushing.
- Add/adjust tests for new behavior.
- Never commit secrets or `.env`.
- Keep the API Stripe-compatible (method names, object shapes, event names).
- Always develop against devnet; never point tests at mainnet.

## PR process
1. Fork + branch from `main`.
2. Describe the change and testing done.
3. One logical change per PR.
