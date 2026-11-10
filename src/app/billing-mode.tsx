'use client';

import { useEffect, useState } from 'react';

type Mode = { mode: 'off' | 'prepaid'; prepaidSince: string | null; minTopUp: number; specialistFeePercent: number; provider: 'freedompay' | 'mock' | null; priced: boolean };
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const messages: Record<string, string> = {
  AI_PRICING_NOT_SET: 'Set AI prices first: the balance is charged by them.',
  PAYMENTS_NOT_CONFIGURED: 'No payment provider is configured on the API (FREEDOMPAY_MERCHANT_ID and FREEDOMPAY_SECRET_KEY), so customers could not top up.',
  INVALID_MIN_TOP_UP: 'Minimum top-up must be a whole number from 100 to 100 000 ₸.',
  STAFF_ROLE_REQUIRED: 'Only super admins can change the billing mode.',
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, { credentials: 'include', cache: 'no-store', ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => null) as { data?: T; message?: string } | null;
  if (response.status === 401) throw new Error('Sign in as staff first.');
  if (!response.ok || !payload || !('data' in payload)) throw new Error(messages[payload?.message ?? ''] ?? `Request failed (${response.status}).`);
  return payload.data as T;
}

/**
 * Prepaid billing: when on, a project needs a positive balance for AI requests and owners top up through the provider.
 * Spending is counted from the moment it is switched on; switching off stops enforcement but keeps balances.
 */
export default function BillingMode() {
  const [state, setState] = useState<Mode | null>(null);
  const [minTopUp, setMinTopUp] = useState('');
  const [fee, setFee] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  function apply(next: Mode) { setState(next); setMinTopUp(String(next.minTopUp)); setFee(String(next.specialistFeePercent)); }
  useEffect(() => {
    const load = () => { setError(''); call<Mode>('/admin/billing-mode').then(apply).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load the billing mode.')); };
    load();
    window.addEventListener('buildpath:staff-session-changed', load);
    return () => window.removeEventListener('buildpath:staff-session-changed', load);
  }, []);

  async function save(mode: Mode['mode']) {
    const value = Number(minTopUp);
    const text = mode === 'prepaid'
      ? `Switch prepaid billing ON? AI requests will be refused for projects without balance. Minimum top-up ${value} ₸.`
      : state?.mode === 'off' ? `Save: minimum top-up ${value} ₸, specialist fee ${fee} %? Prepaid billing stays off.` : 'Switch prepaid billing OFF? AI requests will no longer need a balance; balances stay as they are.';
    if (!window.confirm(text)) return;
    setBusy(true); setError(''); setSaved('');
    try { apply(await call<Mode>('/admin/billing-mode', { method: 'POST', body: JSON.stringify({ mode, minTopUp: value, specialistFeePercent: Number(fee.replace(',', '.')) }) })); setSaved('Saved and recorded in the audit history.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Save failed.'); } finally { setBusy(false); }
  }

  if (!state && !error) return <div className="catalog"><div className="catalog-state">Loading…</div></div>;
  return (
    <div className="catalog">
      {error && <div className="catalog-state catalog-error" role="alert">{error}</div>}
      {saved && <div className="catalog-state" role="status">{saved}</div>}
      {state && (
        <div className="catalog-card" style={{ display: 'grid', gap: 10 }}>
          <p style={{ margin: 0 }}><strong>{state.mode === 'prepaid' ? 'Prepaid billing is ON' : 'Prepaid billing is OFF'}</strong>{state.mode === 'prepaid' && state.prepaidSince ? ` since ${state.prepaidSince.slice(0, 16).replace('T', ' ')} UTC` : ''}.</p>
          <p className="catalog-note">Payment provider: {state.provider === 'freedompay' ? 'Freedom Pay' : state.provider === 'mock' ? 'mock (development only — no real money)' : 'not configured'}. AI prices: {state.priced ? 'set' : 'not set'}.</p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span>Minimum top-up, ₸</span>
            <input inputMode="numeric" value={minTopUp} onChange={(event) => setMinTopUp(event.target.value.replace(/\D/g, ''))} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, width: 120 }} /></label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span>BuildPath fee on specialist payments, %</span>
            <input inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value.replace(/[^\d.,]/g, ''))} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, width: 80 }} /></label>
          <p className="catalog-note">0–30 %. Kept from the specialist&apos;s part when an owner pays through BuildPath; fixed for each payment when the owner starts paying.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {state.mode === 'off' && <button type="button" disabled={busy} onClick={() => void save('off')}>Save fee and minimum</button>}
            <button type="button" disabled={busy} onClick={() => void save('prepaid')}>{state.mode === 'prepaid' ? 'Save minimum' : 'Switch prepaid ON'}</button>
            {state.mode === 'prepaid' && <button type="button" disabled={busy} onClick={() => void save('off')}>Switch prepaid OFF</button>}
          </div>
        </div>
      )}
    </div>
  );
}
