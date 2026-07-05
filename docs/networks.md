# Networks: devnet + mainnet

Phosop is built so that **cautious users can try everything risk-free on devnet**, then flip to mainnet when they trust it — without changing any code.

## How routing works
The **API key mode** decides the network (Stripe-style):

| API key prefix | Network | Funds |
|----------------|---------|-------|
| `sk_p_test_...` | `devnet` | fake USDC (Circle devnet mint) |
| `sk_p_live_...` | `mainnet-beta` | real USDC |

The server can have **both** networks enabled at once. A request authenticated with a test key can only ever touch devnet; a live key can only ever touch mainnet. There is no request parameter that overrides this — so a "test" call can never accidentally move real money.

## Enabling networks
In `.env`:
```
ENABLE_DEVNET=true      # keep on so people can test safely
ENABLE_MAINNET=false    # turn on only when ready for real USDC
```
Each enabled network needs its own RPC, USDC mint, platform wallet, and fee-payer wallet (see `.env.example`). If a key's network is disabled, the API returns a clear `network_not_enabled` error instead of doing anything risky.

## Check what's live
```bash
curl http://localhost:3333/v1/config
# => { "networks": ["devnet"], "mainnet_enabled": false, "devnet_enabled": true }
```

## Recommended path for a nervous user
1. Get a **test key** from the operator (`sk_p_test_...`).
2. Fund a devnet wallet from a faucet; do a full payout end-to-end. No real money at stake.
3. When happy, get a **live key** (`sk_p_live_...`) and repeat with small real amounts.
4. Scale up.

## Devnet resources
- SOL faucet: https://faucet.solana.com
- Devnet USDC mint (Circle): `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
