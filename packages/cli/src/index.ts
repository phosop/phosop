#!/usr/bin/env node
import { Phosop, toSmallestUnits } from '@phosop/node';

const BASE_URL = process.env.PHOSOP_BASE_URL ?? 'http://localhost:3333';
const API_KEY = process.env.PHOSOP_API_KEY ?? '';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const cmd = process.argv[2];
  const client = new Phosop(API_KEY, { baseUrl: BASE_URL });

  switch (cmd) {
    case 'config': {
      console.log(JSON.stringify(await client.config(), null, 2));
      break;
    }
    case 'balance': {
      console.log(JSON.stringify(await client.balance.retrieve(), null, 2));
      break;
    }
    case 'payout': {
      const to = arg('to');
      const usdc = Number(arg('usdc'));
      if (!to || !usdc) throw new Error('Usage: phosop payout --to <acct_...> --usdc <amount>');
      console.log(`Network (from key): ${client.network}`);
      const res = await client.payouts.create({
        amount: toSmallestUnits(usdc),
        currency: 'usdc',
        destination: to,
        description: arg('note'),
      });
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'payouts:list': {
      console.log(JSON.stringify(await client.payouts.list({ limit: 20 }), null, 2));
      break;
    }
    case 'webhook:add': {
      const url = arg('url');
      if (!url) throw new Error('Usage: phosop webhook:add --url <https://...>');
      console.log(JSON.stringify(await client.webhookEndpoints.create({ url }), null, 2));
      break;
    }
    case 'keys:create': {
      console.log('API keys are admin-issued. See docs/quickstart.md (POST /v1/admin/api_keys with X-Admin-Secret).');
      console.log('Use {"mode":"test"} for devnet or {"mode":"live"} for mainnet.');
      break;
    }
    default:
      console.log(
        'Commands:\n  config\n  balance\n  payout --to <acct> --usdc <n> [--note <text>]\n  payouts:list\n  webhook:add --url <url>\n  keys:create',
      );
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
