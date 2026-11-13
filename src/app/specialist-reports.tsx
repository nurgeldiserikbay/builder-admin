'use client';

import { useCallback, useEffect, useState } from 'react';

type Row = {
  id: string; target: 'card' | 'work'; reason: string; text: string; status: 'pending' | 'dismissed' | 'work_removed' | 'card_hidden'; note: string | null; createdAt: string; decidedAt: string | null;
  work: { title: string | null; url: string | null; stillShown: boolean } | null;
  profile: { id: string; displayName: string; headline: string; published: boolean; blocked: boolean };
};
type Decision = 'dismiss' | 'remove_work' | 'hide_card';
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const reasons: Record<string, string> = { not_theirs: 'Not their work', unsafe_link: 'Dangerous link', offensive: 'Insults or personal data', fake: 'Deception', other: 'Other' };
const outcomes: Record<string, string> = { dismissed: 'Dismissed', work_removed: 'Work removed', card_hidden: 'Card hidden' };
const messages: Record<string, string> = {
  STAFF_ROLE_REQUIRED: 'Only super admins can decide; operations auditors can read.',
  MODERATION_NOTE_REQUIRED: 'Write the reason sent to the specialist and the reporter (5–500 characters).',
  MODERATION_DECISION_INVALID: 'This decision does not fit the complaint.',
  REPORT_ALREADY_DECIDED: 'This complaint was already decided.',
  PROFILE_NOT_BLOCKED: 'The card is not hidden.',
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, { credentials: 'include', cache: 'no-store', ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => null) as { data?: T; message?: string } | null;
  if (response.status === 401) throw new Error('Sign in as staff first.');
  if (!response.ok || !payload || !('data' in payload)) throw new Error(messages[payload?.message ?? ''] ?? `Request failed (${response.status}).`);
  return payload.data as T;
}

/**
 * Complaints about specialist cards. Decide on the content: the complainant is not shown. The link in a work is
 * opened by you, not by the server — do it from an isolated browser if it may be unsafe.
 */
export default function SpecialistReports() {
  const [status, setStatus] = useState<'pending' | 'decided'>('pending');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const load = useCallback(() => { setError(''); call<Row[]>(`/admin/specialist-reports?status=${status}`).then(setRows).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load complaints.')); }, [status]);
  useEffect(() => {
    load();
    window.addEventListener('buildpath:staff-session-changed', load);
    return () => window.removeEventListener('buildpath:staff-session-changed', load);
  }, [load]);

  const note = (id: string) => (notes[id] ?? '').trim();
  async function decide(row: Row, decision: Decision) {
    const confirmText = decision === 'hide_card' ? `Hide the card of ${row.profile.displayName} from the catalog? They cannot publish it again until you restore it.` : decision === 'remove_work' ? `Remove the work “${row.work?.title ?? ''}” from the card?` : null;
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(row.id); setError(''); setDone('');
    try { setRows(await call<Row[]>(`/admin/specialist-reports/${row.id}/decide`, { method: 'POST', body: JSON.stringify({ decision, note: note(row.id) }) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed.'); } finally { setBusy(''); }
  }
  async function unblock(row: Row) {
    setBusy(row.id); setError(''); setDone('');
    try { await call(`/admin/specialist-profiles/${row.profile.id}/unblock`, { method: 'POST', body: JSON.stringify({ note: note(row.id) }) }); setDone(`${row.profile.displayName} can publish the card again.`); load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Failed.'); } finally { setBusy(''); }
  }

  return (
    <div className="catalog" style={{ marginTop: 24 }}>
      <h3 style={{ margin: 0 }}>Complaints about specialist cards</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" aria-pressed={status === 'pending'} onClick={() => setStatus('pending')}>Open</button>
        <button type="button" aria-pressed={status === 'decided'} onClick={() => setStatus('decided')}>Decided</button>
      </div>
      {error && <div className="catalog-state catalog-error" role="alert">{error}</div>}
      {done && <div className="catalog-state" role="status">{done}</div>}
      {!rows && !error && <div className="catalog-state">Loading…</div>}
      {rows && rows.length === 0 && <div className="catalog-state">{status === 'pending' ? 'No open complaints.' : 'Nothing decided yet.'}</div>}
      {rows?.map((row) => (
        <div key={row.id} className="catalog-card" style={{ display: 'grid', gap: 6 }}>
          <strong>{row.profile.displayName} — {reasons[row.reason] ?? row.reason}</strong>
          <span className="catalog-note">{row.profile.headline} · {row.profile.blocked ? 'hidden by support' : row.profile.published ? 'published' : 'not published'} · reported {row.createdAt.slice(0, 10)} · <a href={`${APP_URL}/specialists/${row.profile.id}`} target="_blank" rel="noopener noreferrer">open card</a></span>
          {row.work && (
            <span>
              <strong>Work:</strong> {row.work.title}{row.work.url ? <> · <code style={{ wordBreak: 'break-all' }}>{row.work.url}</code></> : null}
              {!row.work.stillShown && <span className="catalog-note"> (no longer on the card)</span>}
            </span>
          )}
          <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: '3px solid var(--line)', whiteSpace: 'pre-line' }}>{row.text}</blockquote>
          {row.status === 'pending' || row.profile.blocked ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, flex: '1 1 280px' }} placeholder={row.status === 'pending' ? 'Reason sent to the specialist and the reporter' : 'Why the card may be published again'} maxLength={500}
                value={notes[row.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} />
              {row.status === 'pending' && <>
                <button type="button" disabled={Boolean(busy) || note(row.id).length < 5} onClick={() => void decide(row, 'dismiss')}>Dismiss</button>
                {row.target === 'work' && <button type="button" disabled={Boolean(busy) || note(row.id).length < 5 || !row.work?.stillShown} onClick={() => void decide(row, 'remove_work')}>Remove work</button>}
                <button type="button" disabled={Boolean(busy) || note(row.id).length < 5} onClick={() => void decide(row, 'hide_card')}>Hide card</button>
              </>}
              {row.status !== 'pending' && row.profile.blocked && <button type="button" disabled={Boolean(busy) || note(row.id).length < 5} onClick={() => void unblock(row)}>Allow publishing again</button>}
            </div>
          ) : null}
          {row.status !== 'pending' && <span className="catalog-note">{outcomes[row.status]}{row.decidedAt ? ` ${row.decidedAt.slice(0, 10)}` : ''}: {row.note}</span>}
        </div>
      ))}
    </div>
  );
}
