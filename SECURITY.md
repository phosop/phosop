# Security Policy

Phosop moves real funds on mainnet. Treat it as security-critical.

## Reporting a vulnerability
Email the maintainers privately before public disclosure. Do not open a public issue for exploitable bugs.

## Network safety (devnet + mainnet)
- **Devnet is the safe sandbox.** Test API keys (`sk_p_test_...`) always route to devnet and move fake USDC. Nothing on devnet can lose real money.
- **Mainnet is real and irreversible.** Live API keys (`sk_p_live_...`) route to mainnet-beta. Enable it only via `ENABLE_MAINNET=true`.
- A server can run both at once; the API key mode decides the network, so you can never accidentally send a "test" payout to mainnet.

## Operator responsibilities
- **Never commit secrets.** Wallet secrets, `API_KEY_PEPPER`, `ADMIN_API_SECRET`, and `WEBHOOK_SIGNING_SECRET` belong only in `.env` / a secrets manager.
- **Rotate example values before deploy.** Production boot rejects empty or placeholder security values, but you should still generate fresh secrets for every environment.
- API keys are stored **hashed** (SHA-256 + pepper). The raw key is shown once at creation.
- Keep hot-wallet balances low; watch the low-balance alerts.
- Rotate keys and secrets regularly.
- Verify webhook payloads using the `Phosop-Signature` HMAC header before trusting them.

## Not affiliated with Stripe
Phosop is API-shape-compatible with Stripe for developer familiarity only. It does not use, depend on, or is endorsed by Stripe.
