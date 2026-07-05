import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'crypto';
import { IdempotencyKey } from './idempotency.schema';
import { PhosopError } from './errors';

export type AcquireResult =
  | { completed: true; response: Record<string, unknown> }
  | { completed: false };

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectModel(IdempotencyKey.name) private readonly model: Model<IdempotencyKey>,
  ) {}

  private hash(body: unknown): string {
    return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
  }

  /**
   * Atomically claims an idempotency key BEFORE doing any work. Uses a unique
   * index as a distributed lock so two concurrent identical requests can never
   * both send a payout.
   *
   * - fresh key            -> inserts a lock row, returns { completed: false }
   * - key already finished  -> returns the cached response
   * - key in progress       -> throws 409 request_in_progress
   * - key reused, diff body -> throws 400 idempotency_key_in_use
   */
  async acquire(rawKey: string, network: string, body: unknown): Promise<AcquireResult> {
    const key = `${network}:${rawKey}`;
    const requestHash = this.hash(body);
    try {
      await this.model.create({ key, requestHash });
      return { completed: false };
    } catch (e: any) {
      if (e?.code !== 11000) throw e; // not a duplicate-key error
      const existing = await this.model.findOne({ key });
      if (!existing) return { completed: false };
      if (existing.requestHash !== requestHash) {
        throw PhosopError.invalidRequest(
          'idempotency_key_in_use',
          'This Idempotency-Key was already used with a different request body.',
        );
      }
      if (existing.responseSnapshot) {
        return { completed: true, response: existing.responseSnapshot };
      }
      throw PhosopError.conflict(
        'request_in_progress',
        'A request with this Idempotency-Key is still being processed. Retry shortly.',
      );
    }
  }

  /** Stores the final response so retries return the exact same result. */
  async complete(rawKey: string, network: string, response: Record<string, unknown>): Promise<void> {
    const key = `${network}:${rawKey}`;
    await this.model.updateOne({ key }, { $set: { responseSnapshot: response } });
  }

  /**
   * Releases the lock ONLY if no response was stored (i.e. the request failed
   * before any broadcast). Safe because a broadcast payout is kept as `pending`
   * with a stored snapshot and therefore never reaches release().
   */
  async release(rawKey: string, network: string): Promise<void> {
    const key = `${network}:${rawKey}`;
    await this.model.deleteOne({ key, responseSnapshot: { $exists: false } });
  }
}
