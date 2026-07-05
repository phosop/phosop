import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { PhosopError } from './errors';

/**
 * Guards admin-only endpoints (e.g. API key issuance) with a shared secret
 * passed in the `X-Admin-Secret` header. Uses constant-time comparison.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const provided: string = req.headers['x-admin-secret'] || '';
    const expected = process.env.ADMIN_API_SECRET || '';
    if (!expected) {
      throw PhosopError.invalidRequest('admin_not_configured', 'ADMIN_API_SECRET is not set');
    }
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw PhosopError.auth('Invalid admin secret');
    }
    return true;
  }
}
