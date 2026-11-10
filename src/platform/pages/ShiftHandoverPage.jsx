import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { summariseReports, tasksForEmployee, shiftReportsFor, reportsForEmployee } from '../data/productionSelectors.js';
import { hasPermission } from '../data/accessControl.js';
import { acknowledgeHandover, submitShiftHandover } from '../data/actions.js';
import { todayShiftSummary } from '../data/selectors.js';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  StatCard,
  Textarea,
  TextInput,
  formatDateTime,
  LoadingBlock,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { FieldHint } from '../components/Production.jsx';
import { useToast } from '../components/ToastProvider.jsx';

/** Shift completion report and handover between shifts. */
export default function ShiftHandoverPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const data = workspace.data;
  const [busy, setBusy] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [form, setForm] = useState({
    totalProduced: '',
    goodPieces: '',
    rejectedPieces: '',
    machineIssueCount: '0',
    toolIssueCount: '0',
    materialShortageCount: '0',
    remainingWork: '',
    handoverNotes: '',
    productionOrderId: '',
  });

  const myTasks = useMemo(() => (data && context ? tasksForEmployee(data, context.employeeId) : []), [data, context]);
  const completedToday = myTasks.filter((task) => task.productionStatus === 'completed');
  const openTasks = myTasks.filter((task) => !['completed', 'cancelled'].includes(task.productionStatus));
  const reports = useMemo(() => (data && context ? shiftReportsFor(data, context) : []), [data, context]);
  const myReports = useMemo(() => (data && context ? reportsForEmployee(data, context.employeeId) : []), [data, context]);
  const todaySummary = summariseReports(myReports.filter((report) => report.workDate === new Date().toISOString().slice(0, 10)));
  const shift = useMemo(() => (data && context ? todayShiftSummary(data, context.employeeId) : null), [data, context]);
  const canSubmit = hasPermission(context?.permissions, 'handover.submit');
  const canAcknowledge = hasPermission(context?.permissions, 'handover.read');

  const good = Number(form.goodPieces || 0);
  const rejected = Number(form.rejectedPieces || 0);
  const total = good + rejected;

  function toggleTask(taskId) {
    setSelectedTasks((current) => current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]);
  }

  function prefill() {
    setForm((current) => ({
      ...current,
      goodPieces: String(todaySummary.good || ''),
      rejectedPieces: String(todaySummary.rejected || ''),
      machineIssueCount: String((data.technicalIssues || []).filter((issue) => issue.reportedByEmployeeId === context.employeeId && issue.status !== 'closed').length),
      toolIssueCount: String((data.toolDamageReports || []).filter((report) => report.reportedByEmployeeId === context.employeeId && report.status !== 'closed').length),
    }));
    setSelectedTasks(completedToday.map((task) => task.id));
  }

  async function submit(event) {
    event.preventDefault();
    if (total <= 0 && selectedTasks.length === 0) return notify('Record the production for this shift first.', 'error');
    if (form.handoverNotes.trim().length < 10) return notify('Handover notes are required so the next shift has context.', 'error');
    setBusy(true);
    const result = await submitShiftHandover({
      shiftId: shift?.shift?.id || null,
      shiftCode: shift?.shift?.code || null,
      productionOrderId: form.productionOrderId || null,
      workDate: new Date().toISOString().slice(0, 10),
      tasksCompleted: selectedTasks.length,
      totalProduced: total,
      goodPieces: good,
      rejectedPieces: rejected,
      machineIssueCount: Number(form.machineIssueCount || 0),
      toolIssueCount: Number(form.toolIssueCount || 0),
      materialShortageCount: Number(form.materialShortageCount || 0),
      remainingWork: form.remainingWork || null,
      handoverNotes: form.handoverNotes.trim(),
      taskIds: selectedTasks,
    });
    setBusy(false);
    if (result.error) return notify(result.error.message, 'error');
    notify('Shift report submitted. Your supervisor can review and acknowledge it.');
    setForm({ ...form, handoverNotes: '', remainingWork: '', productionOrderId: '' });
    setSelectedTasks([]);
    await workspace.refresh();
    return null;
  }

  async function acknowledge(report) {
    const result = await acknowledgeHandover(report.id);
    if (result.error) return notify(result.error.message, 'error');
    notify('Handover acknowledged.');
    await workspace.refresh();
    return null;
  }

  if (!context) return null;
  if (!data) return <div className="pt-page"><LoadingBlock rows={3} label="Loading shift data" /></div>;

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Operations', 'Shift handover']}
        eyebrow="SHIFT COMPLETION"
        title="Shift handover"
        description="Close the shift with what was produced, what is outstanding and what the next team must know."
        actions={<Button variant="secondary" icon="RefreshCw" onClick={prefill}>Prefill from today</Button>}
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Shift" value={shift?.shift?.code || '—'} icon="CalendarClock" footnote={shift?.label || 'No shift assigned'} />
        <StatCard label="Good today" value={todaySummary.good.toLocaleString()} unit="pcs" icon="CheckCircle2" tone="lime" footnote={`${todaySummary.entries} entries`} />
        <StatCard label="Rejected today" value={todaySummary.rejected.toLocaleString()} unit="pcs" icon="AlertTriangle" tone={todaySummary.rejected ? 'warn' : 'default'} footnote={`${todaySummary.rework} rework`} />
        <StatCard label="Open tasks to hand over" value={openTasks.length} icon="ListChecks" footnote="Continue on the next shift" />
      </section>

      <div className="pt-report-layout">
        <Card title="Submit shift report" subtitle="Totals must balance: produced = good + rejected">
          {canSubmit ? (
            <form className="pt-form-grid" onSubmit={submit}>
              <Field label="Tasks completed this shift" className="pt-form-span" hint="Completion is recorded against your own assigned tasks.">
                <div className="pt-check-list">
                  {(completedToday.length ? completedToday : myTasks).map((task) => (
                    <label key={task.id} className="pt-check-row">
                      <input type="checkbox" checked={selectedTasks.includes(task.id)} onChange={() => toggleTask(task.id)} />
                      <span><strong>{task.title}</strong><small>{Number(task.completedQuantity || 0)} / {Number(task.targetQuantity || 0)} pcs · {task.productionStatus}</small></span>
                    </label>
                  ))}
                  {!myTasks.length ? <p className="pt-muted pt-small">No tasks assigned today.</p> : null}
                </div>
              </Field>
              <Field label="Good pieces">
                <TextInput type="number" min="0" value={form.goodPieces} onChange={(event) => setForm({ ...form, goodPieces: event.target.value })} />
              </Field>
              <Field label="Rejected pieces">
                <TextInput type="number" min="0" value={form.rejectedPieces} onChange={(event) => setForm({ ...form, rejectedPieces: event.target.value })} />
              </Field>
              <Field label="Total production" hint="Derived: good + rejected.">
                <TextInput value={total} readOnly className="pt-mono" />
              </Field>
              <Field label="Production order">
                <TextInput value={form.productionOrderId} onChange={(event) => setForm({ ...form, productionOrderId: event.target.value })} placeholder="Order id or leave blank" />
              </Field>
              <Field label="Machine issues">
                <TextInput type="number" min="0" value={form.machineIssueCount} onChange={(event) => setForm({ ...form, machineIssueCount: event.target.value })} />
              </Field>
              <Field label="Tool issues">
                <TextInput type="number" min="0" value={form.toolIssueCount} onChange={(event) => setForm({ ...form, toolIssueCount: event.target.value })} />
              </Field>
              <Field label="Material shortages">
                <TextInput type="number" min="0" value={form.materialShortageCount} onChange={(event) => setForm({ ...form, materialShortageCount: event.target.value })} />
              </Field>
              <Field label="Remaining work" className="pt-form-span">
                <Textarea rows={2} value={form.remainingWork} onChange={(event) => setForm({ ...form, remainingWork: event.target.value })} placeholder="Grinding task still paused pending spindle inspection." />
              </Field>
              <Field label="Handover notes" required className="pt-form-span">
                <Textarea rows={3} value={form.handoverNotes} onChange={(event) => setForm({ ...form, handoverNotes: event.target.value })} placeholder="Axle batch continues next shift. Coolant line repaired — monitor pressure for the first hour." required />
              </Field>
              <div className="pt-form-span pt-form-actions">
                <FieldHint icon="Send">Your supervisor and reporting manager are notified when the report is submitted.</FieldHint>
                <Button type="submit" icon="ClipboardCheck" disabled={busy}>{busy ? 'Submitting…' : 'Submit shift report'}</Button>
              </div>
            </form>
          ) : (
            <EmptyState icon="LockKeyhole" title="Handover not permitted" description="Your roles do not include shift completion reporting." />
          )}
        </Card>

        <aside className="pt-report-aside">
          <Card title="Open tasks" subtitle="Work that carries into the next shift">
            {openTasks.length ? (
              <div className="pt-mini-table">
                {openTasks.map((task) => (
                  <div key={task.id} className="pt-mini-row">
                    <div><strong>{task.title}</strong><small>{task.productionStatus} · {Number(task.completedQuantity || 0)} / {Number(task.targetQuantity || 0)} pcs</small></div>
                    {task.pausedReason ? <Badge tone="amber">{task.pausedReason}</Badge> : null}
                  </div>
                ))}
              </div>
            ) : <EmptyState icon="CheckCircle2" title="Nothing outstanding" description="All assigned work is complete." />}
          </Card>

          <Card title="Recent handovers" subtitle="Acknowledged by your supervisor">
            {reports.length ? (
              <div className="pt-mini-table">
                {reports.slice(0, 6).map((report) => (
                  <div key={report.id} className="pt-mini-row">
                    <div>
                      <strong>{report.employee?.fullName || 'Employee'} · {report.workDate}</strong>
                      <small>{report.status} · {Number(report.totalProduced).toLocaleString()} pcs produced</small>
                    </div>
                    <Badge tone={report.status === 'acknowledged' ? 'lime' : 'amber'}>{report.status}</Badge>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon="ClipboardCheck" title="No handovers yet" />}
          </Card>
        </aside>
      </div>

      <Card title="Handover register" subtitle="Submitted shift reports in your scope">
        {reports.length ? (
          <div className="pt-table-scroll">
            <table className="pt-table">
              <thead><tr><th>Employee</th><th>Date</th><th>Shift</th><th>Produced</th><th>Good / Rejected</th><th>Issues</th><th>Status</th><th /></tr></thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <span className="pt-person">
                        <Avatar name={report.employee?.fullName} size="xs" />
                        <span><strong>{report.employee?.fullName || '—'}</strong><small>{report.handoverNotes?.slice(0, 60)}</small></span>
                      </span>
                    </td>
                    <td>{report.workDate}</td>
                    <td>{report.shiftCode || '—'}</td>
                    <td className="pt-mono">{Number(report.totalProduced).toLocaleString()}</td>
                    <td className="pt-mono">{Number(report.goodPieces).toLocaleString()} / {Number(report.rejectedPieces).toLocaleString()}</td>
                    <td><span className="pt-tag-row"><Badge tone="neutral">{report.machineIssueCount ?? 0} M</Badge><Badge tone="neutral">{report.toolIssueCount ?? 0} T</Badge><Badge tone="neutral">{report.materialShortageCount ?? 0} Mat</Badge></span></td>
                    <td>
                      <Badge tone={report.status === 'acknowledged' ? 'lime' : 'amber'} dot>{report.status}</Badge>
                      {report.acknowledgedAt ? <small className="pt-muted">{formatDateTime(report.acknowledgedAt)}</small> : null}
                    </td>
                    <td>
                      {canAcknowledge && report.status === 'submitted' && report.employeeId !== context.employeeId ? (
                        <Button size="sm" icon="Check" onClick={() => acknowledge(report)}>Acknowledge</Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="ClipboardCheck" title="No handovers submitted" description="Shift completion reports appear here with their handover notes." />
        )}
      </Card>
    </div>
  );
}
