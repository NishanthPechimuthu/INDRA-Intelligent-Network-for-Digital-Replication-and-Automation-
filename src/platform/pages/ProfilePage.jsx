import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { profileFor } from '../data/selectors.js';
import { hasPermission } from '../data/accessControl.js';
import { navigate, queryParam } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  DefinitionGrid,
  EmptyState,
  InfoRow,
  Progress,
  StatusBadge,
  Tabs,
  Callout,
  formatDate,
  relativeTime,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { formatMinutes } from '../lib/shift.js';

export default function ProfilePage() {
  const auth = useAuth();
  const { listMfaFactors, listSessions } = auth;
  const { data, loading } = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const [tab, setTab] = useState(queryParam('tab') || 'overview');
  const [sessions, setSessions] = useState([]);
  const [factors, setFactors] = useState([]);
  const [securityBusy, setSecurityBusy] = useState('');
  const profile = useMemo(() => (data && context ? profileFor(data, context) : null), [data, context]);

  useEffect(() => {
    if (tab !== 'security') return;
    let cancelled = false;
    Promise.all([listSessions(), listMfaFactors()]).then(([sessionResult, factorResult]) => {
      if (cancelled) return;
      setSessions(sessionResult.sessions || []);
      setFactors(factorResult.factors || []);
    });
    return () => { cancelled = true; };
  }, [tab, listMfaFactors, listSessions]);

  if (loading || !profile) {
    return <div className="pt-page-loading"><span className="pt-spinner" /> Loading employee profile…</div>;
  }

  const { employee, manager, directReports, attendance, documents, projects, medical, medicalRestricted } = profile;
  const totalDays = attendance.summary.present + attendance.summary.absent + attendance.summary.onLeave;
  const attendanceRate = totalDays ? Math.round((attendance.summary.present / totalDays) * 100) : 0;

  async function handleEnroll() {
    setSecurityBusy('enroll');
    const result = await auth.enrollMfa();
    setSecurityBusy('');
    if (result.error) notify(result.error.message, 'error');
    else if (result.demo) notify(result.message, 'info');
    else {
      notify('Authenticator enrollment started. Scan the QR code in your authenticator app.', 'success');
      setFactors((await auth.listMfaFactors()).factors || []);
    }
  }

  async function handleUnenroll(factorId) {
    setSecurityBusy(factorId);
    const result = await auth.unenrollMfa(factorId);
    setSecurityBusy('');
    if (result.error) notify(result.error.message, 'error');
    else {
      notify(result.message || 'Authenticator removed.', 'success');
      setFactors((await auth.listMfaFactors()).factors || []);
    }
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Personal', 'My profile']}
        eyebrow="EMPLOYEE RECORD"
        title="My profile"
        description="Your identity, assignment and compliance record as held by the organization. Sensitive medical data is separated and access-controlled."
        actions={<Button variant="secondary" icon="Send" onClick={() => navigate('/requests?new=profile')}>Request profile update</Button>}
      />

      <section className="pt-profile-hero">
        <div className="pt-profile-hero-main">
          <Avatar name={employee.fullName} src={employee.photoUrl} size="xl" status={employee.employmentStatus === 'active' ? 'active' : 'away'} />
          <div className="pt-profile-identity">
            <div className="pt-profile-name-row">
              <h2>{employee.fullName}</h2>
              <StatusBadge status={employee.employmentStatus} />
            </div>
            <p>{employee.designation} · {employee.department}</p>
            <div className="pt-profile-tags">
              <span className="pt-mono">{employee.employeeCode}</span>
              <span><Icon name="MapPin" size={12} /> {employee.plant}</span>
              <span><Icon name="Briefcase" size={12} /> {employee.jobCategory}</span>
              {employee.roles.map((role) => <Badge key={role.key} tone="lime">{role.name}</Badge>)}
            </div>
          </div>
        </div>
        <div className="pt-profile-hero-stats">
          <div><small>Joined</small><strong>{formatDate(employee.joinedOn)}</strong></div>
          <div><small>Reports to</small><strong>{manager?.fullName || employee.reportingManagerName || '—'}</strong></div>
          <div><small>Current shift</small><strong>{employee.shift?.name || '—'}</strong></div>
          <div><small>Attendance</small><strong>{attendanceRate}%</strong></div>
        </div>
        <div className="pt-profile-contact">
          <a href={`mailto:${employee.email}`}><Icon name="Mail" size={14} /> {employee.email}</a>
          <a href={`tel:${employee.phone}`}><Icon name="Phone" size={14} /> {employee.phone || '—'}</a>
        </div>
      </section>

      <Tabs
        active={tab}
        onChange={(id) => { setTab(id); navigate(`/profile?tab=${id}`, { replace: true }); }}
        tabs={[
          { id: 'overview', label: 'Overview', icon: 'UserRound' },
          { id: 'skills', label: 'Skills & certifications', icon: 'GraduationCap', count: employee.skills.length + employee.certifications.length },
          { id: 'documents', label: 'Documents', icon: 'FileText', count: documents.length },
          { id: 'security', label: 'Account security', icon: 'ShieldCheck' },
        ]}
      />

      {tab === 'overview' && (
        <div className="pt-grid-2">
          <Card title="Employment record" subtitle="Core employee profile">
            <DefinitionGrid columns={2}>
              <InfoRow label="Employee ID" value={employee.employeeCode} mono />
              <InfoRow label="Full name" value={employee.fullName} />
              <InfoRow label="Designation" value={employee.designation} />
              <InfoRow label="Department" value={employee.department} />
              <InfoRow label="Reporting manager" value={manager?.fullName || employee.reportingManagerName || '—'} />
              <InfoRow label="Assigned plant" value={`${employee.plant} (${employee.plantCode})`} />
              <InfoRow label="Production line" value={employee.productionLine || 'Not line-assigned'} />
              <InfoRow label="Job category" value={employee.jobCategory} />
              <InfoRow label="Employment type" value={(employee.employmentType || 'full time').replaceAll('_', ' ')} />
              <InfoRow label="Work mode" value={(employee.workMode || 'onsite').replaceAll('_', ' ')} />
              <InfoRow label="Work email" value={employee.email} />
              <InfoRow label="Phone" value={employee.phone || '—'} />
            </DefinitionGrid>
          </Card>

          <Card title="Shift & attendance" subtitle="Last 30 days" action={<button type="button" className="pt-link-btn" onClick={() => navigate('/schedule')}>Schedule <Icon name="ArrowRight" size={12} /></button>}>
            <div className="pt-shift-summary">
              <span className="pt-shift-summary-icon"><Icon name="CalendarClock" size={20} /></span>
              <div>
                <strong>{employee.shift?.name || 'No shift assigned'}</strong>
                <small>{employee.shift ? `${employee.shift.startTime} – ${employee.shift.endTime} · ${employee.shift.timezone}` : 'Awaiting roster assignment'}</small>
              </div>
              <Badge tone="neutral">{employee.shift?.weeklyWorkingDays?.length || 0} days/week</Badge>
            </div>
            <div className="pt-attendance-mini-grid">
              <div><small>Present</small><strong>{attendance.summary.present}</strong></div>
              <div><small>Late</small><strong>{attendance.summary.late}</strong></div>
              <div><small>Leave</small><strong>{attendance.summary.onLeave}</strong></div>
              <div><small>Overtime</small><strong>{formatMinutes(attendance.summary.overtimeMinutes)}</strong></div>
            </div>
            <Progress value={attendanceRate} label="Attendance rate" />
            <div className="pt-link-row">
              <button type="button" className="pt-link-btn" onClick={() => navigate('/attendance')}>View attendance record <Icon name="ArrowRight" size={12} /></button>
            </div>
          </Card>

          <Card title="Restricted medical information" subtitle="Separate table · separate RLS policy" action={<Badge tone={medicalRestricted ? 'red' : 'violet'}><Icon name="LockKeyhole" size={11} /> Restricted</Badge>}>
            {medical ? (
              <DefinitionGrid columns={2}>
                <InfoRow label="Blood group" value={medical.bloodGroup} />
                <InfoRow label="Allergies" value={medical.allergies} />
                <InfoRow label="Conditions" value={medical.conditions} />
                <InfoRow label="Last check-up" value={formatDate(medical.lastCheckupOn)} />
                <InfoRow label="Emergency contact" value={medical.emergencyContactName} />
                <InfoRow label="Emergency phone" value={medical.emergencyContactPhone} mono />
              </DefinitionGrid>
            ) : (
              <Callout tone="info" title={medicalRestricted ? 'Medical record exists but is hidden' : 'No medical record on file'}>
                Medical data is never returned with the standard employee directory. Access requires
                <code className="pt-mono"> employees.medical.read</code> and is audited. {hasPermission(context.permissions, 'employees.medical.read') ? 'Your role may see records in scope.' : 'Your current role cannot read this section.'}
              </Callout>
            )}
          </Card>

          <Card title="Team & projects" subtitle="Reporting structure and current work">
            <div className="pt-team-list">
              <div className="pt-team-head"><span>Reporting manager</span></div>
              {manager ? (
                <div className="pt-team-row">
                  <Avatar name={manager.fullName} size="sm" />
                  <span><strong>{manager.fullName}</strong><small>{manager.designation}</small></span>
                  <Badge tone="neutral">{manager.department}</Badge>
                </div>
              ) : <p className="pt-muted">No reporting manager assigned.</p>}
              {directReports.length > 0 && (
                <>
                  <div className="pt-team-head"><span>Direct reports · {directReports.length}</span></div>
                  {directReports.map((report) => (
                    <div className="pt-team-row" key={report.id}>
                      <Avatar name={report.fullName} size="sm" />
                      <span><strong>{report.fullName}</strong><small>{report.designation}</small></span>
                      <StatusBadge status={report.employmentStatus} />
                    </div>
                  ))}
                </>
              )}
            </div>
            {projects.length > 0 && (
              <div className="pt-project-chips">
                {projects.map((project) => <Badge key={project.id} tone="blue">{project.name}</Badge>)}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'skills' && (
        <div className="pt-grid-2">
          <Card title="Skills" subtitle={`${employee.skills.length} recorded skills`}>
            {employee.skills.length ? (
              <div className="pt-skill-list">
                {employee.skills.map((skill) => (
                  <div key={skill.id} className="pt-skill-row">
                    <div>
                      <strong>{skill.name}</strong>
                      <small>{skill.category} {skill.verified && <Badge tone="green">Verified</Badge>}</small>
                    </div>
                    <div className="pt-skill-level">
                      {[1, 2, 3, 4, 5].map((level) => <span key={level} className={level <= skill.proficiency ? 'on' : ''} />)}
                      <em>L{skill.proficiency}</em>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon="GraduationCap" title="No skills recorded" description="Your manager or HR can add verified skills." />}
          </Card>
          <Card title="Certifications" subtitle="Validity and verification status">
            {employee.certifications.length ? (
              <div className="pt-cert-list">
                {employee.certifications.map((certification) => (
                  <div key={certification.id} className="pt-cert-row">
                    <span className="pt-cert-icon"><Icon name="Award" size={18} /></span>
                    <div>
                      <strong>{certification.name}</strong>
                      <small>{certification.issuingBody} · issued {formatDate(certification.issuedOn)}</small>
                      <small>Expires {formatDate(certification.expiresOn)}</small>
                    </div>
                    <StatusBadge status={certification.status} />
                  </div>
                ))}
              </div>
            ) : <EmptyState icon="Award" title="No certifications" />}
          </Card>
        </div>
      )}

      {tab === 'documents' && (
        <Card title="My documents" subtitle="Evidence, certificates and pay records">
          <DataTable
            columns={[
              { key: 'name', label: 'Document', render: (row) => <span className="pt-doc-cell"><Icon name="FileText" size={16} /><span><strong>{row.name}</strong><small>{row.category} · {(row.sizeBytes / 1024).toFixed(0)} KB</small></span></span> },
              { key: 'entityType', label: 'Linked to', render: (row) => <span className="pt-muted">{row.entityType?.replaceAll('_', ' ') || '—'}</span> },
              { key: 'createdAt', label: 'Uploaded', render: (row) => <span className="pt-mono pt-muted">{formatDate(row.createdAt)}</span> },
              { key: 'action', label: '', align: 'right', render: () => <Button variant="ghost" size="sm" icon="Download" disabled>Download</Button> },
            ]}
            rows={documents}
            empty={<EmptyState icon="FileText" title="No documents" description="Uploaded evidence and certificates appear here." />}
          />
          <Callout tone="info" title="Storage security">
            Documents live in Supabase Storage buckets with signed URL access. Database rows carry the
            organization, owner and entity link; Storage RLS checks the same employee context.
          </Callout>
        </Card>
      )}

      {tab === 'security' && (
        <div className="pt-grid-2">
          <Card title="Active sessions" subtitle="Devices currently signed in to your account" action={<Button variant="secondary" size="sm" icon="RefreshCw" onClick={async () => setSessions((await auth.listSessions()).sessions || [])}>Refresh</Button>}>
            <div className="pt-session-list">
              {sessions.map((session) => (
                <div key={session.id} className="pt-session-row">
                  <span className="pt-session-icon"><Icon name={session.userAgent?.includes('Mobile') ? 'Smartphone' : 'Monitor'} size={17} /></span>
                  <div>
                    <strong>{session.userAgent?.includes('Mobile') ? 'Mobile browser' : 'Desktop browser'}{session.current && <Badge tone="green">This device</Badge>}</strong>
                    <small>{session.ipAddress} · signed in {relativeTime(session.createdAt)} · last active {relativeTime(session.lastSeenAt)}</small>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-security-actions">
              <Button variant="secondary" size="sm" icon="LogOut" onClick={async () => { await auth.signOut({ global: true }); }}>Sign out all sessions</Button>
            </div>
          </Card>

          <Card title="Multi-factor authentication" subtitle="Time-based one-time password authenticator" action={<Badge tone={factors.length ? 'green' : 'amber'} dot>{factors.length ? 'Enabled' : 'Not enrolled'}</Badge>}>
            {factors.map((factor) => (
              <div key={factor.id} className="pt-factor-row">
                <span><Icon name="Smartphone" size={17} /></span>
                <div><strong>{factor.friendlyName || factor.friendly_name || 'Authenticator'}</strong><small>Verified {factor.createdAt ? formatDate(factor.createdAt) : ''}</small></div>
                <Button variant="ghost" size="sm" onClick={() => handleUnenroll(factor.id)} disabled={securityBusy === factor.id}>Remove</Button>
              </div>
            ))}
            {!factors.length && <p className="pt-muted">No authenticator is enrolled. Enable MFA to protect approvals and administrative actions.</p>}
            <Button variant="secondary" icon="ShieldCheck" onClick={handleEnroll} disabled={securityBusy === 'enroll'}>
              {securityBusy === 'enroll' ? 'Starting…' : factors.length ? 'Add another authenticator' : 'Enable authenticator'}
            </Button>
            {auth.isDemo && <p className="pt-muted pt-small">Demo mode simulates MFA with code <code className="pt-mono">123456</code>.</p>}
          </Card>

          <Card title="Password" subtitle="Credentials are owned by Supabase Auth">
            <p className="pt-muted">Use the secure reset flow to change your password. INDRA application tables never store password hashes.</p>
            <Button variant="secondary" icon="KeyRound" onClick={() => navigate('/forgot-password')}>Send password reset link</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
