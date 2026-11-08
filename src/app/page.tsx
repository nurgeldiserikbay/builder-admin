import CapabilityCatalog from "./capability-catalog";
import QualityProfiles from "./quality-profiles";
import AuditEvents from "./audit-events";

const areas = [
  {
    index: '01',
    name: 'Apply policies to test and release gates',
    description: 'Connect active profile versions to review runs and require the configured checks before release.',
    state: 'Planned',
  },
  {
  },
];

export default function AdminHome() {
  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="BuildPath Admin home"><span className="brand-mark">B</span><span>buildpath</span></a>
        <div className="console-label">ADMIN CONSOLE</div>
        <div className="nav-current"><span className="nav-icon">▦</span>Overview</div>
        <div className="sidebar-note"><span className="lock-icon">⌑</span><span>Staff-only catalog<br />Customer accounts and project data are not exposed here.</span></div>
        <div className="sidebar-footer">Platform foundation · v0.1</div>
      </aside>

      <section className="content">
        <header className="topline"><span>BuildPath platform</span><span className="status"><i /> Support catalog · read only</span></header>
        <div className="intro">
          <p className="kicker">ADMINISTRATION</p>
          <h1>Know exactly what the platform can deliver.</h1>
          <p className="lead">After staff sign-in, the catalog reads the versioned capability manifest from the backend. It separates working features from limited, documentation-only, and unavailable flows so product claims stay aligned with implementation.</p>
        </div>
        <div className="section-title"><div><h2>Current capability manifest</h2><p>Staff-only read endpoint. Statuses are maintained in backend code and versioned with the API.</p></div><span className="count">SOURCE OF TRUTH</span></div>
        <CapabilityCatalog />
        <div className="section-title planned-heading"><div><h2>Versioned quality profiles</h2><p>Create policy drafts, review history, and activate a specific version.</p></div><span className="count">STAFF ONLY</span></div>
        <QualityProfiles />
        <div className="section-title planned-heading"><div><h2>Staff audit history</h2><p>Filter security-relevant events. Only super admins and operations auditors can read this history.</p></div><span className="count">ROLE RESTRICTED</span></div>
        <AuditEvents />
        <div className="section-title planned-heading"><div><h2>Next admin areas</h2><p>Need their own scoped APIs and audited authorization before they can be enabled.</p></div><span className="count">02 NEXT</span></div>
        <div className="area-list">
          {areas.map((area) => <article className="area" key={area.index}>
            <span className="area-index">{area.index}</span>
            <div className="area-copy"><h3>{area.name}</h3><p>{area.description}</p></div>
            <span className="planned">{area.state}</span>
          </article>)}
        </div>
        <div className="security-note"><span aria-hidden="true">◈</span><div><strong>Admin is a separate trust boundary</strong><p>The public capability manifest contains no customer project data. Audit history is restricted to authorized staff; project records and release controls remain unavailable until their own scoped workflows are implemented.</p></div></div>
        <footer>BuildPath internal tooling <span>Customer project and release controls are not connected</span></footer>
      </section>
    </main>
  );
}
