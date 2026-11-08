'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';\nimport type { FormEvent } from 'react';

type CapabilityStatus = 'supported' | 'limited' | 'docs_only' | 'unsupported';
type Capability = { id: string; category: string; name: string; status: CapabilityStatus; summary: string; conditions: string[] };
type CapabilityManifest = { revision: string; statuses: Array<{ id: CapabilityStatus; label: string; description: string }>; capabilities: Capability[] };
type Staff = { id: string; email: string; displayName: string; role: 'super_admin' | 'quality_admin' | 'operations_auditor' };
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const statusLabels: Record<CapabilityStatus, string> = { supported: 'Supported', limited: 'Limited', docs_only: 'Docs only', unsupported: 'Unavailable' };
const roleLabels: Record<Staff['role'], string> = { super_admin: 'Super admin', quality_admin: 'Quality admin', operations_auditor: 'Operations auditor' };

export default function CapabilityCatalog() {
  const [manifest, setManifest] = useState<CapabilityManifest | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<CapabilityStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loadPrivateCatalog = useCallback(async () => {
    const response = await fetch(API_BASE_URL + '/admin/capabilities', { cache: 'no-store', credentials: 'include', headers: { Accept: 'application/json' } });
    if (response.status === 401) { setStaff(null); setManifest(null); return; }
    if (response.status === 403) throw new Error('Your staff role does not have access to the capability catalog.');
    if (!response.ok) throw new Error('The admin API returned ' + response.status + '.');
    const payload = await response.json() as { data?: CapabilityManifest };
    if (!payload.data || !Array.isArray(payload.data.capabilities) || !Array.isArray(payload.data.statuses)) throw new Error('The API returned an invalid capability manifest.');
    setManifest(payload.data);
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(API_BASE_URL + '/admin/auth/me', { cache: 'no-store', credentials: 'include', headers: { Accept: 'application/json' } });
      if (response.status === 401) { setStaff(null); setManifest(null); return; }
      if (!response.ok) throw new Error('The admin API returned ' + response.status + '.');
      const payload = await response.json() as { data?: Staff };
      if (!payload.data) throw new Error('The API returned an invalid staff identity.');
      setStaff(payload.data);
      await loadPrivateCatalog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reach the admin API. Check NEXT_PUBLIC_API_BASE_URL and API availability.');
    } finally { setLoading(false); }
  }, [loadPrivateCatalog]);

  useEffect(() => { void refreshSession(); }, [refreshSession]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      const response = await fetch(API_BASE_URL + '/admin/auth/login', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (response.status === 401) throw new Error('Email or password is incorrect.');
      if (response.status === 429) throw new Error('Too many attempts. Wait 15 minutes before trying again.');
      if (!response.ok) throw new Error('Sign in failed (' + response.status + ').');
      setPassword('');
      await refreshSession();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in failed.'); }
    finally { setSubmitting(false); }
  }

  async function logout() {
    try { await fetch(API_BASE_URL + '/admin/auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store' }); }
    finally { setStaff(null); setManifest(null); setError(''); }
  }

  const counts = useMemo(() => {
    const result: Record<CapabilityStatus, number> = { supported: 0, limited: 0, docs_only: 0, unsupported: 0 };
    for (const item of manifest?.capabilities ?? []) result[item.status] += 1;
    return result;
  }, [manifest]);
  const visible = useMemo(() => (manifest?.capabilities ?? []).filter((item) => filter === 'all' || item.status === filter), [filter, manifest]);

  if (loading) return <div className="catalog-state" role="status">Loading staff session…</div>;
  if (!staff) return <section className="admin-login" aria-labelledby="staff-login-heading">
    <p className="kicker">STAFF ACCESS</p><h2 id="staff-login-heading">Sign in to the admin console</h2>
    <p>Use the staff account provisioned for this deployment. Customer accounts cannot access the admin console.</p>
    {error && <div className="catalog-state catalog-error" role="alert">{error}</div>}
    <form onSubmit={login}>
      <label htmlFor="staff-email">Work email</label>
      <input id="staff-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
      <label htmlFor="staff-password">Password</label>
      <input id="staff-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} />
      <button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in securely'}</button>
    </form>
  </section>;

  if (error && !manifest) return <div className="catalog-state catalog-error" role="alert"><strong>Catalog unavailable</strong><p>{error}</p><button type="button" onClick={() => void refreshSession()}>Try again</button></div>;
  if (!manifest) return null;

  return <section className="catalog" aria-label="Platform capability catalog">
    <div className="staff-session"><span>Signed in as <strong>{staff.displayName}</strong> · {roleLabels[staff.role]}</span><button type="button" onClick={() => void logout()}>Sign out</button></div>
    <div className="catalog-meta"><span>Manifest <strong>v{manifest.revision}</strong></span><span>{manifest.capabilities.length} capabilities</span></div>
    <div className="catalog-summary" aria-label="Capability counts">{manifest.statuses.map((status) => <div key={status.id} data-status={status.id}><strong>{counts[status.id]}</strong><span>{statusLabels[status.id]}</span></div>)}</div>
    <div className="catalog-filters" role="group" aria-label="Filter capabilities by status">
      <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All · {manifest.capabilities.length}</button>
      {manifest.statuses.map((status) => <button key={status.id} type="button" aria-pressed={filter === status.id} onClick={() => setFilter(status.id)}>{statusLabels[status.id]} · {counts[status.id]}</button>)}
    </div>
    <div className="catalog-grid">{visible.map((item) => <article className="catalog-card" key={item.id}>
      <div className="catalog-card-heading"><span className="catalog-category">{item.category}</span><span className="catalog-status" data-status={item.status}>{statusLabels[item.status]}</span></div>
      <h3>{item.name}</h3><p>{item.summary}</p>
      {item.conditions.length > 0 && <details><summary>Scope and conditions</summary><ul>{item.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></details>}
    </article>)}</div>
    <p className="catalog-note">Statuses are factual implementation signals. “Supported” does not replace project-specific testing or approval.</p>
  </section>;
}
