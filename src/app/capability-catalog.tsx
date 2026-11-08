'use client';

import { useEffect, useMemo, useState } from 'react';

type CapabilityStatus = 'supported' | 'limited' | 'docs_only' | 'unsupported';
type Capability = {
  id: string;
  category: string;
  name: string;
  status: CapabilityStatus;
  summary: string;
  conditions: string[];
};
type CapabilityManifest = {
  revision: string;
  statuses: Array<{ id: CapabilityStatus; label: string; description: string }>;
  capabilities: Capability[];
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const statusLabels: Record<CapabilityStatus, string> = {
  supported: 'Supported',
  limited: 'Limited',
  docs_only: 'Docs only',
  unsupported: 'Unavailable',
};

export default function CapabilityCatalog() {
  const [manifest, setManifest] = useState<CapabilityManifest | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<CapabilityStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadManifest() {
      try {
        const response = await fetch(API_BASE_URL + '/capabilities', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('API returned ' + response.status);
        const payload = await response.json() as { data?: CapabilityManifest };
        if (!payload.data || !Array.isArray(payload.data.capabilities) || !Array.isArray(payload.data.statuses)) {
          throw new Error('The API returned an invalid capability manifest.');
        }
        if (!cancelled) setManifest(payload.data);
      } catch {
        if (!cancelled) setError('Could not load the platform capability manifest. Check NEXT_PUBLIC_API_BASE_URL and API availability.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadManifest();
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    const result: Record<CapabilityStatus, number> = { supported: 0, limited: 0, docs_only: 0, unsupported: 0 };
    for (const item of manifest?.capabilities ?? []) result[item.status] += 1;
    return result;
  }, [manifest]);
  const visible = useMemo(
    () => (manifest?.capabilities ?? []).filter((item) => filter === 'all' || item.status === filter),
    [filter, manifest],
  );

  if (loading) return <div className="catalog-state" role="status">Loading capability manifest…</div>;
  if (error) return <div className="catalog-state catalog-error" role="alert"><strong>Catalog unavailable</strong><p>{error}</p></div>;
  if (!manifest) return null;

  return (
    <section className="catalog" aria-label="Platform capability catalog">
      <div className="catalog-meta">
        <span>Manifest <strong>v{manifest.revision}</strong></span>
        <span>{manifest.capabilities.length} capabilities</span>
      </div>
      <div className="catalog-summary" aria-label="Capability counts">
        {manifest.statuses.map((status) => (
          <div key={status.id} data-status={status.id}>
            <strong>{counts[status.id]}</strong><span>{statusLabels[status.id]}</span>
          </div>
        ))}
      </div>
      <div className="catalog-filters" role="group" aria-label="Filter capabilities by status">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All · {manifest.capabilities.length}</button>
        {manifest.statuses.map((status) => (
          <button key={status.id} type="button" aria-pressed={filter === status.id} onClick={() => setFilter(status.id)}>
            {statusLabels[status.id]} · {counts[status.id]}
          </button>
        ))}
      </div>
      <div className="catalog-grid">
        {visible.map((item) => (
          <article className="catalog-card" key={item.id}>
            <div className="catalog-card-heading"><span className="catalog-category">{item.category}</span><span className="catalog-status" data-status={item.status}>{statusLabels[item.status]}</span></div>
            <h3>{item.name}</h3>
            <p>{item.summary}</p>
            {item.conditions.length > 0 && <details><summary>Scope and conditions</summary><ul>{item.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></details>}
          </article>
        ))}
      </div>
      <p className="catalog-note">Statuses are factual implementation signals. “Supported” does not replace project-specific testing or approval.</p>
    </section>
  );
}
