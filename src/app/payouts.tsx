'use client';

import { useEffect, useState } from 'react';

type Row = {
  id: string; status: 'held' | 'paid_out'; amount: number; fee: number; payout: number; heldAt: string | null; paidOutAt: string | null; reference: string | null;
  project: string; stage: string; specialist: string; account: { holderName: string; ibanHint: string } | null;
};
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const messages: Record<string, string> = {
  PAYOUT_DETAILS_MISSING: 'The specialist has not saved a payout account yet. They see a form on the stage page.',
  PAYOUT_REFERENCE_INVALID: 'Enter the transfer reference from the bank (3–100 characters).',
  PAYMENT_NOT_HELD: 'This payment is no longer waiting for a transfer.',
  STAFF_ROLE_REQUIRED: 'Only super admins can see accounts and record payouts.',
};
const money = (value: number) => `${value.toLocaleString('ru-RU')} ₸`;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, { credentials: 'include', cache: 'no-store', ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => null) as { data?: T; message?: string } | null;
  if (response.status === 401) throw new Error('Sign in as staff first.');
  if (!response.ok || !payload || !('data' in payload)) throw new Error(messages[payload?.message ?? ''] ?? `Request failed (${response.status}).`);
  return payload.data as T;
}

/**
 * Money owners paid through BuildPath for specialists. Staff make the bank transfer themselves, then record its reference:
 * BuildPath never moves money on its own. Seeing a full IBAN is audited.
 */
export default function Payouts() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<Record<string, { holderName: string; iban: string }>>({});
  const [references, setReferences] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  useEffect(() => {
    const load = () => { setError(''); call<Row[]>('/admin/payouts').then(setRows).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load payouts.')); };
    load();
    window.addEventListener('buildpath:staff-session-changed', load);
    return () => window.removeEventListener('buildpath:staff-session-changed', load);
  }, []);

  async function act(id: string, work: () => Promise<void>) {
    setBusy(id); setError('');
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed.'); } finally { setBusy(''); }
  }
  const reveal = (row: Row) => act(row.id, async () => {
    const account = await call<{ holderName: string; iban: string }>(`/admin/payouts/${row.id}/account`, { method: 'POST' });
    setAccounts((current) => ({ ...current, [row.id]: account }));
  });
  const paidOut = (row: Row) => act(row.id, async () => {
    const reference = (references[row.id] ?? '').trim();
    if (!window.confirm(`Record that ${money(row.payout)} was transferred to ${row.account?.holderName ?? row.specialist} (reference ${reference})? The specialist will be notified.`)) return;
    setRows(await call<Row[]>(`/admin/payouts/${row.id}/paid-out`, { method: 'POST', body: JSON.stringify({ reference }) }));
  });

  if (!rows && !error) return <div className="catalog"><div className="catalog-state">Loading…</div></div>;
  const held = (rows ?? []).filter((row) => row.status === 'held');
  const done = (rows ?? []).filter((row) => row.status === 'paid_out');
  return (
    <div className="catalog">
      {error && <div className="catalog-state catalog-error" role="alert">{error}</div>}
      {rows && held.length === 0 && <div className="catalog-state">Nothing is waiting for a transfer.</div>}
      {held.map((row) => (
        <div key={row.id} className="catalog-card" style={{ display: 'grid', gap: 6 }}>
          <strong>{money(row.payout)} → {row.specialist}</strong>
          <span className="catalog-note">{row.project} · {row.stage} · owner paid {money(row.amount)}{row.fee ? `, BuildPath fee ${money(row.fee)}` : ''}{row.heldAt ? ` · ${row.heldAt.slice(0, 10)}` : ''}</span>
          {!row.account && <span className="catalog-note">No payout account yet.</span>}
          {row.account && !accounts[row.id] && <div><button type="button" disabled={Boolean(busy)} onClick={() => void reveal(row)}>Show account …{row.account.ibanHint} (audited)</button></div>}
          {accounts[row.id] && <code style={{ userSelect: 'all' }}>{accounts[row.id]!.iban} · {accounts[row.id]!.holderName}</code>}
          {row.account && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input placeholder="Bank transfer reference" value={references[row.id] ?? ''} maxLength={100} onChange={(event) => setReferences((current) => ({ ...current, [row.id]: event.target.value }))}
                style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, minWidth: 220 }} />
              <button type="button" disabled={Boolean(busy) || (references[row.id] ?? '').trim().length < 3} onClick={() => void paidOut(row)}>Mark transferred</button>
            </div>
          )}
        </div>
      ))}
      {done.length > 0 && (
        <details className="catalog-card"><summary>Recent payouts ({done.length})</summary>
          <ul>{done.map((row) => <li key={row.id}>{row.paidOutAt?.slice(0, 10)} · {money(row.payout)} → {row.specialist} · {row.reference}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
