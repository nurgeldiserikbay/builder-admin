'use client';

import { useEffect, useState } from 'react';

type Item = {
  id: string; project: string; owner: string; provider: string; providerPaymentId: string | null; paidAt: string | null; amount: number; refunded: number; requested: number | null;
  status: 'requested' | 'refunded' | 'rejected'; reason: string | null; requestedAt: string | null; decidedAt: string | null; reference: string | null; note: string | null; automatic: boolean;
};
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const messages: Record<string, string> = {
  REFUND_REFERENCE_REQUIRED: 'This provider has no automatic refund here: refund in its merchant cabinet first, then enter the refund reference.',
  REFUND_NOTE_REQUIRED: 'A rejection needs a note — the owner sees it.',
  REFUND_NOT_REQUESTED: 'This request was already decided or withdrawn.',
  STAFF_ROLE_REQUIRED: 'Only super admins can decide refunds.',
};
const money = (value: number) => `${value.toLocaleString('ru-RU')} ₸`;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, { credentials: 'include', cache: 'no-store', ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => null) as { data?: T; message?: string } | null;
  if (response.status === 401) throw new Error('Sign in as staff first.');
  if (!response.ok || !payload || !('data' in payload)) throw new Error(messages[payload?.message ?? ''] ?? `Request failed (${response.status}).`);
  return payload.data as T;
}

/** Owners' requests to return unspent balance. Test payments refund at once; a real provider needs the cabinet refund reference. */
export default function Refunds() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  useEffect(() => {
    const load = () => { setError(''); call<{ items: Item[] }>('/admin/refunds').then((data) => setItems(data.items)).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load refunds.')); };
    load();
    window.addEventListener('buildpath:staff-session-changed', load);
    return () => window.removeEventListener('buildpath:staff-session-changed', load);
  }, []);

  async function decide(item: Item, decision: 'refund' | 'reject') {
    const text = (inputs[item.id] ?? '').trim();
    const question = decision === 'refund' ? `Refund ${money(item.requested ?? 0)} to ${item.owner}?` : `Reject the refund of ${money(item.requested ?? 0)}? The note is shown to the owner.`;
    if (!window.confirm(question)) return;
    setBusy(item.id); setError('');
    try {
      const body = decision === 'refund' ? { decision, reference: item.automatic ? null : text || null } : { decision, note: text || null };
      setItems((await call<{ items: Item[] }>(`/admin/refunds/${item.id}`, { method: 'POST', body: JSON.stringify(body) })).items);
      setInputs((current) => ({ ...current, [item.id]: '' }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed.'); } finally { setBusy(''); }
  }

  if (!items && !error) return <div className="catalog"><div className="catalog-state">Loading…</div></div>;
  const waiting = (items ?? []).filter((item) => item.status === 'requested');
  const decided = (items ?? []).filter((item) => item.status !== 'requested');
  return (
    <div className="catalog">
      {error && <div className="catalog-state catalog-error" role="alert">{error}</div>}
      {items && waiting.length === 0 && <div className="catalog-state">No refund requests waiting.</div>}
      {waiting.map((item) => (
        <div key={item.id} className="catalog-card" style={{ display: 'grid', gap: 6 }}>
          <strong>{money(item.requested ?? 0)} → {item.owner}</strong>
          <span className="catalog-note">{item.project} · top-up {money(item.amount)}{item.refunded ? `, already returned ${money(item.refunded)}` : ''} · {item.provider}{item.providerPaymentId ? ` ${item.providerPaymentId}` : ''}{item.requestedAt ? ` · asked ${item.requestedAt.slice(0, 10)}` : ''}</span>
          {item.reason && <span className="catalog-note">Reason: {item.reason}</span>}
          <span className="catalog-note">{item.automatic ? 'Test payment: «Refund» returns it at once.' : 'Refund in the provider cabinet first, then enter its reference.'}</span>
          <input placeholder={item.automatic ? 'Note (needed to reject)' : 'Refund reference, or a note to reject'} value={inputs[item.id] ?? ''} maxLength={300}
            onChange={(event) => setInputs((current) => ({ ...current, [item.id]: event.target.value }))} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" disabled={Boolean(busy) || (!item.automatic && (inputs[item.id] ?? '').trim().length < 3)} onClick={() => void decide(item, 'refund')}>Refund</button>
            <button type="button" disabled={Boolean(busy) || (inputs[item.id] ?? '').trim().length < 3} onClick={() => void decide(item, 'reject')}>Reject</button>
          </div>
        </div>
      ))}
      {decided.length > 0 && (
        <details className="catalog-card"><summary>Decided ({decided.length})</summary>
          <ul>{decided.map((item) => <li key={item.id}>{item.decidedAt?.slice(0, 10)} · {item.project} · {item.status === 'refunded' ? `refunded ${money(item.refunded)} · ${item.reference}` : `rejected: ${item.note}`}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
