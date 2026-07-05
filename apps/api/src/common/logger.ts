import { LoggerService } from '@nestjs/common';

const LEVELS: Record<string, number> = { error: 0, warn: 1, log: 2, debug: 3, verbose: 4 };

function safeStringify(v: unknown): string {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Structured logger. When LOG_FORMAT=json it emits one JSON object per line
 * (ideal for log aggregators like Loki/Datadog); otherwise it prints a compact
 * human-readable line. LOG_LEVEL controls verbosity (error|warn|log|debug|verbose).
 */
export class PhosopLogger implements LoggerService {
  private readonly json = (process.env.LOG_FORMAT || '').toLowerCase() === 'json';
  private readonly threshold = LEVELS[(process.env.LOG_LEVEL || 'log').toLowerCase()] ?? LEVELS.log;

  private write(level: keyof typeof LEVELS, message: unknown, context?: string): void {
    if (LEVELS[level] > this.threshold) return;
    const msg = safeStringify(message);
    if (this.json) {
      process.stdout.write(
        JSON.stringify({ ts: new Date().toISOString(), level, context, msg }) + '\n',
      );
    } else {
      const tag = context ? ` [${context}]` : '';
      console.log(`${new Date().toISOString()} ${level.toUpperCase()}${tag} ${msg}`);
    }
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.write('error', message, context);
    if (stack) this.write('error', stack, context);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }
}
