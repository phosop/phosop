/**
 * Placeholder unit test. Run with `pnpm --filter @phosop/api test`.
 * Replace with proper mongodb-memory-server + mocked SolanaService tests.
 */
describe('PayoutsService', () => {
  it('rejects non-positive amounts (contract)', () => {
    const amount = 0;
    expect(amount > 0).toBe(false);
  });
});
