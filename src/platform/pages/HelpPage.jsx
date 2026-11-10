import React, { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { Badge, Button, Card, Callout, EmptyState, Field, Select, TextInput, Textarea } from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const FAQS = [
  {
    question: 'Why can I not see the Employees page?',
    answer:
      'Navigation and routes are filtered by permissions, but the real control is PostgreSQL RLS. If you need directory access, ask your plant head to assign a role such as Supervisor, HOD or HR Analyst, or raise an access request.',
  },
  {
    question: 'How is my default dashboard chosen when I hold several roles?',
    answer:
      'INDRA resolves your highest-level role and its work queue. Administrators land on organization administration, HR analysts on the employee directory, approvers on their decision queue and everyone else on the operational dashboard. You can still reach every page your permissions allow.',
  },
  {
    question: 'My shift crosses midnight. How is attendance calculated?',
    answer:
      'A shift such as 22:00 – 06:00 is expanded into a concrete window that ends on the following calendar day. Grace, unpaid lunch, paid breaks and overtime are then evaluated against that window, not against a simple clock subtraction.',
  },
  {
    question: 'Why can I not approve my own request?',
    answer:
      'Segregation of duties is enforced in the database. An approver step can only be decided by its configured approver, and a requester can never decide their own request unless an explicit self-approval policy is enabled for that authority.',
  },
  {
    question: 'How do invitations work?',
    answer:
      'HR or an administrator invites an employee from the Employees page. The invitation carries the email, role, plant and department. The employee opens the activation link, sets a password and lands in their role-specific workspace. Invitations expire after seven days.',
  },
  {
    question: 'Where do medical records live?',
    answer:
      'Medical information is stored in a separate employee_medical table with its own RLS policy. It is never returned with the standard employee directory. Access requires employees.medical.read and is audit logged.',
  },
];

const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Open global search' },
  { keys: ['⌘', 'P'], label: 'Open my profile' },
  { keys: ['Esc'], label: 'Close search or menus' },
];

const GUIDES = [
  { icon: 'CalendarClock', title: 'Schedule & roster', text: 'Effective shifts, breaks, holidays and cross-midnight windows.', to: '/schedule', permission: 'shifts.read' },
  { icon: 'Fingerprint', title: 'Attendance', text: 'Clock records, late minutes, overtime and CSV export.', to: '/attendance', permission: 'attendance.read.self' },
  { icon: 'BadgeCheck', title: 'Approvals', text: 'Decision queue, approval authority and segregation of duties.', to: '/approvals', permission: 'requests.approve' },
  { icon: 'ShieldCheck', title: 'Roles & permissions', text: 'The sixteen roles, permission catalogue and approval thresholds.', to: '/admin/roles', permission: 'roles.read' },
  { icon: 'Users', title: 'Employee directory', text: 'Profiles, invitations, role assignment and employment status.', to: '/admin/employees', permission: 'employees.read' },
  { icon: 'Box', title: '3D twin studio', text: 'The original factory design and live simulation workspace.', to: '/', permission: null, external: true },
];

export default function HelpPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const [openFaq, setOpenFaq] = useState(0);
  const [topic, setTopic] = useState('access');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const context = auth.context;
  const permissions = context?.permissions || [];
  const guides = GUIDES.filter((guide) => !guide.permission || permissions.includes(guide.permission) || context?.roleKeys?.includes('administrator'));

  async function raiseSupportRequest(event) {
    event.preventDefault();
    if (!subject.trim() || !details.trim()) {
      notify('Add a subject and a short description so the support team can help.', 'error');
      return;
    }
    setBusy(true);
    try {
      const { createRequest } = await import('../data/actions.js');
      const result = await createRequest({
        requestType: 'access',
        title: `Support · ${subject.trim()}`,
        details: `[${topic}] ${details.trim()}`,
        customerVisible: false,
      });
      if (result.error) {
        notify(result.error.message, 'error');
        return;
      }
      notify('Support request raised. Your plant administrator has been notified.');
      setSubject('');
      setDetails('');
      navigate('/requests');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Personal', 'Help & support']}
        eyebrow="SUPPORT CENTRE"
        title="Help & support"
        description="Operational guidance for the platform foundation, plus a direct path to your plant administrator and the INDRA support desk."
        actions={<Button variant="secondary" icon="LifeBuoy" onClick={() => navigate('/requests?new=access')}>Raise access request</Button>}
      />

      <section className="pt-help-hero">
        <div>
          <span className="pt-eyebrow">MODULE 01 · PLATFORM FOUNDATION</span>
          <h2>Identity, organization, shifts and approvals — one operating model.</h2>
          <p>This workspace is the operational front door to the INDRA platform. The 3D twin studio remains available at the root path and is linked from every screen.</p>
          <div className="pt-help-pills">
            <Badge tone="lime" dot>{auth.isDemo ? 'Demo identity provider' : 'Supabase connected'}</Badge>
            <Badge tone="neutral">{context?.employee?.plant || 'Organization'}</Badge>
            <Badge tone="neutral">{context?.roles?.map((role) => role.name).join(' · ') || 'No role'}</Badge>
          </div>
        </div>
        <div className="pt-help-contact">
          <div><Icon name="Mail" size={17} /><span><strong>Platform support</strong><small>support@indra.example</small></span></div>
          <div><Icon name="Phone" size={17} /><span><strong>Plant help desk</strong><small>+91 44 4000 1200 · ext. 2</small></span></div>
          <div><Icon name="Clock" size={17} /><span><strong>Coverage</strong><small>Shift A and B · 06:00 – 22:00 IST</small></span></div>
          <div><Icon name="UserRound" size={17} /><span><strong>Your reporting manager</strong><small>{context?.employee?.reportingManagerName || '—'}</small></span></div>
        </div>
      </section>

      <div className="pt-grid-2">
        <Card title="Frequently asked questions" subtitle="Access, roles, shifts and record policy" padded={false}>
          <div className="pt-faq">
            {FAQS.map((faq, index) => (
              <div key={faq.question} className={`pt-faq-item ${openFaq === index ? 'open' : ''}`}>
                <button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}>
                  <span>{faq.question}</span>
                  <Icon name="ChevronDown" size={15} />
                </button>
                {openFaq === index && <p>{faq.answer}</p>}
              </div>
            ))}
          </div>
        </Card>

        <div className="pt-help-side">
          <Card title="Raise a support request" subtitle="Routes to your plant administrator">
            <form className="pt-form-grid" onSubmit={raiseSupportRequest}>
              <Field label="Topic">
                <Select value={topic} onChange={(event) => setTopic(event.target.value)}>
                  <option value="access">Access or permissions</option>
                  <option value="account">Account or sign-in</option>
                  <option value="schedule">Schedule or attendance</option>
                  <option value="approval">Approval workflow</option>
                  <option value="data">Employee record correction</option>
                  <option value="other">Something else</option>
                </Select>
              </Field>
              <Field label="Subject" required>
                <TextInput value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Short summary" />
              </Field>
              <Field label="Description" required className="pt-span-2" hint="Include the page, employee or request involved. Never include medical details.">
                <Textarea rows={4} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Describe what you need help with…" />
              </Field>
              <div className="pt-span-2 pt-form-actions">
                <Button type="submit" icon="Send" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</Button>
              </div>
            </form>
          </Card>

          <Card title="Keyboard shortcuts" subtitle="Move faster through the platform">
            <div className="pt-shortcut-list">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.label}>
                  <span>{shortcut.label}</span>
                  <span className="pt-keys">{shortcut.keys.map((key) => <kbd key={key}>{key}</kbd>)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Guides in this workspace" subtitle="Jump to the screen you need">
        <div className="pt-guide-grid">
          {guides.map((guide) => (
            <button key={guide.title} type="button" className="pt-guide-card" onClick={() => (guide.external ? (window.location.href = guide.to) : navigate(guide.to))}>
              <span className="pt-guide-icon"><Icon name={guide.icon} size={18} /></span>
              <span>
                <strong>{guide.title}</strong>
                <small>{guide.text}</small>
              </span>
              <Icon name={guide.external ? 'ArrowUpRight' : 'ArrowRight'} size={14} />
            </button>
          ))}
          {!guides.length && <EmptyState icon="LifeBuoy" title="No guides available" />}
        </div>
      </Card>

      {auth.isDemo && (
        <Callout tone="info" title="Demo environment">
          Authentication, permissions and mutations are simulated locally so the full workflow is demonstrable without credentials.
          Apply the migrations in <code className="pt-mono">supabase/</code> and set <code className="pt-mono">VITE_SUPABASE_URL</code> plus
          <code className="pt-mono"> VITE_SUPABASE_ANON_KEY</code> to move every check to PostgreSQL RLS and protected RPCs.
        </Callout>
      )}

      <Card title="Support policy" subtitle="What to expect">
        <div className="pt-help-policy">
          <div><strong>Access changes</strong><p>Reviewed by your reporting manager and plant head. Segregation of duties prevents self-granted administrative roles.</p></div>
          <div><strong>Data corrections</strong><p>Employee record changes are audited. Medical data corrections require HR or EHS authority and are never handled over chat.</p></div>
          <div><strong>Incidents</strong><p>For a safety or production incident, follow the plant emergency procedure first, then notify support. The platform is not an emergency channel.</p></div>
        </div>
        <p className="pt-muted pt-small">Workspace last refreshed {workspace.lastUpdated ? new Date(workspace.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}.</p>
      </Card>
    </div>
  );
}
