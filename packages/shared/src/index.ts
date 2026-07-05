// Shared Stripe-compatible object shapes for Phosop.

export type PhosopNetwork = 'devnet' | 'mainnet-beta';
export type PhosopMode = 'test' | 'live';
export type PhosopMetadata = Record<string, string>;

export function networkForMode(mode: PhosopMode): PhosopNetwork {
  return mode === 'live' ? 'mainnet-beta' : 'devnet';
}

export interface PhosopAccount {
  id: string; // acct_...
  object: 'account';
  type: string;
  email?: string;
  country?: string;
  wallet_address?: string;
  status: 'pending' | 'active' | 'disabled';
  metadata?: PhosopMetadata;
  created: number;
}

export interface PhosopPayout {
  id: string; // po_...
  object: 'payout';
  account: string;
  amount: string; // smallest units as string (BigInt-safe; USDC 6 decimals)
  currency: string;
  network: PhosopNetwork;
  status: 'pending' | 'paid' | 'failed';
  description?: string;
  metadata?: PhosopMetadata;
  tx_signature?: string;
  error?: string;
  created: number;
}

export interface PhosopWebhookEndpoint {
  id: string; // we_...
  object: 'webhook_endpoint';
  url: string;
  enabled_events: string[];
  active: boolean;
  created: number;
}

export interface PhosopConfig {
  object: 'config';
  networks: PhosopNetwork[];
  devnet_enabled: boolean;
  mainnet_enabled: boolean;
}

export interface PhosopBalance {
  object: 'balance';
  network: PhosopNetwork;
  usdc_available: number; // human USDC units
  fee_payer_sol: number; // SOL
}

export interface PhosopList<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
}

export type PhosopEventType =
  | 'payout.paid'
  | 'payout.failed'
  | 'transfer.created'
  | 'account.updated';

export interface PhosopEvent<T = unknown> {
  id: string; // evt_...
  object: 'event';
  type: PhosopEventType;
  data: T;
  created: number;
}

export interface PhosopErrorBody {
  error: { type: string; code: string; message: string };
}

export const USDC_DECIMALS = 6;

/**
 * Convert a human USDC amount (e.g. 10.5) to smallest units as a string
 * (e.g. "10500000"). Returns a string so large values stay BigInt-safe and
 * JSON-serializable.
 */
export function toSmallestUnits(usdc: number): string {
  return BigInt(Math.round(usdc * 10 ** USDC_DECIMALS)).toString();
}

/** Convert smallest units (string | number | bigint) back to a human amount. */
export function fromSmallestUnits(units: string | number | bigint): number {
  return Number(BigInt(units)) / 10 ** USDC_DECIMALS;
}
