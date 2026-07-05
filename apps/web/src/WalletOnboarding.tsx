import { useState, CSSProperties } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const COLORS = {
  text: '#1a1915',
  muted: '#74726a',
  accent: '#d97757',
  surface: '#fefdfb',
  border: '#e6e3d8',
  mono: '"Berkeley Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

const styles: Record<string, CSSProperties> = {
  card: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: 22,
    marginTop: 24,
  },
  title: { fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.muted, margin: '0 0 14px' },
  step: { fontSize: 14, margin: '14px 0 8px', color: COLORS.text },
  stepNum: { color: COLORS.accent, fontWeight: 650, fontFamily: COLORS.mono, marginRight: 6 },
  row: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' },
  input: { padding: '10px 12px', width: 320, height: 40 },
  btn: { padding: '0 18px', height: 40, cursor: 'pointer', background: COLORS.accent, color: '#fff', fontSize: 14 },
  connected: { fontFamily: COLORS.mono, fontSize: 12.5, color: COLORS.muted, marginTop: 10, wordBreak: 'break-all' },
  ok: { color: '#2e7d5b', marginTop: 12, fontSize: 14 },
  err: { color: '#b3412c', marginTop: 12, fontSize: 14 },
};

/**
 * Seller onboarding: connect a Solana wallet, then attach it to a Phosop
 * account so the operator can pay out USDC to it (gasless).
 */
export function WalletOnboarding({ apiBase, apiKey }: { apiBase: string; apiKey: string }) {
  const { publicKey, connected } = useWallet();
  const [accountId, setAccountId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function attach() {
    setMsg('');
    setErr('');
    if (!publicKey) {
      setErr('Connect a wallet first.');
      return;
    }
    if (!accountId) {
      setErr('Enter your Phosop account id (acct_...).');
      return;
    }
    try {
      const res = await fetch(`${apiBase}/v1/accounts/${accountId}/wallet`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Request failed');
      setMsg(`Wallet attached to ${json.id} (status: ${json.status}).`);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div style={styles.card}>
      <p style={styles.title}>Seller onboarding</p>

      <p style={styles.step}>
        <span style={styles.stepNum}>01</span>
        Connect your Solana wallet. You need zero SOL — payouts are gasless.
      </p>
      <WalletMultiButton />
      {connected && publicKey ? (
        <p style={styles.connected}>connected: {publicKey.toBase58()}</p>
      ) : null}

      <p style={styles.step}>
        <span style={styles.stepNum}>02</span>
        Attach it to your Phosop account.
      </p>
      <div style={styles.row}>
        <input
          style={styles.input}
          placeholder="acct_..."
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        />
        <button style={styles.btn} onClick={attach}>Attach wallet</button>
      </div>
      {msg ? <p style={styles.ok}>{msg}</p> : null}
      {err ? <p style={styles.err}>{err}</p> : null}
    </div>
  );
}
