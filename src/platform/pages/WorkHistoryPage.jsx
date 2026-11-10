import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { workHistoryFor, summariseReports, orderFor, productFor } from '../data/productionSelectors.js';
import { hasPermission } from '../data/accessControl.js';
import Icon from '../components/Icon.jsx';
import { Badge, Button, Card, EmptyState, Select, StatCard, Tabs, formatDate, formatDateTime, relativeTime } from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { TaskStatus } from '../components/Production.jsx';

/** Personal work history: completed tasks, production entries and status events. */
export default function WorkHistoryPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const context = auth.context;
  const data = workspace.data;
  const [tab, setTab] = useState('tasks');
  const [employeeId, setEmployeeId] = useState(context?.employeeId || '');

  const canSeeTeam = hasPermission(context?.permissions, 'tasks.read.all') || hasPermission(context?.permissions, 'production.reports.read');
  const target = canSeeTeam ? employeeId || context?.employeeId : context?.employeeId;
  const history = useMemo(() => (data && context ? workHistoryFor(data, context, target) : { tasks: [], reports: [], events: [] }), [data, context, target]);
  const summary = summariseReports(history.reports);
  const employee = data?.employees?.find((item) => item.id === target);

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Workspace', 'Work history']}
        eyebrow="AUDITABLE HISTORY"
        title="Work history"
        description="Completed tasks, every production entry and the status events behind them. Nothing here can be edited after the fact."
        actions={
          canSeeTeam ? (
            <Select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} aria-label="Employee">
              {(data?.employees || []).map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </Select>
          ) : null
        }
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Completed tasks" value={history.tasks.filter((task) => task.productionStatus === 'completed').length} icon="CheckCircle2" tone="lime" footnote={employee?.fullName || 'You'} />
        <StatCard label="Production entries" value={summary.entries} icon="FileText" footnote="Recorded to the piece" />
        <StatCard label="Good pieces" value={summary.good.toLocaleString()} icon="Gauge" footnote={`${summary.rejected} rejected`} />
        <StatCard label="Status events" value={history.events.length} icon="History" footnote="Accept, pause, block, complete" />
      </section>

      <Card
        title="History"
        subtitle="Chronological record with the evidence behind each figure"
        action={<Tabs active={tab} onChange={setTab} tabs={[{ id: 'tasks', label: 'Tasks' }, { id: 'reports', label: 'Production' }, { id: 'events', label: 'Events' }]} />}
      >
        {tab === 'tasks' ? (
          history.tasks.length ? (
            <div className="pt-mini-table">
              {history.tasks.sort((a, b) => String(b.completedAt || b.dueAt).localeCompare(String(a.completedAt || a.dueAt))).map((task) => {
                const order = orderFor(data, task);
                return (
                  <div key={task.id} className="pt-mini-row">
                    <div>
                      <strong>{task.title}</strong>
                      <small>{order?.orderNo || 'No order'} · {Number(task.completedQuantity || 0)} / {Number(task.targetQuantity || 0)} pcs · {Number(task.rejectedQuantity || 0)} rejected</small>
                      <small className="pt-muted">{task.completedAt || task.dueAt ? formatDateTime(task.completedAt || task.dueAt) : ''}</small>
                    </div>
                    <TaskStatus status={task.productionStatus} />
                  </div>
                );
              })}
            </div>
          ) : <EmptyState icon="ListChecks" title="No completed work yet" description="Tasks appear here once they are completed or cancelled." />
        ) : null}

        {tab === 'reports' ? (
          history.reports.length ? (
            <div className="pt-table-scroll">
              <table className="pt-table">
                <thead><tr><th>Date</th><th>Order</th><th>Product</th><th>Shift</th><th>Total</th><th>Good</th><th>Rejected</th><th>Rework</th><th>Downtime</th></tr></thead>
                <tbody>
                  {history.reports.map((report) => {
                    const order = data.productionOrders?.find((item) => item.id === report.productionOrderId);
                    return (
                      <tr key={report.id}>
                        <td>{report.workDate}<small className="pt-muted">{report.startedAt ? relativeTime(report.startedAt) : ''}</small></td>
                        <td className="pt-mono">{order?.orderNo || '—'}</td>
                        <td>{order ? productFor(data, order)?.name : '—'}</td>
                        <td>{report.shiftCode || '—'}</td>
                        <td className="pt-mono">{Number(report.totalProduced).toLocaleString()}</td>
                        <td className="pt-mono">{Number(report.goodPieces).toLocaleString()}</td>
                        <td className="pt-mono">{Number(report.rejectedPieces).toLocaleString()}</td>
                        <td className="pt-mono">{Number(report.reworkPieces || 0).toLocaleString()}</td>
                        <td>{Number(report.downtimeMinutes || 0)} min{report.downtimeReason ? <small className="pt-muted">{report.downtimeReason}</small> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon="FileText" title="No production entries" description="Production recorded against tasks appears here." />
        ) : null}

        {tab === 'events' ? (
          history.events.length ? (
            <ol className="pt-version-timeline">
              {history.events.map((event) => (
                <li key={event.id} className={`pt-version pt-version-${event.event}`}>
                  <span className="pt-version-dot" />
                  <div className="pt-version-body">
                    <div className="pt-version-head">
                      <strong>{String(event.event).replaceAll('_', ' ')}</strong>
                      <Badge tone="neutral">{formatDate(event.createdAt)}</Badge>
                    </div>
                    <small className="pt-muted">{formatDateTime(event.createdAt)}{event.reason ? ` · ${event.reason}` : ''}</small>
                  </div>
                </li>
              ))}
            </ol>
          ) : <EmptyState icon="History" title="No status events" description="Accepting, pausing, blocking and completing a task creates an event." />
        ) : null}
      </Card>

      <Card title="Why this page exists" subtitle="Explainability for operators and auditors">
        <ul className="pt-policy-list">
          <li><Icon name="Check" size={13} /> Production entries are append-only; corrections are new records with their own audit trail.</li>
          <li><Icon name="Check" size={13} /> Every status change records the employee, the time and the reason.</li>
          <li><Icon name="Check" size={13} /> Rework never increases output: it is counted inside rejects.</li>
          <li><Icon name="Check" size={13} /> Row level security limits this page to work you performed or supervise.</li>
        </ul>
        <Button variant="ghost" size="sm" icon="History" onClick={() => { window.location.href = '/activity'; }}>Open platform activity log</Button>
      </Card>
    </div>
  );
}
