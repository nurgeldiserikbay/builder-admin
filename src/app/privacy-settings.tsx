'use client';

import { useEffect, useState } from 'react';

type Settings = { accountRetentionDays: number; minDays: number; maxDays: number; pendingDeletions: number; updatedAt: string | null; legalVersions: { terms: string; privacy: string } };
type Status = { userId: string; email: string; deletionRequestedAt: string | null; purgeAfter: string | null; consent: { termsVersion: string; privacyVersion: string; acceptedAt: string } | null };

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const messages: Record<string, string> = {
  INVALID_RETENTION_DAYS: 'Retention must be a whole number of days from 1 to 90.',
  STAFF_ROLE_REQUIRED: 'Only super admins can change this; operations auditors can view it.',
  ACCOUNT_NOT_FOUND: 'No customer account with this e-mail (it may already be purged).',
  ACCOUNT_NOT_DELETED: 'This account is not waiting for deletion.',
  INVALID_EMAIL: 'Enter a valid e-mail.',
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, { credentials: 'include', cache: 'no-store', ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => null) as { data?: T; message?: string } | null;
  if (response.status === 401) throw new Error('Sign in as staff first.');
  if (!response.ok || !payload?.data) throw new Error(messages[payload?.message ?? ''] ?? `Request failed (${response.status}).`);
  return payload.data;
}

const day = (value: string) => value.slice(0, 10);

/** Retention period after self-service account deletion, and restore within that period. */
export default function PrivacySettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [days, setDays] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  function apply(next: Settings) { setSettings(next); setDays(String(next.accountRetentionDays)); }

  useEffect(() => {
    const load = () => {
      setError(''); setSaved('');
      call<Settings>('/admin/privacy-settings').then(apply).catch((cause) => { setSettings(null); setError(cause instanceof Error ? cause.message : 'Could not load settings.'); });
    };
    load();
    window.addEventListener('buildpath:staff-session-changed', load);
    return () => window.removeEventListener('buildpath:staff-session-changed', load);
  }, []);

  const parsed = Number(days);
  const invalid = !settings || !Number.isInteger(parsed) || parsed < settings.minDays || parsed > settings.maxDays;

  async function save() {
    if (invalid || !settings || parsed === settings.accountRetentionDays) return;
    const shorter = parsed < settings.accountRetentionDays && settings.pendingDeletions > 0;
    if (!window.confirm(`Keep data of deleted accounts for ${parsed} days.${shorter ? ` ${settings.pendingDeletions} account(s) already waiting will be purged sooner — accounts past the new period are purged within the hour.` : ''} The privacy policy shown to customers updates immediately. Continue?`)) return;
    setBusy(true); setError(''); setSaved('');
    try {
      apply(await call<Settings>('/admin/privacy-settings', { method: 'POST', body: JSON.stringify({ accountRetentionDays: parsed }) }));
      setSaved('Saved and recorded in the audit history.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Save failed.'); } finally { setBusy(false); }
  }

  async function lookup() {
    setBusy(true); setError(''); setSaved(''); setStatus(null);
    try { setStatus(await call<Status>(`/admin/accounts/status?email=${encodeURIComponent(email.trim())}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Lookup failed.'); } finally { setBusy(false); }
  }

  async function restore() {
    if (!status || !window.confirm(`Restore ${status.email}? The customer can sign in again. Sites stay unpublished and specialists are not re-invited — the customer does that.`)) return;
    setBusy(true); setError(''); setSaved('');
    try {
      setStatus(await call<Status>('/admin/accounts/restore', { method: 'POST', body: JSON.stringify({ email: status.email }) }));
      setSaved('Account restored and recorded in the audit history.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Restore failed.'); } finally { setBusy(false); }
  }

  if (!settings) return <div className="catalog">{error ? <div className="catalog-state catalog-error" role="alert">{error}</div> : <div className="catalog-state">Loading…</div>}</div>;
  const input = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 } as const;
  return (
    <div className="catalog">
      {error && <div className="catalog-state catalog-error" role="alert">{error}</div>}
      {saved && <div className="catalog-state" role="status">{saved}</div>}
      <div className="catalog-card" style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Keep data after deletion, days</span>
          <input inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value)} style={{ ...input, width: 90 }} />
          <span className="catalog-note">{settings.minDays}–{settings.maxDays}; {settings.updatedAt ? `changed ${day(settings.updatedAt)}` : 'default'}</span>
        </label>
        <p className="catalog-note">Sites, sessions, Telegram and specialist access are closed at the moment of deletion. This period only decides when the rest is purged (checked hourly). It applies to accounts already waiting too: {settings.pendingDeletions} now. Legal documents in force: offer {settings.legalVersions.terms}, privacy policy {settings.legalVersions.privacy}.</p>
        {invalid && <p className="catalog-note" role="alert">{messages.INVALID_RETENTION_DAYS}</p>}
        <div><button type="button" disabled={busy || invalid || parsed === settings.accountRetentionDays} onClick={save}>{busy ? 'Saving…' : 'Save retention'}</button></div>
      </div>
      <div className="catalog-card" style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Customer e-mail</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={{ ...input, minWidth: 240 }} />
          <button type="button" disabled={busy || email.trim().length < 3} onClick={lookup}>Look up</button>
        </label>
        {status && <div style={{ display: 'grid', gap: 6 }}>
          <strong>{status.email}</strong>
          <span className="catalog-note">{status.deletionRequestedAt ? `Deleted ${day(status.deletionRequestedAt)}; purged after ${status.purgeAfter ? day(status.purgeAfter) : '—'}.` : 'Active account.'}</span>
          <span className="catalog-note">{status.consent ? `Accepted offer ${status.consent.termsVersion} and privacy policy ${status.consent.privacyVersion} on ${day(status.consent.acceptedAt)}.` : 'No recorded consent (registered before consent was introduced; asked on next sign-in).'}</span>
          {status.deletionRequestedAt && <div><button type="button" disabled={busy} onClick={restore}>Restore account</button></div>}
        </div>}
      </div>
    </div>
  );
}
