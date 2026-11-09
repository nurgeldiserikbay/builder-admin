'use client';

import { useCallback, useEffect, useState } from 'react';

type Actor = { id: string; email: string; displayName: string; role: string } | null;
type AuditEvent = {
  id: string;
  eventType: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, string | number | boolean | null> | null;
  createdAt: string;
  actor: Actor;
};
type AuditPage = { data?: AuditEvent[]; meta?: { nextCursor?: string | null } };
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
const eventOptions = [
  ['staff.login_succeeded', 'Staff sign-in'],
  ['staff.login_failed', 'Failed sign-in'],
  ['staff.logout', 'Staff sign-out'],
  ['staff.access_denied', 'Access denied'],
  ['quality_profile.created', 'Profile created'],
  ['quality_profile.version_created', 'Profile version created'],
  ['quality_profile.version_updated', 'Profile version updated'],
  ['quality_profile.version_activated', 'Profile version activated'],
  ['quality_profile.default_changed', 'Default profile changed'],
  ['account.plan_assigned', 'Customer plan assigned'],
];

export default function AuditEvents() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [eventType, setEventType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [authorization, setAuthorization] = useState<'unknown' | 'allowed' | 'denied'>('unknown');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (cursor?: string, resetHistory = false) => {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ limit: '25' });
      if (eventType) query.set('eventType', eventType);
      if (fromDate) query.set('from', new Date(fromDate + 'T00:00:00.000Z').toISOString());
      if (toDate) query.set('to', new Date(toDate + 'T23:59:59.999Z').toISOString());
      if (cursor) query.set('cursor', cursor);
      const response = await fetch(API_BASE_URL + '/admin/audit-events?' + query.toString(), {
        credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' },
      });
      if (response.status === 401) { setAuthorization('unknown'); setEvents([]); setNextCursor(null); return; }
      if (response.status === 403) { setAuthorization('denied'); setEvents([]); throw new Error('Audit history is restricted to super admins and operations auditors.'); }
      if (!response.ok) throw new Error('Could not load audit events (' + response.status + ').');
      const result = await response.json() as AuditPage;
      if (!Array.isArray(result.data) || !result.meta) throw new Error('The API returned an invalid audit page.');
      setAuthorization('allowed'); setEvents(result.data); setNextCursor(result.meta.nextCursor ?? null);
      if (resetHistory) setCursorHistory([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reach the admin API.');
    } finally { setLoading(false); }
  }, [eventType, fromDate, toDate]);

  useEffect(() => {
    void load(undefined, true);
    const onSessionChange = () => { void load(undefined, true); };
    window.addEventListener('buildpath:staff-session-changed', onSessionChange);
    return () => window.removeEventListener('buildpath:staff-session-changed', onSessionChange);
  }, [load]);

  function labelFor(type: string) {
    return eventOptions.find(([value]) => value === type)?.[1] ?? type;
  }

  return (
    <section className="audit-browser" aria-label="Staff audit event browser">
      <div className="audit-toolbar">
        <label>Event
          <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
            <option value="">All events</option>
            {eventOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>From <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>To <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <button type="button" onClick={() => void load(undefined, true)} disabled={loading}>Apply filters</button>
        <button type="button" className="audit-refresh" onClick={() => void load(cursorHistory.at(-1))} disabled={loading}>Refresh</button>
      </div>
      {error && <div className="audit-error" role="alert">{error}</div>}
      {authorization === 'unknown' && !error && <p className="audit-hint">Sign in with an authorized staff account to inspect audit history.</p>}
      <div className="audit-list" aria-live="polite">
        {loading && <p className="audit-hint">Loading audit events…</p>}
        {!loading && authorization === 'allowed' && events.length === 0 && <p className="audit-hint">No events match these filters.</p>}
        {events.map((event) => (
          <article className="audit-row" key={event.id}>
            <div className="audit-row-main">
              <div><strong>{labelFor(event.eventType)}</strong><span className="audit-event-code">{event.eventType}</span></div>
              <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
            </div>
            <div className="audit-meta">
              <span>{event.actor ? event.actor.displayName + ' · ' + event.actor.role : 'System or removed staff account'}</span>
              {event.targetType && <span>Target: {event.targetType}{event.targetId ? ' · ' + event.targetId : ''}</span>}
            </div>
            {event.details && Object.keys(event.details).length > 0 && <dl className="audit-details">
              {Object.entries(event.details).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value === null ? '—' : String(value)}</dd></div>)}
            </dl>}
          </article>
        ))}
      </div>
      {authorization === 'allowed' && <div className="audit-pagination">
        <button type="button" onClick={() => {
          const previous = cursorHistory.slice(0, -1);
          setCursorHistory(previous);
          void load(previous.at(-1));
        }} disabled={loading || cursorHistory.length === 0}>Previous</button>
        <span>{events.length} events · maximum 25 per page</span>
        <button type="button" onClick={() => { if (nextCursor) { setCursorHistory((current) => [...current, nextCursor]); void load(nextCursor); } }} disabled={loading || !nextCursor}>Next</button>
      </div>}
      <p className="audit-footnote">Sensitive event payloads are omitted. Date filters are limited to a 90-day interval and pages are capped at 25 events.</p>
    </section>
  );
}
