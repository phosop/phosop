import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

/**
 * Stripe-style error object: { error: { type, code, message } }
 */
export class PhosopError extends HttpException {
  constructor(
    status: number,
    public readonly type: string,
    public readonly code: string,
    message: string,
  ) {
    super({ error: { type, code, message } }, status);
  }

  static invalidRequest(code: string, message: string) {
    return new PhosopError(HttpStatus.BAD_REQUEST, 'invalid_request_error', code, message);
  }

  static auth(message = 'Invalid API key') {
    return new PhosopError(HttpStatus.UNAUTHORIZED, 'authentication_error', 'api_key_invalid', message);
  }

  static notFound(message = 'Resource not found') {
    return new PhosopError(HttpStatus.NOT_FOUND, 'invalid_request_error', 'resource_missing', message);
  }

  static solana(code: string, message: string) {
    return new PhosopError(HttpStatus.BAD_GATEWAY, 'api_error', code, message);
  }

  static conflict(code: string, message: string) {
    return new PhosopError(HttpStatus.CONFLICT, 'idempotency_error', code, message);
  }

  static networkNotEnabled(network: string) {
    return new PhosopError(
      HttpStatus.BAD_REQUEST,
      'invalid_request_error',
      'network_not_enabled',
      `The ${network} network is not enabled on this server`,
    );
  }
}

/**
 * Thrown when a transaction was ALREADY broadcast to the network but the
 * confirmation wait timed out. Carries the signature so the payout can stay
 * `pending` (never `failed`) and be finalized by reconciliation. This is the
 * key guard against paying the same payout twice.
 */
export class ConfirmTimeoutError extends Error {
  constructor(
    public readonly signature: string,
    public readonly network: string,
    message: string,
  ) {
    super(message);
    this.name = 'ConfirmTimeoutError';
  }
}

@Catch()
export class StripeStyleExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const normalized =
        typeof body === 'object' && body !== null && 'error' in body
          ? body
          : {
              error: {
                type: status === 429 ? 'rate_limit_error' : 'invalid_request_error',
                code: status === 429 ? 'too_many_requests' : 'error',
                message: String((body as any)?.message ?? body),
              },
            };
      return res.status(status).json(normalized);
    }

    return res.status(500).json({
      error: { type: 'api_error', code: 'internal_error', message: 'Internal server error' },
    });
  }
}
