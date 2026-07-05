import { useEffect, useState, CSSProperties } from 'react';
import { WalletOnboarding } from './WalletOnboarding';

interface Payout {
  id: string;
  amount: string; // smallest units as string (BigInt-safe)
  currency: string;
  network: string;
  status: string;
  tx_signature?: string;
}

interface Config {
  networks: string[];
  devnet_enabled: boolean;
  mainnet_enabled: boolean;
}

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3333';
const SOLSCAN = 'https://solscan.io/tx/';

/** Format smallest-unit string amount to human USDC (BigInt-safe). */
function formatUsdc(units: string): string {
  try {
    return (Number(BigInt(units)) / 1e6).toFixed(2);
  } catch {
    return '0.00';
  }
}

const COLORS = {
  text: '#1a1915',
  muted: '#74726a',
  accent: '#d97757',
  surface: '#fefdfb',
  border: '#e6e3d8',
  mono: '"Berkeley Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 880, margin: '0 auto', padding: '56px 24px 96px' },
  brandRow: { display: 'flex', alignItems: 'center', gap: 12 },
  brandMark: { width: 26, height: 26, borderRadius: 7, background: COLORS.accent, display: 'inline-block' },
  h1: { fontSize: 30, fontWeight: 650, margin: 0, letterSpacing: '-0.02em' },
  subtitle: { color: COLORS.muted, marginTop: 8, fontSize: 15 },
  serverRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 18 },
  serverLabel: { color: COLORS.muted, fontSize: 13 },
  card: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 14,
    padding: 22,
    marginTop: 24,
  },
  cardTitle: { fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: COLORS.muted, margin: '0 0 14px' },
  row: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  input: { padding: '10px 12px', width: 340, height: 40 },
  btn: { padding: '0 18px', height: 40, cursor: 'pointer', background: COLORS.accent, color: '#fff', fontSize: 14 },
  keyHint: { fontSize: 12.5, color: COLORS.muted, marginTop: 10, fontFamily: COLORS.mono },
  error: { color: '#b3412c', marginTop: 12, fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 4, fontSize: 14 },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, fontWeight: 600, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.05em' },
  td: { padding: '12px 8px', borderBottom: `1px solid ${COLORS.border}`, fontFamily: COLORS.mono, fontSize: 13 },
  mono: { fontFamily: COLORS.mono },
  empty: { color: COLORS.muted, fontSize: 14, padding: '18px 0' },
  badgeDev: { background: '#eaf3ec', color: '#2e7d5b', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontFamily: COLORS.mono },
  badgeLive: { background: '#fbe9e3', color: '#b3412c', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontFamily: COLORS.mono },
  badgeOff: { background: '#efeee7', color: COLORS.muted, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontFamily: COLORS.mono },
  pillPaid: { background: '#eaf3ec', color: '#2e7d5b', padding: '2px 10px', borderRadius: 999, fontSize: 12 },
  pillPending: { background: '#fdf3e4', color: '#9a6b17', padding: '2px 10px', borderRadius: 999, fontSize: 12 },
  pillFailed: { background: '#fbe9e3', color: '#b3412c', padding: '2px 10px', borderRadius: 999, fontSize: 12 },
};

function statusPill(status: string): CSSProperties {
  if (status === 'paid') return styles.pillPaid;
  if (status === 'failed') return styles.pillFailed;
  return styles.pillPending;
}

export function App() {
  const [apiKey, setApiKey] = useState('');
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState('');

  const keyNetwork = apiKey.startsWith('sk_p_live_')
    ? 'mainnet-beta'
    : apiKey.startsWith('sk_p_test_')
      ? 'devnet'
      : null;

  async function loadConfig() {
    try {
      const res = await fetch(`${API}/v1/config`);
      setConfig(await res.json());
    } catch {
      /* ignore */
    }
  }

  async function load() {
    setError('');
    try {
      const res = await fetch(`${API}/v1/payouts?limit=50`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Request failed');
      setPayouts(json.data ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.brandRow}>
        <span style={styles.brandMark} />
        <h1 style={styles.h1}>Phosop</h1>
      </div>
      <p style={styles.subtitle}>Gasless USDC payouts on Solana. Open source. Not affiliated with Stripe.</p>

      <div style={styles.serverRow}>
        <span style={styles.serverLabel}>Server networks</span>
        <span style={config?.devnet_enabled ? styles.badgeDev : styles.badgeOff}>
          devnet {config?.devnet_enabled ? 'on' : 'off'}
        </span>
        <span style={config?.mainnet_enabled ? styles.badgeLive : styles.badgeOff}>
          mainnet {config?.mainnet_enabled ? 'on' : 'off'}
        </span>
      </div>

      <div style={styles.card}>
        <p style={styles.cardTitle}>API key</p>
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="sk_p_test_... or sk_p_live_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button style={styles.btn} onClick={load}>Load payouts</button>
          {keyNetwork ? (
            <span style={keyNetwork === 'mainnet-beta' ? styles.badgeLive : styles.badgeDev}>
              key → {keyNetwork}
            </span>
          ) : null}
        </div>
        <div style={styles.keyHint}>
          test keys → devnet (safe) · live keys → mainnet (real USDC)
        </div>
        {error ? <p style={styles.error}>{error}</p> : null}
      </div>

      <WalletOnboarding apiBase={API} apiKey={apiKey} />

      <div style={styles.card}>
        <p style={styles.cardTitle}>Payouts</p>
        {payouts.length === 0 ? (
          <p style={styles.empty}>No payouts loaded yet. Enter an API key and press “Load payouts”.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Amount (USDC)</th>
                <th style={styles.th}>Network</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Tx</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td style={styles.td}><code>{p.id}</code></td>
                  <td style={styles.td}>{formatUsdc(p.amount)}</td>
                  <td style={styles.td}>
                    <span style={p.network === 'mainnet-beta' ? styles.badgeLive : styles.badgeDev}>
                      {p.network}
                    </span>
                  </td>
                  <td style={styles.td}><span style={statusPill(p.status)}>{p.status}</span></td>
                  <td style={styles.td}>
                    {p.tx_signature ? (
                      <a href={SOLSCAN + p.tx_signature} target="_blank" rel="noreferrer">view</a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
