'use client';

import { useEffect, useState } from 'react';

type PlanSummary = { key: string; title: string; monthlyPriceKzt: number | null; price: string | null; limits: { projects: number; aiPerMonth: number; liveSites: number }; specialists: boolean };
type Settings = { plans: PlanSummary[]; priceUpdatedAt: Record<string, string>; salesContactUrl: string | null; salesContactFallback: string | null };

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const paid = ['start', 'business'] as const;
const messages: Record<string, string> = {
  INVALID_PRICE: 'Price must be a whole number of tenge between 100 and 10 000 000, or empty for "price on request".',
  INVALID_CONTACT_URL: 'Contact must be an https:// link (for example https://t.me/your_sales or https://wa.me/7700…) or mailto:address.',
  STAFF_ROLE_REQUIRED: 'Only super admins can change prices; operations auditors can view them.',
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, { credentials: 'include', cache: 'no-store', ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => null) as { data?: T; message?: string } | null;
  if (response.status === 401) throw new Error('Sign in as staff first.');
  if (!response.ok || !payload?.data) throw new Error(messages[payload?.message ?? ''] ?? `Request failed (${response.status}).`);
  return payload.data;
}

/** Prices shown to customers on the plan page and the upgrade contact. Every change is written to the staff audit history. */
export default function PlanSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  function apply(next: Settings) {
    setSettings(next);
    setPrices(Object.fromEntries(paid.map((key) => [key, String(next.plans.find((plan) => plan.key === key)?.monthlyPriceKzt ?? '')])));
    setContact(next.salesContactUrl ?? '');
  }

  useEffect(() => {
    const load = () => {
      setError(''); setSaved('');
      call<Settings>('/admin/plan-settings').then(apply).catch((cause) => { setSettings(null); setError(cause instanceof Error ? cause.message : 'Could not load prices.'); });
    };
    load();
    window.addEventListener('buildpath:staff-session-changed', load);
    return () => window.removeEventListener('buildpath:staff-session-changed', load);
  }, []);

  const parsed = Object.fromEntries(paid.map((key) => {
    const text = (prices[key] ?? '').replace(/[\s ]/g, '');
    return [key, text === '' ? null : Number(text)];
  })) as Record<(typeof paid)[number], number | null>;
  const invalid = paid.some((key) => parsed[key] !== null && (!Number.isInteger(parsed[key]) || (parsed[key] as number) < 100 || (parsed[key] as number) > 10_000_000));

  async function save() {
    if (!settings || invalid) return;
    const summary = paid.map((key) => `${settings.plans.find((plan) => plan.key === key)?.title}: ${parsed[key] === null ? 'on request' : `${parsed[key]} ₸/month`}`).join(', ');
    if (!window.confirm(`Customers will see these prices immediately: ${summary}. Continue?`)) return;
    setBusy(true); setError(''); setSaved('');
    try {
      apply(await call<Settings>('/admin/plan-settings', { method: 'POST', body: JSON.stringify({ prices: parsed, salesContactUrl: contact.trim() || null }) }));
      setSaved('Saved and recorded in the audit history.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Save failed.'); } finally { setBusy(false); }
  }

  if (!settings) return <div className="catalog">{error ? <div className="catalog-state catalog-error" role="alert">{error}</div> : <div className="catalog-state">Loading prices…</div>}</div>;
  return (
    <div className="catalog">
      {error && <div className="catalog-state catalog-error" role="alert">{error}</div>}
      {saved && <div className="catalog-state" role="status">{saved}</div>}
      <div className="catalog-card" style={{ display: 'grid', gap: 14 }}>
        {settings.plans.map((plan) => (
          <div key={plan.key} style={{ display: 'grid', gap: 6 }}>
            <div className="catalog-card-heading">
              <strong>{plan.title}</strong>
              <span className="catalog-status">{plan.price ?? 'Price on request'}</span>
            </div>
            <p className="catalog-note">Limits (set in code): {plan.limits.projects} projects, {plan.limits.aiPerMonth} AI requests/month, {plan.limits.liveSites} live sites, specialists {plan.specialists ? 'allowed' : 'not allowed'}.</p>
            {(paid as readonly string[]).includes(plan.key) && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>Monthly price, ₸</span>
                <input inputMode="numeric" value={prices[plan.key] ?? ''} placeholder="empty = on request" onChange={(event) => setPrices({ ...prices, [plan.key]: event.target.value })}
                  style={{ width: 160, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
                {settings.priceUpdatedAt[plan.key] && <span className="catalog-note">changed {settings.priceUpdatedAt[plan.key].slice(0, 10)}</span>}
              </label>
            )}
          </div>
        ))}
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Upgrade contact — customers press «Написать о тарифе» on their plan page and open this link (until online payment exists)</span>
          <input value={contact} maxLength={300} placeholder="https://t.me/your_sales or mailto:sales@example.kz" onChange={(event) => setContact(event.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
          {!settings.salesContactUrl && <span className="catalog-note">{settings.salesContactFallback ? `Not set here; using SALES_CONTACT_URL from the server: ${settings.salesContactFallback}` : 'Not set: customers see the plans but no button to contact you.'}</span>}
        </label>
        {invalid && <p className="catalog-note" role="alert">{messages.INVALID_PRICE}</p>}
        <div><button type="button" disabled={busy || invalid} onClick={save}>{busy ? 'Saving…' : 'Save prices and contact'}</button></div>
      </div>
    </div>
  );
}
