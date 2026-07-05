import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { ConfirmTimeoutError, PhosopError } from '../common/errors';
import { PhosopNetwork } from '../common/network';
import { loadWalletSecret } from '../common/secrets';

interface NetworkContext {
  network: PhosopNetwork;
  connection: Connection;
  fallback: Connection;
  platform: Keypair;
  feePayer: Keypair;
  usdcMint: PublicKey;
}

export interface PayoutItem {
  destinationOwner: string; // seller wallet address
  amount: bigint; // smallest units (USDC 6 decimals)
}

const USDC_DECIMALS = 6;

/** Validates a Solana address string; throws a clean 400 if malformed. */
export function assertValidAddress(address: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch {
    throw PhosopError.invalidRequest('invalid_wallet_address', `'${address}' is not a valid Solana address`);
  }
}

@Injectable()
export class SolanaService implements OnModuleInit {
  private readonly logger = new Logger(SolanaService.name);
  private readonly contexts = new Map<PhosopNetwork, NetworkContext>();

  onModuleInit() {
    if (process.env.ENABLE_DEVNET !== 'false') this.initNetwork('devnet');
    if (process.env.ENABLE_MAINNET === 'true') this.initNetwork('mainnet-beta');
    if (this.contexts.size === 0) {
      throw new Error('No Solana network enabled. Set ENABLE_DEVNET=true and/or ENABLE_MAINNET=true.');
    }
    this.logger.log(`Enabled networks: ${this.enabledNetworks().join(', ')}`);
  }

  private kp(secret: string | undefined, name: string): Keypair {
    if (!secret) throw new Error(`Missing ${name} secret`);
    return Keypair.fromSecretKey(bs58.decode(secret));
  }

  private initNetwork(network: PhosopNetwork) {
    const p = network === 'devnet' ? 'DEVNET' : 'MAINNET';
    const rpc = process.env[`${p}_RPC_URL`];
    if (!rpc) {
      this.logger.warn(`${network} enabled but ${p}_RPC_URL missing — skipping.`);
      return;
    }
    try {
      const ctx: NetworkContext = {
        network,
        connection: new Connection(rpc, 'confirmed'),
        fallback: new Connection(process.env[`${p}_RPC_FALLBACK_URL`] || rpc, 'confirmed'),
        platform: this.kp(loadWalletSecret(`${p}_PLATFORM_WALLET_SECRET`), `${p}_PLATFORM_WALLET_SECRET`),
        feePayer: this.kp(loadWalletSecret(`${p}_FEE_PAYER_WALLET_SECRET`), `${p}_FEE_PAYER_WALLET_SECRET`),
        usdcMint: new PublicKey(process.env[`${p}_USDC_MINT`] as string),
      };
      this.contexts.set(network, ctx);
    } catch (e) {
      this.logger.error(`Failed to init ${network}: ${(e as Error).message}`);
      throw e;
    }
  }

  enabledNetworks(): PhosopNetwork[] {
    return [...this.contexts.keys()];
  }

  isEnabled(network: PhosopNetwork): boolean {
    return this.contexts.has(network);
  }

  private ctx(network: PhosopNetwork): NetworkContext {
    const c = this.contexts.get(network);
    if (!c) throw PhosopError.networkNotEnabled(network);
    return c;
  }

  private async priorityFeeIx(ctx: NetworkContext): Promise<TransactionInstruction> {
    let micro = 1000;
    try {
      const fees = await ctx.connection.getRecentPrioritizationFees();
      if (fees.length) {
        const avg = Math.round(fees.reduce((s, f) => s + f.prioritizationFee, 0) / fees.length);
        micro = Math.max(1000, avg);
      }
    } catch {
      // fall back to default
    }
    return ComputeBudgetProgram.setComputeUnitPrice({ microLamports: micro });
  }

  private async buildTransferIxs(ctx: NetworkContext, item: PayoutItem): Promise<TransactionInstruction[]> {
    const owner = assertValidAddress(item.destinationOwner);
    const sourceAta = await getAssociatedTokenAddress(ctx.usdcMint, ctx.platform.publicKey);
    const destAta = await getAssociatedTokenAddress(ctx.usdcMint, owner);
    const ixs: TransactionInstruction[] = [];

    // Create the seller's USDC ATA if missing (fee-payer pays rent => gasless for seller).
    try {
      await getAccount(ctx.connection, destAta);
    } catch {
      ixs.push(
        createAssociatedTokenAccountInstruction(ctx.feePayer.publicKey, destAta, owner, ctx.usdcMint),
      );
    }

    ixs.push(
      createTransferCheckedInstruction(
        sourceAta,
        ctx.usdcMint,
        destAta,
        ctx.platform.publicKey,
        item.amount, // bigint
        USDC_DECIMALS,
      ),
    );
    return ixs;
  }

  /**
   * Sends a single USDC payout on the given network.
   *
   * Ordering is critical for money-safety:
   *   1. broadcast the tx (sendRawTransaction) -> we now have a signature
   *   2. persist the signature via onBroadcast() BEFORE waiting for confirm
   *   3. wait for confirmation
   *
   * If confirm times out AFTER a broadcast, we throw ConfirmTimeoutError (with
   * the signature) and DO NOT retry — retrying would double-send. Only failures
   * that happen BEFORE any broadcast fall through to the fallback RPC.
   */
  async sendPayout(
    network: PhosopNetwork,
    item: PayoutItem,
    onBroadcast?: (signature: string) => Promise<void>,
  ): Promise<string> {
    const ctx = this.ctx(network);

    // Pre-flight: make sure the platform wallet actually holds enough USDC.
    const available = await this.platformUsdcUnits(network);
    if (available < item.amount) {
      throw PhosopError.invalidRequest(
        'insufficient_funds',
        `Platform USDC balance on ${network} is too low for this payout`,
      );
    }

    const ixs = await this.buildTransferIxs(ctx, item);
    const signers = [ctx.feePayer, ctx.platform];
    let lastErr: unknown;

    for (const conn of [ctx.connection, ctx.fallback]) {
      let signature: string | undefined;
      try {
        const tx = new Transaction();
        tx.add(await this.priorityFeeIx(ctx));
        ixs.forEach((ix) => tx.add(ix));
        const { blockhash } = await conn.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = ctx.feePayer.publicKey;
        tx.signatures = [];
        tx.sign(...signers);

        // (1) broadcast
        signature = await conn.sendRawTransaction(tx.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });

        // (2) persist signature before confirming
        if (onBroadcast) await onBroadcast(signature);

        // (3) confirm
        await conn.confirmTransaction(signature, 'confirmed');
        return signature;
      } catch (e) {
        lastErr = e;
        if (signature) {
          // Already broadcast: never retry (avoids double payment).
          throw new ConfirmTimeoutError(signature, network, (e as Error).message);
        }
        this.logger.warn(`[${network}] send failed pre-broadcast, trying fallback: ${(e as Error).message}`);
      }
    }
    throw PhosopError.solana('transfer_failed', `USDC transfer failed: ${(lastErr as Error)?.message}`);
  }

  /** Returns true if the signature is confirmed/finalized on the given network. */
  async isConfirmed(network: PhosopNetwork, signature: string): Promise<boolean> {
    const ctx = this.ctx(network);
    const res = await ctx.connection.getSignatureStatuses([signature]);
    const status = res.value[0];
    if (!status || status.err) return false;
    return status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized';
  }

  /** Platform USDC balance in smallest units (bigint) on the given network. */
  async platformUsdcUnits(network: PhosopNetwork): Promise<bigint> {
    const ctx = this.ctx(network);
    try {
      const ata = await getAssociatedTokenAddress(ctx.usdcMint, ctx.platform.publicKey);
      const acc = await getAccount(ctx.connection, ata);
      return acc.amount; // already bigint
    } catch {
      return 0n;
    }
  }

  /** Platform USDC balance (human units) on the given network. */
  async platformUsdcBalance(network: PhosopNetwork): Promise<number> {
    const units = await this.platformUsdcUnits(network);
    return Number(units) / 10 ** USDC_DECIMALS;
  }

  /** Fee-payer SOL balance (in SOL) on the given network. */
  async feePayerSolBalance(network: PhosopNetwork): Promise<number> {
    const ctx = this.ctx(network);
    const lamports = await ctx.connection.getBalance(ctx.feePayer.publicKey);
    return lamports / 1e9;
  }
}
