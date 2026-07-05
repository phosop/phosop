import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account } from './account.schema';
import { PhosopError } from '../common/errors';
import { assertValidAddress } from '../solana/solana.service';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(Account.name) private readonly model: Model<Account>,
    private readonly webhooks: WebhooksService,
  ) {}

  async create(data: {
    email?: string;
    country?: string;
    type?: string;
    metadata?: Record<string, string>;
  }) {
    const doc = await this.model.create({ ...data });
    return this.serialize(doc);
  }

  async retrieve(id: string) {
    const doc = await this.model.findById(id);
    if (!doc) throw PhosopError.notFound(`No such account: ${id}`);
    return this.serialize(doc);
  }

  async attachWallet(id: string, walletAddress: string) {
    assertValidAddress(walletAddress);
    const doc = await this.model.findById(id);
    if (!doc) throw PhosopError.notFound(`No such account: ${id}`);
    doc.walletAddress = walletAddress;
    doc.status = 'active';
    await doc.save();
    const serialized = this.serialize(doc);
    await this.webhooks.emit('account.updated', serialized);
    return serialized;
  }

  async requireWallet(id: string): Promise<string> {
    const doc = await this.model.findById(id);
    if (!doc) throw PhosopError.notFound(`No such account: ${id}`);
    if (!doc.walletAddress) {
      throw PhosopError.invalidRequest('no_wallet', `Account ${id} has no wallet attached`);
    }
    return doc.walletAddress;
  }

  private serialize(doc: any) {
    return {
      id: doc._id,
      object: 'account',
      type: doc.type,
      email: doc.email,
      country: doc.country,
      wallet_address: doc.walletAddress,
      status: doc.status,
      metadata: doc.metadata ?? {},
      created: Math.floor(new Date(doc.createdAt).getTime() / 1000),
    };
  }
}
