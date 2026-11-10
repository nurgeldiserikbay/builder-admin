'use client';

import { useEffect, useState } from 'react';

type Pricing = { inputPerMillion: number; outputPerMillion: number; updatedAt: string; typicalRequest: { input: number; output: number; basedOn: number } } | null;
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const messages: Record<string, string> = { INVALID_PRICE: 'Prices must be numbers from 0 to 1 000 000 ₸ per million tokens.', STAFF_ROLE_REQUIRED: 'Only super admins can change prices; operations auditors can view them.' };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, { credentials: 'include', cache: 'no-store', ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => null) as { data?: T; message?: string } | null;
  if (response.status === 401) throw new Error('Sign in as staff first.');
  if (!response.ok || !payload || !('data' in payload)) throw new Error(messages[payload?.message ?? ''] ?? `Request failed (${response.status}).`);
  return payload.data as T;
}

/** Customer prices for AI usage. Each request stores its own cost, so a change affects new requests only. */
export default function AiPricing() {
  const [pricing, setPricing] = useState<Pricing | undefined>(undefined);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  function apply(next: Pricing) { setPricing(next); setInput(next ? String(next.inputPerMillion) : ''); setOutput(next ? String(next.outputPerMillion) : ''); }
  useEffect(() => {
    const load = () => { setError(''); call<Pricing>('/admin/ai-pricing').then(apply).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load prices.')); };
    load();
    window.addEventListener('buildpath:staff-session-changed', load);
    return () => window.removeEventListener('buildpath:staff-session-changed', load);
  }, []);

  const inputValue = Number(input.replace(',', '.'));
  const outputValue = Number(output.replace(',', '.'));
  const invalid = !input || !output || !Number.isFinite(inputValue) || !Number.isFinite(outputValue) || inputValue < 0 || outputValue < 0;
  const typical = pricing?.typicalRequest ?? { input: 4000, output: 1500, basedOn: 0 };
  const perRequest = invalid ? null : (typical.input * inputValue + typical.output * outputValue) / 1_000_000;

  async function save() {
    if (invalid || !window.confirm(`Customers will pay ${inputValue} ₸ per million input tokens and ${outputValue} ₸ per million output tokens for new AI requests. Past requests keep their cost. Continue?`)) return;
    setBusy(true); setError(''); setSaved('');
    try { apply(await call<Pricing>('/admin/ai-pricing', { method: 'POST', body: JSON.stringify({ inputPerMillion: inputValue, outputPerMillion: outputValue }) })); setSaved('Saved and recorded in the audit history.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Save failed.'); } finally { setBusy(false); }
  }

  if (pricing === undefined && !error) return <div className="catalog"><div className="catalog-state">Loading…</div></div>;
  const field = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, width: 120 } as const;
  return (
    <div className="catalog">
      {error && <div className="catalog-state catalog-error" role="alert">{error}</div>}
      {saved && <div className="catalog-state" role="status">{saved}</div>}
      <div className="catalog-card" style={{ display: 'grid', gap: 10 }}>
        {pricing === null && <p className="catalog-note">No prices yet: customers see AI requests without a cost and projects have no estimate.</p>}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span>₸ per million input tokens</span><input inputMode="decimal" value={input} onChange={(event) => setInput(event.target.value)} style={field} /></label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span>₸ per million output tokens</span><input inputMode="decimal" value={output} onChange={(event) => setOutput(event.target.value)} style={field} /></label>
        <p className="catalog-note">
          Include the provider price, taxes and the platform margin. A typical stage request ({typical.input.toLocaleString('en')} in / {typical.output.toLocaleString('en')} out tokens{typical.basedOn ? `, average of ${typical.basedOn} recent requests` : ', default until there are 20 recent requests'}) would cost the customer {perRequest === null ? '—' : `${perRequest.toFixed(2)} ₸`}.
          {pricing?.updatedAt ? ` Last changed ${pricing.updatedAt.slice(0, 10)}.` : ''}
        </p>
        <div><button type="button" disabled={busy || invalid} onClick={save}>{busy ? 'Saving…' : 'Save prices'}</button></div>
      </div>
    </div>
  );
}
