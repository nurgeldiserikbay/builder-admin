'use client';

import { useState } from 'react';

type Usage = { key: string; title: string; used: number; limit: number };
type Account = {
  userId: string; email: string; note: string | null; updatedAt: string | null;
  plan: { key: string; title: string; validUntil: string | null; expired: boolean; expiredPlanTitle: string | null };
  usage: Usage[];
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const plans = [['free', 'Free'], ['start', 'Start'], ['business', 'Business']] as const;
const messages: Record<string, string> = {
  ACCOUNT_NOT_FOUND: 'No customer account with this e-mail.',
  STAFF_ROLE_REQUIRED: 'Only super admins can change plans; operations auditors can look them up.',
  INVALID_VALID_UNTIL: 'The end date must be in the future.',
  INVALID_EMAIL: 'Enter a valid e-mail.',
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, { credentials: 'include', cache: 'no-store', ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => null) as { data?: T; message?: string } | null;
  if (response.status === 401) throw new Error('Sign in as staff first.');
  if (!response.ok || !payload?.data) throw new Error(messages[payload?.message ?? ''] ?? `Request failed (${response.status}).`);
  return payload.data;
}

/** Plan assignment after a confirmed offline payment. Every change is written to the staff audit history. */
export default function AccountPlans() {
  const [email, setEmail] = useState('');
  const [account, setAccount] = useState<Account | null>(null);
  const [planKey, setPlanKey] = useState('start');
  const [validUntil, setValidUntil] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  async function lookup() {
    setBusy(true); setError(''); setSaved('');
    try {
      const result = await call<Account>(`/admin/accounts/plan?email=${encodeURIComponent(email.trim())}`);
      setAccount(result); setPlanKey(result.plan.key === 'free' ? 'start' : result.plan.key); setNote(result.note ?? '');
      setValidUntil(result.plan.validUntil ? result.plan.validUntil.slice(0, 10) : '');
    } catch (cause) { setAccount(null); setError(cause instanceof Error ? cause.message : 'Lookup failed.'); } finally { setBusy(false); }
  }

  async function assign() {
    if (!account) return;
    if (!window.confirm(`Set ${account.email} to the ${planKey} plan${validUntil ? ` until ${validUntil}` : ''}? This takes effect immediately.`)) return;
    setBusy(true); setError(''); setSaved('');
    try {
      const result = await call<Account>('/admin/accounts/plan', {
        method: 'POST',
        body: JSON.stringify({ email: account.email, planKey, validUntil: planKey === 'free' || !validUntil ? null : new Date(validUntil + 'T23:59:59.000Z').toISOString(), note: note.trim() || null }),
      });
      setAccount(result); setSaved('Plan updated and recorded in the audit history.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Update failed.'); } finally { setBusy(false); }
  }

  return (
    <div className="catalog">
      <form className="quality-toolbar" onSubmit={(event) => { event.preventDefault(); void lookup(); }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
          <span>Customer e-mail</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
        </label>
        <button type="submit" disabled={busy || email.trim().length < 3}>Look up</button>
      </form>
      {error && <div className="catalog-state catalog-error" role="alert">{error}</div>}
      {saved && <div className="catalog-state" role="status">{saved}</div>}
      {account && (
        <div className="catalog-card" style={{ display: 'grid', gap: 12 }}>
          <div className="catalog-card-heading">
            <strong>{account.email}</strong>
            <span className="catalog-status">{account.plan.title}{account.plan.validUntil ? ` · until ${account.plan.validUntil.slice(0, 10)}` : ''}</span>
          </div>
          {account.plan.expired && <p className="catalog-note">The {account.plan.expiredPlanTitle} plan has expired; free limits apply.</p>}
          <div className="catalog-summary">
            {account.usage.map((item) => <div key={item.key}><strong>{item.used} / {item.limit}</strong><br /><span className="catalog-category">{item.title}</span></div>)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 4 }}>Plan
              <select value={planKey} onChange={(event) => setPlanKey(event.target.value)}>{plans.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>Valid until (optional)
              <input type="date" value={validUntil} disabled={planKey === 'free'} onChange={(event) => setValidUntil(event.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 4, flex: 1, minWidth: 200 }}>Payment reference / note
              <input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="Invoice 12, Kaspi transfer 09.11" />
            </label>
            <button type="button" disabled={busy} onClick={() => void assign()}>Save plan</button>
          </div>
          <p className="catalog-note">Assign a paid plan only after the payment is confirmed. Setting Free removes the paid plan; projects and live sites stay, new ones above the free limits are blocked.</p>
        </div>
      )}
    </div>
  );
}
