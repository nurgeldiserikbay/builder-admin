import CapabilityCatalog from "./capability-catalog";

const areas = [
  {
    index: '01',
    name: 'Quality profiles',
    description: 'Review default security, accessibility, performance and SEO checks and their release gates.',
    state: 'Planned',
  },
  {
    index: '02',
    name: 'Operations and audit',
    description: 'Inspect service health, background jobs and security-relevant audit events with role-based access.',
    state: 'Planned',
  },
];

export default function AdminHome() {
  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="BuildPath Admin home"><span className="brand-mark">B</span><span>buildpath</span></a>
        <div className="console-label">ADMIN CONSOLE</div>
        <div className="nav-current"><span className="nav-icon">▦</span>Overview</div>
        <div className="sidebar-note"><span className="lock-icon">⌑</span><span>Read-only catalog<br />This page shows public support metadata only. Project data and admin actions remain unavailable until staff authentication and roles are implemented.</span></div>
        <div className="sidebar-footer">Platform foundation · v0.1</div>
      </aside>

      <section className="content">
        <header className="topline"><span>BuildPath platform</span><span className="status"><i /> Support catalog · read only</span></header>
        <div className="intro">
          <p className="kicker">ADMINISTRATION</p>
          <h1>Know exactly what the platform can deliver.</h1>
          <p className="lead">This catalog reads the versioned capability manifest from the backend. It separates working features from limited, documentation-only, and unavailable flows so product claims stay aligned with implementation.</p>
        </div>
        <div className="section-title"><div><h2>Current capability manifest</h2><p>Read-only catalog from the API. Statuses are maintained in backend code and versioned with the API.</p></div><span className="count">SOURCE OF TRUTH</span></div>
        <CapabilityCatalog />
        <div className="section-title planned-heading"><div><h2>Next admin areas</h2><p>Require staff authentication, authorization policies, and audit logging.</p></div><span className="count">02 PLANNED</span></div>
        <div className="area-list">
          {areas.map((area) => <article className="area" key={area.index}>
            <span className="area-index">{area.index}</span>
            <div className="area-copy"><h3>{area.name}</h3><p>{area.description}</p></div>
            <span className="planned">{area.state}</span>
          </article>)}
        </div>
        <div className="security-note"><span aria-hidden="true">◈</span><div><strong>Admin is a separate trust boundary</strong><p>The public capability manifest contains no project or account data. Editing quality gates, inspecting operations, and managing projects remain unavailable until staff authentication, least-privilege roles, and audit logging are connected.</p></div></div>
        <footer>BuildPath internal tooling <span>Staff controls are not connected</span></footer>
      </section>
    </main>
  );
}
