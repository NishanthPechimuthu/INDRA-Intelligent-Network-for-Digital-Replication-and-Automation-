import React from 'react';
import logoUrl from '../../../assets/logos/logo-64.png';
import Icon from '../components/Icon.jsx';
import { useAuth } from './AuthProvider.jsx';

const FEATURES = [
  { icon: 'ShieldCheck', title: 'Scoped by design', text: 'Plant, department and resource policies enforced in PostgreSQL RLS.' },
  { icon: 'CalendarClock', title: 'Real schedules', text: 'Cross-midnight shifts, breaks and attendance on one operational clock.' },
  { icon: 'Network', title: 'One organization', text: 'Plants, lines, workstations, people and approvals in a single model.' },
];

export default function AuthLayout({ children, tone = 'default', compact = false }) {
  const { isDemo } = useAuth();
  return (
    <div className={`pt-auth pt-auth-${tone}`}>
      <aside className="pt-auth-brand">
        <div className="pt-auth-brand-top">
          <a className="pt-auth-logo" href="/">
            <img src={logoUrl} alt="" />
            <span>
              <b>INDRA</b>
              <small>INDUSTRIAL OPERATIONS PLATFORM</small>
            </span>
          </a>
          <span className="pt-auth-env">{isDemo ? 'DEMO ENVIRONMENT' : 'SECURE ACCESS'}</span>
        </div>

        <div className="pt-auth-hero">
          <p className="pt-eyebrow">PLATFORM FOUNDATION · MODULE 01</p>
          <h1>
            The operating system
            <br />
            for the <span>industrial floor.</span>
          </h1>
          <p className="pt-auth-lead">
            Identity, organization structure, shifts and approvals — engineered around the way a plant
            actually runs, not the way a spreadsheet does.
          </p>
          <div className="pt-auth-features">
            {FEATURES.map((feature) => (
              <div key={feature.title}>
                <span>
                  <Icon name={feature.icon} size={16} />
                </span>
                <div>
                  <strong>{feature.title}</strong>
                  <p>{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-auth-grid-art" aria-hidden="true">
          <span className="pt-auth-line pt-auth-line-a" />
          <span className="pt-auth-line pt-auth-line-b" />
          <span className="pt-auth-line pt-auth-line-c" />
          <span className="pt-auth-node pt-auth-node-a" />
          <span className="pt-auth-node pt-auth-node-b" />
          <span className="pt-auth-node pt-auth-node-c" />
          <span className="pt-auth-node pt-auth-node-d" />
        </div>

        <div className="pt-auth-brand-foot">
          <span>© 2026 INDRA Industrial Systems</span>
          <span className="pt-auth-secure"><Icon name="LockKeyhole" size={12} /> RLS · Audit logged</span>
        </div>
      </aside>

      <main className="pt-auth-main">
        <div className={`pt-auth-shell ${compact ? 'pt-auth-shell-compact' : ''}`}>
          {children}
          <div className="pt-auth-main-foot">
            <a href="/">
              <Icon name="ArrowLeft" size={13} /> Back to 3D twin studio
            </a>
            <span>INDRA v0.1.0 · Module 1</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export function AuthHeading({ eyebrow, title, description, icon }) {
  return (
    <div className="pt-auth-heading">
      {icon && (
        <span className="pt-auth-heading-icon">
          <Icon name={icon} size={20} />
        </span>
      )}
      {eyebrow && <p className="pt-eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}
