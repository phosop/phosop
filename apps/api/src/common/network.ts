import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type PhosopNetwork = 'devnet' | 'mainnet-beta';

export function networkForMode(mode: 'test' | 'live'): PhosopNetwork {
  return mode === 'live' ? 'mainnet-beta' : 'devnet';
}

export function modeForNetwork(network: PhosopNetwork): 'test' | 'live' {
  return network === 'mainnet-beta' ? 'live' : 'test';
}

/**
 * Extracts the network resolved by ApiKeyGuard from the request.
 * Test keys => devnet, live keys => mainnet-beta.
 */
export const Network = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PhosopNetwork => {
    const req = ctx.switchToHttp().getRequest();
    return (req.phosopNetwork as PhosopNetwork) ?? 'devnet';
  },
);
