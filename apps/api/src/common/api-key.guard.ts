import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiKeysService } from '../apikeys/apikeys.service';
import { PhosopError } from './errors';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    const match = header.match(/^Bearer\s+(sk_p_[a-zA-Z0-9_]+)$/);
    if (!match) throw PhosopError.auth('Missing or malformed Authorization header');
    const result = await this.apiKeys.validate(match[1]);
    if (!result) throw PhosopError.auth();
    // Attach the network resolved from the key (test => devnet, live => mainnet-beta).
    req.phosopNetwork = result.network;
    return true;
  }
}
