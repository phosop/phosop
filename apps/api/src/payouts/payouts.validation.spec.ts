import { validateAmount, validateCurrency } from './payouts.service';

describe('validateAmount', () => {
  beforeAll(() => {
    process.env.MIN_PAYOUT_UNITS = '10000';
    process.env.MAX_PAYOUT_UNITS = '100000000000';
  });

  it('accepts a positive integer in range and returns bigint', () => {
    expect(validateAmount(10_000000)).toBe(10000000n);
  });

  it('accepts a numeric string', () => {
    expect(validateAmount('10000000')).toBe(10000000n);
  });

  it('preserves precision for very large values', () => {
    process.env.MAX_PAYOUT_UNITS = '99999999999999999999';
    expect(validateAmount('90000000000000000001')).toBe(90000000000000000001n);
    process.env.MAX_PAYOUT_UNITS = '100000000000';
  });

  it('rejects zero and negatives', () => {
    expect(() => validateAmount(0)).toThrow();
    expect(() => validateAmount(-5)).toThrow();
  });

  it('rejects non-integers and junk', () => {
    expect(() => validateAmount(1.5)).toThrow();
    expect(() => validateAmount('abc')).toThrow();
    expect(() => validateAmount('1.5')).toThrow();
    expect(() => validateAmount(NaN)).toThrow();
  });

  it('rejects out-of-range amounts', () => {
    expect(() => validateAmount(1)).toThrow(); // below min
    expect(() => validateAmount('999999999999')).toThrow(); // above max
  });
});

describe('validateCurrency', () => {
  beforeAll(() => {
    process.env.SUPPORTED_CURRENCIES = 'usdc';
  });

  it('defaults to usdc', () => {
    expect(validateCurrency(undefined)).toBe('usdc');
  });

  it('rejects unsupported currency', () => {
    expect(() => validateCurrency('eur')).toThrow();
  });
});
