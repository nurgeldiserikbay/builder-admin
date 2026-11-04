const areas = [
  {
    index: '01',
    name: 'Capability catalog',
    description: 'Manage the versioned list of site types, supported features, quality checks and delivery options.',
    state: 'Planned',
  },
  {
    index: '02',
    name: 'Quality profiles',
    description: 'Review default security, accessibility, performance and SEO checks and their release gates.',
    state: 'Planned',
  },
  {
    index: '03',
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
        <div className="sidebar-note"><span className="lock-icon">⌑</span><span>Internal access only<br />Authentication and staff roles are part of the next implementation phase.</span></div>
        <div className="sidebar-footer">Platform foundation · v0.1</div>
      </aside>

      <section className="content">
        <header className="topline"><span>BuildPath platform</span><span className="status"><i /> Foundation in progress</span></header>
        <div className="intro">
          <p className="kicker">ADMINISTRATION</p>
          <h1>Operations, with clear boundaries.</h1>
          <p className="lead">The admin console will manage platform capabilities and quality rules. Project content and user actions remain protected by explicit staff permissions and an audit trail.</p>
        </div>
        <div className="section-title"><div><h2>Planned work areas</h2><p>These become active as the corresponding API and access policies are implemented.</p></div><span className="count">03 AREAS</span></div>
        <div className="area-list">
          {areas.map((area) => <article className="area" key={area.index}>
            <span className="area-index">{area.index}</span>
            <div className="area-copy"><h3>{area.name}</h3><p>{area.description}</p></div>
            <span className="planned">{area.state}</span>
          </article>)}
        </div>
        <div className="security-note"><span aria-hidden="true">◈</span><div><strong>Admin is a separate trust boundary</strong><p>No user data, credentials, or control actions are exposed here until staff authentication, least-privilege roles, and audit logging are connected.</p></div></div>
        <footer>BuildPath internal tooling <span>Not available to end users</span></footer>
      </section>
    </main>
  );
}
