'use client';

import { useCallback, useEffect, useState } from 'react';

type QueueRow = { id: string; status: string; kind: string; outcome: string | null; openedBySide: 'owner' | 'specialist'; claimAmount: number | null; createdAt: string; messages: number; project: string; stage: string; specialist: string };
type Detail = {
  id: string; kind: string; openedBySide: 'owner' | 'specialist'; claim: string; claimAmount: number | null; status: string; outcome: string | null; resolutionNote: string | null; resolvedAt: string | null; createdAt: string; paymentCreated: boolean;
  messages: Array<{ id: string; side: 'owner' | 'specialist' | 'staff'; text: string; createdAt: string }>;
  project: string; owner: string; specialist: string; stage: string; role: string;
  assignment: { status: string; acceptedAt: string | null; completedAt: string | null; revokedAt: string | null; payKind: string; fixedAmount: number | null; hourlyRate: number | null; hourLimit: number | null };
  payments: Array<{ id: string; basis: string; amount: number; status: string; createdAt: string; heldAt: string | null; paidOutAt: string | null }>;
  time: { minutesByStatus: Record<string, number>; entries: number; withoutActions: number };
  stageVersions: number;
  events: Array<{ type: string; createdAt: string; details: unknown; by: string }>;
};
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const messages: Record<string, string> = {
  STAFF_ROLE_REQUIRED: 'Only super admins can write and decide; operations auditors can read.',
  DISPUTE_CLOSED: 'This dispute is already closed.',
  DISPUTE_NOTE_REQUIRED: 'Explain the decision to both sides (10–1000 characters).',
  DISPUTE_OUTCOME_INVALID: 'Choose an outcome.',
  DISPUTE_PAYMENT_NOT_ALLOWED: 'A payment to the specialist can only follow a decision in their favour or a split.',
  DISPUTE_AMOUNT_INVALID: 'The amount must be a whole number of tenge.',
  DISPUTE_MESSAGE_INVALID: 'A message must be 2–2000 characters.',
  DISPUTE_TOO_MANY_MESSAGES: 'The thread has reached its message limit; decide the dispute.',
};
const kinds: Record<string, string> = { payment: 'Specialist: not paid', refund: 'Owner: wants money back', quality: 'Owner: work not as agreed', other: 'Other' };
const outcomes: Array<[string, string]> = [['specialist', 'In the specialist’s favour'], ['owner', 'In the owner’s favour'], ['split', 'Split'], ['no_change', 'No change']];
const money = (value: number | null) => (value === null ? '—' : `${value.toLocaleString('ru-RU')} ₸`);
const hours = (minutes: number) => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, { credentials: 'include', cache: 'no-store', ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => null) as { data?: T; message?: string } | null;
  if (response.status === 401) throw new Error('Sign in as staff first.');
  if (!response.ok || !payload || !('data' in payload)) throw new Error(messages[payload?.message ?? ''] ?? `Request failed (${response.status}).`);
  return payload.data as T;
}

/**
 * Disputes between owners and specialists. While a dispute is open, the payout for that stage is blocked. A decision is
 * final for the platform and is sent to both sides; it can add an amount the owner owes the specialist. Money already
 * held for the specialist goes back to the owner with «Return to owner…» in Specialist payouts.
 */
export default function Disputes() {
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [message, setMessage] = useState('');
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [pay, setPay] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => { setError(''); call<QueueRow[]>(`/admin/disputes?status=${status}`).then(setRows).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load disputes.')); }, [status]);
  useEffect(() => {
    load();
    window.addEventListener('buildpath:staff-session-changed', load);
    return () => window.removeEventListener('buildpath:staff-session-changed', load);
  }, [load]);

  async function act(work: () => Promise<void>) {
    setBusy(true); setError('');
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed.'); } finally { setBusy(false); }
  }
  const openDetail = (id: string) => act(async () => { setDetail(await call<Detail>(`/admin/disputes/${id}`)); setOutcome(''); setNote(''); setPay(''); setMessage(''); });
  const send = () => act(async () => { setDetail(await call<Detail>(`/admin/disputes/${detail!.id}/messages`, { method: 'POST', body: JSON.stringify({ text: message.trim() }) })); setMessage(''); });
  const resolve = () => act(async () => {
    const amount = pay ? Number(pay) : null;
    const label = outcomes.find(([key]) => key === outcome)?.[1] ?? outcome;
    if (!window.confirm(`Decide «${label}»${amount ? ` and add ${money(amount)} owed to the specialist` : ''}? Both sides are notified; this cannot be undone.`)) return;
    setDetail(await call<Detail>(`/admin/disputes/${detail!.id}/resolve`, { method: 'POST', body: JSON.stringify({ outcome, note: note.trim(), paySpecialist: amount }) }));
    load();
  });

  const input = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, font: 'inherit' } as const;
  return (
    <div className="catalog">
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" aria-pressed={status === 'open'} onClick={() => { setStatus('open'); setDetail(null); }}>Open</button>
        <button type="button" aria-pressed={status === 'closed'} onClick={() => { setStatus('closed'); setDetail(null); }}>Closed</button>
      </div>
      {error && <div className="catalog-state catalog-error" role="alert">{error}</div>}
      {!rows && !error && <div className="catalog-state">Loading…</div>}
      {rows && rows.length === 0 && <div className="catalog-state">{status === 'open' ? 'No open disputes.' : 'No closed disputes yet.'}</div>}
      {rows?.map((row) => (
        <button key={row.id} type="button" className="catalog-card" style={{ display: 'grid', gap: 4, textAlign: 'left', width: '100%' }} onClick={() => void openDetail(row.id)} aria-expanded={detail?.id === row.id}>
          <strong>{kinds[row.kind] ?? row.kind}{row.claimAmount !== null ? ` · ${money(row.claimAmount)}` : ''}</strong>
          <span className="catalog-note">{row.project} · {row.stage} · specialist {row.specialist} · opened by {row.openedBySide} {row.createdAt.slice(0, 10)} · {row.messages} messages{row.outcome ? ` · ${row.outcome}` : ''}</span>
        </button>
      ))}
      {detail && (
        <div className="catalog-card" style={{ display: 'grid', gap: 10 }}>
          <strong>{kinds[detail.kind] ?? detail.kind} — {detail.project} · {detail.stage}</strong>
          <span className="catalog-note">Owner {detail.owner} · specialist {detail.specialist} ({detail.role}) · opened by the {detail.openedBySide} on {detail.createdAt.slice(0, 10)} · claim {money(detail.claimAmount)} · status {detail.status}</span>
          <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: '3px solid var(--line)', whiteSpace: 'pre-line' }}>{detail.claim}</blockquote>

          <details open><summary>Evidence</summary>
            <ul>
              <li>Terms: {detail.assignment.payKind === 'fixed' ? `fixed ${money(detail.assignment.fixedAmount)}` : detail.assignment.payKind === 'hourly' ? `${money(detail.assignment.hourlyRate)}/h, limit ${detail.assignment.hourLimit ?? '—'} h` : 'settled outside BuildPath'}</li>
              <li>Assignment: {detail.assignment.status}; accepted {detail.assignment.acceptedAt?.slice(0, 10) ?? '—'}; stage accepted {detail.assignment.completedAt?.slice(0, 10) ?? '—'}{detail.assignment.revokedAt ? `; access revoked ${detail.assignment.revokedAt.slice(0, 10)}` : ''}</li>
              <li>Stage versions: {detail.stageVersions}</li>
              <li>Time: {Object.entries(detail.time.minutesByStatus).map(([key, value]) => `${key} ${hours(value)}`).join(', ') || 'none'} · {detail.time.entries} intervals, {detail.time.withoutActions} without actions</li>
              <li>Payments: {detail.payments.length ? detail.payments.map((payment) => `${money(payment.amount)} ${payment.basis} — ${payment.status}`).join('; ') : 'none'}</li>
            </ul>
            <details><summary>Stage history ({detail.events.length})</summary>
              <ul>{detail.events.map((event, index) => <li key={index}><code>{event.createdAt.slice(0, 16).replace('T', ' ')}</code> {event.type} · {event.by}</li>)}</ul>
            </details>
          </details>

          <div>
            <strong>Thread</strong>
            {detail.messages.length === 0 && <p className="catalog-note">No messages yet.</p>}
            <ul>{detail.messages.map((item) => <li key={item.id}><strong>{item.side}:</strong> <span style={{ whiteSpace: 'pre-line' }}>{item.text}</span> <span className="catalog-note">{item.createdAt.slice(0, 10)}</span></li>)}</ul>
          </div>

          {detail.status === 'open' ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input style={{ ...input, flex: '1 1 320px' }} placeholder="Message to both sides" maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} />
                <button type="button" disabled={busy || message.trim().length < 2} onClick={() => void send()}>Send</button>
              </div>
              <fieldset style={{ border: '1px solid var(--line)', borderRadius: 8, display: 'grid', gap: 8 }}>
                <legend>Decision</legend>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {outcomes.map(([key, label]) => <label key={key}><input type="radio" name="outcome" checked={outcome === key} onChange={() => { setOutcome(key); if (key !== 'specialist' && key !== 'split') setPay(''); }} /> {label}</label>)}
                </div>
                <textarea style={{ ...input, minHeight: 80 }} placeholder="Explanation sent to both sides" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
                {(outcome === 'specialist' || outcome === 'split') && (
                  <label>Add an amount the owner owes the specialist, ₸ (optional){' '}
                    <input style={input} inputMode="numeric" value={pay} maxLength={9} onChange={(event) => setPay(event.target.value.replace(/\D/g, ''))} />
                  </label>
                )}
                <span className="catalog-note">To return money already held for the specialist, decide here, then use «Return to owner…» in Specialist payouts.</span>
                <div><button type="button" disabled={busy || !outcome || note.trim().length < 10} onClick={() => void resolve()}>Decide</button></div>
              </fieldset>
            </>
          ) : (
            <p><strong>Decision:</strong> {detail.outcome ?? detail.status} {detail.resolvedAt ? `(${detail.resolvedAt.slice(0, 10)})` : ''}. {detail.resolutionNote}{detail.paymentCreated ? ' An amount owed to the specialist was added.' : ''}</p>
          )}
        </div>
      )}
    </div>
  );
}
