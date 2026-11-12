'use client';

import { useCallback, useEffect, useState } from 'react';

type Row = { id: string; rating: number; text: string | null; reply: string | null; status: 'pending' | 'kept' | 'hidden'; reason: string | null; reportedAt: string | null; note: string | null; createdAt: string; stage: string; project: string; specialist: string };
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const messages: Record<string, string> = {
  STAFF_ROLE_REQUIRED: 'Only super admins can decide; operations auditors can read.',
  MODERATION_NOTE_REQUIRED: 'Write the reason shown to the specialist and the author (5–500 characters).',
  REVIEW_NOT_REPORTED: 'This report was already decided.',
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, { credentials: 'include', cache: 'no-store', ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => null) as { data?: T; message?: string } | null;
  if (response.status === 401) throw new Error('Sign in as staff first.');
  if (!response.ok || !payload || !('data' in payload)) throw new Error(messages[payload?.message ?? ''] ?? `Request failed (${response.status}).`);
  return payload.data as T;
}

/** Reviews a specialist reported. Hide only reviews that break the rules (insults, personal data, another job) — not low but honest ratings. */
export default function Reviews() {
  const [status, setStatus] = useState<'pending' | 'decided'>('pending');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => { setError(''); call<Row[]>(`/admin/reviews?status=${status}`).then(setRows).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load reviews.')); }, [status]);
  useEffect(() => {
    load();
    window.addEventListener('buildpath:staff-session-changed', load);
    return () => window.removeEventListener('buildpath:staff-session-changed', load);
  }, [load]);

  async function decide(row: Row, decision: 'hide' | 'keep') {
    if (decision === 'hide' && !window.confirm('Hide this review? It leaves the card and the rating; the author cannot edit it any more.')) return;
    setBusy(row.id); setError('');
    try { setRows(await call<Row[]>(`/admin/reviews/${row.id}/decide`, { method: 'POST', body: JSON.stringify({ decision, note: (notes[row.id] ?? '').trim() }) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed.'); } finally { setBusy(''); }
  }

  return (
    <div className="catalog">
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" aria-pressed={status === 'pending'} onClick={() => setStatus('pending')}>Reported</button>
        <button type="button" aria-pressed={status === 'decided'} onClick={() => setStatus('decided')}>Decided</button>
      </div>
      {error && <div className="catalog-state catalog-error" role="alert">{error}</div>}
      {!rows && !error && <div className="catalog-state">Loading…</div>}
      {rows && rows.length === 0 && <div className="catalog-state">{status === 'pending' ? 'No reported reviews.' : 'Nothing decided yet.'}</div>}
      {rows?.map((row) => (
        <div key={row.id} className="catalog-card" style={{ display: 'grid', gap: 6 }}>
          <strong>{'★'.repeat(row.rating)}{'☆'.repeat(5 - row.rating)} — {row.specialist}</strong>
          <span className="catalog-note">{row.project} · {row.stage} · written {row.createdAt.slice(0, 10)}{row.reportedAt ? ` · reported ${row.reportedAt.slice(0, 10)}` : ''}</span>
          {row.text && <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: '3px solid var(--line)', whiteSpace: 'pre-line' }}>{row.text}</blockquote>}
          {row.reply && <span className="catalog-note">Specialist replied: {row.reply}</span>}
          <span><strong>Complaint:</strong> {row.reason}</span>
          {row.status === 'pending' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, flex: '1 1 280px' }} placeholder="Reason sent to both sides" maxLength={500}
                value={notes[row.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} />
              <button type="button" disabled={Boolean(busy) || (notes[row.id] ?? '').trim().length < 5} onClick={() => void decide(row, 'keep')}>Keep</button>
              <button type="button" disabled={Boolean(busy) || (notes[row.id] ?? '').trim().length < 5} onClick={() => void decide(row, 'hide')}>Hide</button>
            </div>
          ) : <span className="catalog-note">{row.status === 'hidden' ? 'Hidden' : 'Kept'}: {row.note}</span>}
        </div>
      ))}
    </div>
  );
}
