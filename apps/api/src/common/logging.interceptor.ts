import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { MetricsService } from './metrics.service';

/**
 * Per-request logging + a request id (echoed as X-Request-Id) + basic HTTP
 * counters. Every log line for a request carries req_id so you can trace it.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const reqId = (req.headers && req.headers['x-request-id']) || randomUUID();
    req.requestId = reqId;
    if (res && typeof res.setHeader === 'function') res.setHeader('X-Request-Id', reqId);
    const started = Date.now();
    const method = req.method;
    const url = req.originalUrl || req.url;
    this.metrics.inc('http_requests_total');

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          this.logger.log(`${method} ${url} ${res?.statusCode} ${ms}ms req_id=${reqId}`);
        },
        error: (err) => {
          const ms = Date.now() - started;
          this.metrics.inc('http_errors_total');
          this.logger.warn(`${method} ${url} ERR ${ms}ms req_id=${reqId} ${err?.message ?? err}`);
        },
      }),
    );
  }
}
