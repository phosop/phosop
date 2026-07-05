import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'crypto';
import { ApiKey } from './apikey.schema';
import { PhosopNetwork, networkForMode } from '../common/network';

@Injectable()
export class ApiKeysService {
  constructor(@InjectModel(ApiKey.name) private readonly model: Model<ApiKey>) {}

  private hash(raw: string): string {
    const pepper = process.env.API_KEY_PEPPER || '';
    return createHash('sha256').update(raw + pepper).digest('hex');
  }

  /**
   * Generates a new API key for the given mode, stores only its hash, and
   * returns the raw key ONCE. test => devnet, live => mainnet-beta.
   */
  async create(
    mode: 'test' | 'live' = 'test',
    label?: string,
  ): Promise<{ apiKey: string; prefix: string; network: PhosopNetwork }> {
    const network = networkForMode(mode);
    const raw = `sk_p_${mode}_${randomBytes(24).toString('hex')}`;
    const prefix = raw.slice(0, 16);
    await this.model.create({ hashedKey: this.hash(raw), prefix, network, label });
    return { apiKey: raw, prefix, network };
  }

  /** Returns the key's network if valid & not revoked, else null. */
  async validate(raw: string): Promise<{ network: PhosopNetwork } | null> {
    const doc = await this.model.findOne({ hashedKey: this.hash(raw), revoked: false });
    if (!doc) return null;
    doc.lastUsedAt = new Date();
    await doc.save();
    return { network: doc.network as PhosopNetwork };
  }

  async list() {
    const docs = await this.model.find().sort({ createdAt: -1 });
    return docs.map((d) => ({
      prefix: d.prefix,
      network: d.network,
      label: d.label,
      revoked: d.revoked,
      lastUsedAt: d.lastUsedAt,
    }));
  }

  async revoke(prefix: string): Promise<boolean> {
    const res = await this.model.updateOne({ prefix }, { revoked: true });
    return res.modifiedCount > 0;
  }
}
