"use client";

import { useEffect, useState } from "react";
import CapabilityCatalog from "./capability-catalog";
import QualityProfiles from "./quality-profiles";
import AuditEvents from "./audit-events";
import AccountPlans from "./account-plans";
import PlanSettings from "./plan-settings";
import PrivacySettings from "./privacy-settings";
import AiPricing from "./ai-pricing";
import BillingMode from "./billing-mode";
import Payouts from "./payouts";
import Refunds from "./refunds";
import Disputes from "./disputes";
import Reviews from "./reviews";
import SpecialistReports from "./specialist-reports";

type Section = { key: string; nav: string; title: string; text: string; badge: string; body: React.ReactNode };

/** One section at a time, chosen in the sidebar (or the menu row on a phone); every section stays mounted so data loads once. */
const sections: Section[] = [
  { key: 'overview', nav: 'Overview', title: 'Capability manifest', text: 'What the platform can deliver, read from the versioned manifest in backend code: working, limited, documentation-only and unavailable flows. Staff sign in here.', badge: 'Source of truth', body: <CapabilityCatalog /> },
  { key: 'quality', nav: 'Quality profiles', title: 'Versioned quality profiles', text: 'Policy drafts, history and the active version. The default profile’s active version judges every site build before it can be accepted and published, and new site reviews.', badge: 'Staff only', body: <QualityProfiles /> },
  { key: 'customers', nav: 'Customer plans', title: 'Customer plans', text: 'Look up a customer by e-mail, see usage against limits, and assign a plan after an offline payment. Super admins only; every change is audited.', badge: 'Super admin', body: <AccountPlans /> },
  { key: 'prices', nav: 'Prices', title: 'Plan and AI prices', text: 'Prices customers see on their plan page, the contact for upgrading, and what AI requests cost. Changing a price does not change plans already assigned. Super admins only; audited.', badge: 'Super admin', body: <><PlanSettings /><AiPricing /></> },
  { key: 'money', nav: 'Balance and payouts', title: 'Project balance, payouts and refunds', text: 'Prepaid billing for AI requests, money owners paid for specialists (make the bank transfer, then record its reference), and requests to return unspent balance. Super admins only; audited.', badge: 'Super admin', body: <><BillingMode /><Payouts /><Refunds /></> },
  { key: 'disputes', nav: 'Disputes and reviews', title: 'Disputes, reported reviews and cards', text: 'Owners and specialists who disagree about a stage (the payout stays blocked while open), reviews specialists asked to check, and complaints about catalog cards. Hide only what breaks the rules, not an honest low rating. Super admins decide; operations auditors read; audited.', badge: 'Super admin', body: <><Disputes /><Reviews /><SpecialistReports /></> },
  { key: 'privacy', nav: 'Account deletion', title: 'Account deletion', text: 'How long data of a deleted account is kept before it is purged, and restoring an account deleted by mistake. Super admins only; every change is audited.', badge: 'Super admin', body: <PrivacySettings /> },
  { key: 'audit', nav: 'Audit history', title: 'Staff audit history', text: 'Filter security-relevant events. Only super admins and operations auditors can read this history.', badge: 'Role restricted', body: <AuditEvents /> },
];

export default function AdminHome() {
  const [active, setActive] = useState('overview');
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (sections.some((section) => section.key === fromHash)) setActive(fromHash);
  }, []);
  function open(key: string) {
    setActive(key);
    window.history.replaceState(null, '', key === 'overview' ? window.location.pathname : `#${key}`);
    window.scrollTo({ top: 0 });
  }
  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="BuildPath Admin home"><span className="brand-mark">B</span><span>BuildPath</span></a>
        <div className="console-label">Admin console</div>
        <nav className="admin-nav" aria-label="Sections">
          {sections.map((section) => (
            <button key={section.key} type="button" className="nav-item" aria-current={active === section.key ? 'page' : undefined} onClick={() => open(section.key)}>{section.nav}</button>
          ))}
        </nav>
        <div className="sidebar-note"><span className="lock-icon" aria-hidden="true">⌑</span><span>Staff-only console. Customer project content is not shown here; plans show usage counts only.</span></div>
        <div className="sidebar-footer">Platform foundation · v0.1</div>
      </aside>

      <section className="content">
        <header className="topline"><span>BuildPath platform · Administration</span><span className="status"><i /> Separate trust boundary</span></header>
        {sections.map((section) => (
          <section key={section.key} className="admin-section" hidden={active !== section.key} aria-labelledby={`section-${section.key}`}>
            <div className="section-head">
              <div><h1 id={`section-${section.key}`}>{section.title}</h1><p className="lead">{section.text}</p></div>
              <span className="count">{section.badge}</span>
            </div>
            <div className="section-body">{section.body}</div>
          </section>
        ))}
        <footer>BuildPath internal tooling <span>Project content and release controls are not connected to this console</span></footer>
      </section>
    </main>
  );
}
