'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type Severity = 'critical' | 'high' | 'medium' | 'low';
type CategoryId = 'security' | 'accessibility' | 'performance' | 'seo';
type CategoryPolicy = { enabled: boolean; required: boolean; maxOpenCritical: number; maxOpenHigh: number };
type QualityPolicy = { schemaVersion: 1; minimumRequirementCoverage: number; blockingSeverities: Severity[]; categories: Record<CategoryId, CategoryPolicy> };
type Version = { version: number; status: 'draft' | 'active' | 'retired'; policy: QualityPolicy; createdAt: string; activatedAt: string | null; authoredBy: string | null };
type Profile = { key: string; name: string; description: string; isDefault: boolean; createdAt: string; createdBy: string; versions: Version[] };
type ProfileListResponse = { data?: Profile[] };
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const categories: Array<{ id: CategoryId; label: string }> = [
  { id: 'security', label: 'Security' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'performance', label: 'Performance' },
  { id: 'seo', label: 'SEO' },
];
const severities: Severity[] = ['critical', 'high', 'medium', 'low'];
const emptyPolicy: QualityPolicy = {
  schemaVersion: 1,
  minimumRequirementCoverage: 100,
  blockingSeverities: ['critical', 'high'],
  categories: {
    security: { enabled: true, required: true, maxOpenCritical: 0, maxOpenHigh: 0 },
    accessibility: { enabled: true, required: true, maxOpenCritical: 0, maxOpenHigh: 0 },
    performance: { enabled: true, required: true, maxOpenCritical: 0, maxOpenHigh: 0 },
    seo: { enabled: true, required: true, maxOpenCritical: 0, maxOpenHigh: 0 },
  },
};
const statusText: Record<Version['status'], string> = { draft: 'Draft', active: 'Active', retired: 'Retired' };

export default function QualityProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [draftPolicy, setDraftPolicy] = useState<QualityPolicy | null>(null);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(API_BASE_URL + '/admin/quality-profiles', { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } });
      if (response.status === 401) { setAuthorized(false); setProfiles([]); return; }
      if (response.status === 403) throw new Error('Your staff role cannot read quality profiles.');
      if (!response.ok) throw new Error('Could not load profiles (' + response.status + ').');
      const result = await response.json() as ProfileListResponse;
      if (!Array.isArray(result.data)) throw new Error('The API returned an invalid profile list.');
      setProfiles(result.data);
      setAuthorized(true);
      setSelectedKey((current) => current && result.data!.some((item) => item.key === current) ? current : (result.data![0]?.key ?? ''));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reach the admin API.');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onSessionChange = () => { void refresh(); };
    window.addEventListener('buildpath:staff-session-changed', onSessionChange);
    return () => window.removeEventListener('buildpath:staff-session-changed', onSessionChange);
  }, [refresh]);

  const selected = useMemo(() => profiles.find((item) => item.key === selectedKey) ?? null, [profiles, selectedKey]);
  const currentDraft = selected?.versions.find((item) => item.status === 'draft') ?? null;

  function editPolicy(policy: QualityPolicy, version: number) {
    setDraftPolicy(structuredClone(policy));
    setDraftVersion(version);
  }

  async function runAction(action: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); setMessage(success); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The action could not be completed.'); }
    finally { setBusy(false); }
  }

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(async () => {
      const response = await fetch(API_BASE_URL + '/admin/quality-profiles', {
        method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, policy: emptyPolicy }),
      });
      if (!response.ok) throw new Error(response.status === 403 ? 'Your role cannot create profiles.' : 'Could not create profile (' + response.status + ').');
      const result = await response.json() as { data?: { key?: string; version?: Version } };
      setName(''); setDescription('');
      if (result.data?.key && result.data.version) { setSelectedKey(result.data.key); editPolicy(result.data.version.policy, result.data.version.version); }
    }, 'Draft profile created. Review the policy and activate it when it is ready.');
  }

  async function setDefault() {
    if (!selected) return;
    await runAction(async () => {
      const response = await fetch(API_BASE_URL + '/admin/quality-profiles/' + encodeURIComponent(selected.key) + '/default', { method: 'PUT', credentials: 'include' });
      if (!response.ok) throw new Error(response.status === 403 ? 'Your role cannot change the default profile.' : 'Could not set default profile (' + response.status + ').');
    }, selected.name + ' is now the default for new reviews.');
  }

  async function createVersion() {
    if (!selected) return;
    await runAction(async () => {
      const response = await fetch(API_BASE_URL + '/admin/quality-profiles/' + encodeURIComponent(selected.key) + '/versions', { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error(response.status === 409 ? 'A draft already exists for this profile.' : 'Could not create draft (' + response.status + ').');
      const result = await response.json() as { data?: { version?: Version } };
      if (result.data?.version) editPolicy(result.data.version.policy, result.data.version.version);
    }, 'A new draft was copied from the current active version.');
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !draftPolicy || draftVersion === null) return;
    await runAction(async () => {
      const response = await fetch(API_BASE_URL + '/admin/quality-profiles/' + encodeURIComponent(selected.key) + '/versions/' + draftVersion, {
        method: 'PATCH', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: draftPolicy }),
      });
      if (!response.ok) throw new Error(response.status === 403 ? 'Your role cannot edit profile versions.' : 'Could not save draft (' + response.status + ').');
      setDraftPolicy(null); setDraftVersion(null);
    }, 'Draft policy saved. It is not active until you activate this version.');
  }

  async function activate(version: number) {
    if (!selected) return;
    await runAction(async () => {
      const response = await fetch(API_BASE_URL + '/admin/quality-profiles/' + encodeURIComponent(selected.key) + '/versions/' + version + '/activate', { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error(response.status === 403 ? 'Your role cannot activate profile versions.' : 'Could not activate version (' + response.status + ').');
      setDraftPolicy(null); setDraftVersion(null);
    }, 'Version ' + version + ' is now active. The previous active version remains in history.');
  }

  function updateCategory(id: CategoryId, update: Partial<CategoryPolicy>) {
    setDraftPolicy((current) => current ? ({
      ...current,
      categories: { ...current.categories, [id]: { ...current.categories[id], ...update } },
    }) : null);
  }

  if (authorized === false) return <section className="quality-access" aria-label="Quality profile access"><strong>Staff sign-in required</strong><p>Sign in above, then refresh this section to manage quality profiles.</p><button type="button" onClick={() => void refresh()}>Refresh profiles</button></section>;

  return <section className="quality-profiles" aria-label="Quality profile management">
    <div className="quality-toolbar"><p>Versioned policies for security, accessibility, performance, SEO, and requirement coverage.</p><button type="button" onClick={() => void refresh()} disabled={busy}>Refresh</button></div>
    {error && <div className="catalog-state catalog-error" role="alert">{error}</div>}
    {message && <div className="quality-message" role="status">{message}</div>}
    <div className="quality-warning"><strong>Configuration only</strong><span>These policies are stored and audited. The current site review and release checks do not enforce them yet.</span></div>
    <div className="quality-layout">
      <div className="quality-list" aria-label="Profiles">
        {profiles.length === 0 && <p className="quality-empty">No profiles yet. Create a profile to start versioned policy management.</p>}
        {profiles.map((profile) => {
          const active = profile.versions.find((item) => item.status === 'active');
          const draft = profile.versions.find((item) => item.status === 'draft');
          return <button type="button" className="quality-profile-option" aria-pressed={selectedKey === profile.key} key={profile.key} onClick={() => { setSelectedKey(profile.key); setDraftPolicy(null); setDraftVersion(null); }}>
            <span><strong>{profile.name}</strong>{profile.isDefault && <span className="quality-version-badge" data-status="active">Default for new reviews</span>}<small>{profile.description}</small></span>
            <span className="quality-version-badge">{active ? 'v' + active.version + ' active' : draft ? 'Draft v' + draft.version : 'No active version'}</span>
          </button>;
        })}
      </div>
      <div className="quality-detail">
        {selected ? <>
          <div className="quality-detail-title"><div><span className="catalog-category">{selected.key}</span><h3>{selected.name}</h3><p>{selected.description}</p></div>
            <div className="quality-profile-actions">{!selected.isDefault && <button type="button" disabled={busy || !selected.versions.some((item) => item.status === "active")} onClick={() => void setDefault()}>Set as default</button>}{!currentDraft && <button type="button" disabled={busy} onClick={() => void createVersion()}>Create draft</button>}</div>
          </div>
          {draftPolicy && draftVersion !== null && <form className="quality-editor" onSubmit={saveDraft}>
            <div className="quality-editor-heading"><div><strong>Edit draft v{draftVersion}</strong><p>Saving updates only this draft. Activation records an auditable version change.</p></div><button type="button" onClick={() => { setDraftPolicy(null); setDraftVersion(null); }}>Cancel</button></div>
            <label className="quality-number">Minimum requirement coverage (%)<input type="number" min={0} max={100} required value={draftPolicy.minimumRequirementCoverage} onChange={(event) => setDraftPolicy({ ...draftPolicy, minimumRequirementCoverage: Number(event.target.value) })} /></label>
            <fieldset><legend>Finding severities that block a gate</legend><div className="quality-check-row">{severities.map((severity) => <label key={severity}><input type="checkbox" checked={draftPolicy.blockingSeverities.includes(severity)} onChange={(event) => setDraftPolicy({ ...draftPolicy, blockingSeverities: event.target.checked ? [...draftPolicy.blockingSeverities, severity] : draftPolicy.blockingSeverities.filter((item) => item !== severity) })} />{severity}</label>)}</div></fieldset>
            <fieldset><legend>Required categories and open finding limits</legend>
              {categories.map(({ id, label }) => <div className="quality-category-row" key={id}>
                <div><strong>{label}</strong><label><input type="checkbox" checked={draftPolicy.categories[id].enabled} onChange={(event) => updateCategory(id, { enabled: event.target.checked, required: event.target.checked ? draftPolicy.categories[id].required : false })} />Enabled</label><label><input type="checkbox" checked={draftPolicy.categories[id].required} disabled={!draftPolicy.categories[id].enabled} onChange={(event) => updateCategory(id, { required: event.target.checked })} />Required</label></div>
                <label>Max critical <input type="number" min={0} max={100} required value={draftPolicy.categories[id].maxOpenCritical} onChange={(event) => updateCategory(id, { maxOpenCritical: Number(event.target.value) })} /></label>
                <label>Max high <input type="number" min={0} max={100} required value={draftPolicy.categories[id].maxOpenHigh} onChange={(event) => updateCategory(id, { maxOpenHigh: Number(event.target.value) })} /></label>
              </div>)}
            </fieldset>
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button>
          </form>}
          <div className="quality-history"><h4>Version history</h4>
            {selected.versions.length === 0 && <p>No versions have been created.</p>}
            {selected.versions.map((version) => <article key={version.version} className="quality-history-row">
              <div><strong>Version {version.version}</strong><span className="quality-version-badge" data-status={version.status}>{statusText[version.status]}</span><small>Created {new Date(version.createdAt).toLocaleString()} · {version.authoredBy ?? 'Staff'}</small></div>
              <div>{version.status === 'draft' && <button type="button" onClick={() => editPolicy(version.policy, version.version)}>Edit draft</button>}{version.status !== 'active' && <button type="button" disabled={busy} disabled={busy || (draftPolicy !== null && draftVersion === version.version)} onClick={() => void activate(version.version)}>Activate</button>}</div>
            </article>)}
          </div>
        </> : <p className="quality-empty">Choose a profile to see its version history, or create the first one.</p>}
      </div>
    </div>
    <details className="quality-create"><summary>Create a profile</summary><form onSubmit={createProfile}>
      <label>Profile name<input required minLength={1} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Production baseline" /></label>
      <label>Description<input required minLength={1} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this policy is intended to check" /></label>
      <button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create first draft'}</button>
    </form></details>
  </section>;
}
