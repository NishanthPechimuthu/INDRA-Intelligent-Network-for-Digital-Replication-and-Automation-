import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { activityFor } from '../data/selectors.js';
import { hasPermission } from '../data/accessControl.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Segmented,
  StatCard,
  formatDateTime,
  relativeTime,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';

const ACTION_TONE = {
  approved: 'green',
  rejected: 'red',
  submitted: 'amber',
  assigned: 'blue',
  updated: 'violet',
  created: 'lime',
  corrected: 'amber',
  revoked: 'red',
  sent: 'blue',
  completed: 'green',
};

function actionTone(action = '') {
  const verb = action.split('.').pop() || '';
  return ACTION_TONE[verb] || 'neutral';
}

function moduleOf(action = '') {
  return action.split('.')[0] || 'system';
}

export default function ActivityPage() {
  const auth = useAuth();
  const { data, loading } = useWorkspace();
  const context = auth.context;
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');

  const logs = useMemo(() => (data && context ? activityFor(data, context) : []), [data, context]);
  const canReadAudit = hasPermission(context?.permissions, 'audit.read');

  const modules = useMemo(() => [...new Set(logs.map((log) => moduleOf(log.action)))].sort(), [logs]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (scope !== 'all' && moduleOf(log.action) !== scope) return false;
      if (!needle) return true;
      return `${log.action} ${log.summary} ${log.entityType} ${log.entityId}`.toLowerCase().includes(needle);
    });
  }, [logs, scope, query]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const today = logs.filter((log) => String(log.createdAt).slice(0, 10) === todayKey).length;
  const approvalEvents = logs.filter((log) => moduleOf(log.action) === 'request' || moduleOf(log.action) === 'approval').length;
  const peopleEvents = logs.filter((log) => ['employee', 'role', 'invitation', 'user_role'].includes(moduleOf(log.action))).length;
  const securityEvents = logs.filter((log) => ['auth', 'security', 'session'].includes(moduleOf(log.action))).length;

  if (loading) {
    return <div className="pt-page-loading"><span className="pt-spinner" /> Loading audit history…</div>;
  }

  if (!canReadAudit) {
    return (
      <div className="pt-page">
        <PageHeader breadcrumb={['Personal', 'Activity history']} eyebrow="AUDIT TRAIL" title="Activity history" description="The audit trail is restricted to roles that hold the audit permission." />
        <Card>
          <EmptyState icon="ShieldCheck" title="Audit access is restricted" description="Your current roles do not include the audit.read permission. Ask your plant head if you need this visibility for your work." action={<Button variant="secondary" icon="Send" onClick={() => navigate('/requests?new=access')}>Request access</Button>} />
        </Card>
      </div>
    );
  }

  function exportCsv() {
    const header = ['When', 'Actor', 'Action', 'Entity type', 'Entity id', 'Summary', 'IP'];
    const rows = filtered.map((log) => [
      log.createdAt,
      data.employeesById[log.actorEmployeeId]?.fullName || 'System',
      log.action,
      log.entityType,
      log.entityId,
      log.summary,
      log.ipAddress,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'indra-activity-history.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Personal', 'Activity history']}
        eyebrow="AUDITABLE BY DESIGN"
        title="Activity history"
        description="Every material action across people, approvals, shifts and the digital twin is written to an append-only audit log. This view only returns records inside your plant and department scope."
        actions={<Button variant="secondary" icon="Download" onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>}
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Events recorded" value={logs.length} icon="History" footnote="Visible in your scope" />
        <StatCard label="Today" value={today} icon="Activity" tone={today ? 'lime' : 'default'} footnote="Actions since midnight" />
        <StatCard label="Approval decisions" value={approvalEvents} icon="BadgeCheck" footnote="Requests and approvals" />
        <StatCard label="People & access" value={peopleEvents} icon="Users" footnote={`${securityEvents} security events`} />
      </section>

      <Card
        title="Audit register"
        subtitle={`${filtered.length} of ${logs.length} events · append-only`}
        padded={false}
        action={
          <div className="pt-toolbar">
            <label className="pt-inline-search">
              <Icon name="Search" size={14} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter events…" aria-label="Filter activity" />
            </label>
            <Segmented label="Filter activity module" value={scope} onChange={setScope} options={[{ value: 'all', label: 'All' }, ...modules.slice(0, 3).map((module) => ({ value: module, label: module.replaceAll('_', ' ') }))]} />
          </div>
        }
      >
        <DataTable
          dense
          columns={[
            {
              key: 'action',
              label: 'Event',
              render: (row) => (
                <span className="pt-activity-cell">
                  <Badge tone={actionTone(row.action)} dot>{moduleOf(row.action)}</Badge>
                  <span className="pt-table-primary">
                    <strong>{row.summary}</strong>
                    <small className="pt-mono">{row.action} · {row.entityType}:{String(row.entityId).slice(-12)}</small>
                  </span>
                </span>
              ),
            },
            {
              key: 'actor',
              label: 'Actor',
              render: (row) => {
                const actor = data.employeesById[row.actorEmployeeId];
                return (
                  <span className="pt-person-cell">
                    <Avatar name={actor?.fullName || 'System'} size="xs" />
                    <span>{actor?.fullName || 'System'}<small>{actor?.designation || 'Automated policy'}</small></span>
                  </span>
                );
              },
            },
            { key: 'ip', label: 'Source', render: (row) => <span className="pt-mono pt-muted pt-small">{row.ipAddress || '—'}</span> },
            {
              key: 'created',
              label: 'When',
              align: 'right',
              render: (row) => <span className="pt-muted"><strong>{relativeTime(row.createdAt)}</strong><small className="pt-block pt-mono">{formatDateTime(row.createdAt)}</small></span>,
            },
          ]}
          rows={filtered}
          empty={<EmptyState icon="History" title="No activity matches" description="Change the filter or wait for actions to be recorded." />}
        />
      </Card>

      <Card title="Retention & integrity" subtitle="How the audit trail is protected">
        <div className="pt-audit-notes">
          <div><Icon name="LockKeyhole" size={17} /><strong>Append-only</strong><p>Application roles can insert but never update or delete audit rows. PostgreSQL triggers write actor and organization context.</p></div>
          <div><Icon name="Network" size={17} /><strong>Scoped reads</strong><p>RLS returns events only for employees inside your plant. Administrators and plant heads see plant-wide history.</p></div>
          <div><Icon name="ShieldCheck" size={17} /><strong>Permission gated</strong><p>The route and every query require <code className="pt-mono">audit.read</code>. Hiding the navigation is never the control.</p></div>
        </div>
      </Card>
    </div>
  );
}
