import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import {
  issuesFor,
  materialRequestsFor,
  openTasks,
  orderFor,
  productFor,
  reassignmentProposals,
  reportsForScope,
  summariseReports,
  supervisedTasks,
  teamAvailability,
  productionTaskRows,
} from '../data/productionSelectors.js';
import { createProductionTask, updateTaskPriority } from '../data/actions.js';
import { navigate } from '../lib/router.js';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Progress,
  Select,
  StatCard,
  TextInput,
  Textarea,
  formatDateTime,
  relativeTime,
  LoadingBlock,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import {
  IssueStatus,
  MachineStateDot,
  OrderStatus,
  SeverityPill,
  TaskStatus,
} from '../components/Production.jsx';
import { useToast } from '../components/ToastProvider.jsx';

/**
 * Supervisor production control room.
 *
 * The roster, tasks and requests are all returned by RLS scoped to the
 * supervisor's plant/department. Task creation and priority changes are the only
 * writes here; reassignments deliberately go through the approval workflow.
 */
export default function SupervisorDashboardPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const data = workspace.data;
  const [assignOpen, setAssignOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    assigneeEmployeeId: '',
    productionOrderId: '',
    workstationId: '',
    machineId: '',
    title: '',
    description: '',
    workInstructions: '',
    targetQuantity: '',
    priority: 'medium',
    dueAt: '',
  });

  const team = useMemo(() => (data && context ? teamAvailability(data, context) : []), [data, context]);
  const tasks = useMemo(() => (data && context ? supervisedTasks(data, context.employeeId) : []), [data, context]);
  const allVisibleTasks = useMemo(() => productionTaskRows(data), [data]);
  const active = openTasks(tasks);
  const reports = useMemo(() => (data && context ? reportsForScope(data, context) : []), [data, context]);
  const today = new Date().toISOString().slice(0, 10);
  const todayReports = reports.filter((report) => report.workDate === today);
  const todaySummary = summariseReports(todayReports);
  const issues = useMemo(() => (data && context ? issuesFor(data, context) : []), [data, context]);
  const openIssues = issues.filter((issue) => !['resolved', 'closed', 'rejected'].includes(issue.status));
  const materials = useMemo(() => (data ? materialRequestsFor(data) : []), [data]);
  const proposals = useMemo(() => (data && context ? reassignmentProposals(data, context) : []), [data, context]);
  const pendingProposals = proposals.filter((proposal) => proposal.status === 'submitted');
  const machines = data?.machines || [];
  const downMachines = machines.filter((machine) => machine.status === 'down');
  const present = team.filter((row) => ['present', 'remote'].includes(row.attendanceStatus));
  const absent = team.filter((row) => row.attendanceStatus === 'absent');
  const onBreak = team.filter((row) => row.attendanceStatus === 'on_leave');
  const orderTargets = new Map();
  for (const task of active) {
    if (!task.productionOrderId) continue;
    const entry = orderTargets.get(task.productionOrderId) || { target: 0, done: 0, rejected: 0 };
    entry.target += Number(task.targetQuantity || 0);
    entry.done += Number(task.completedQuantity || 0);
    entry.rejected += Number(task.rejectedQuantity || 0);
    orderTargets.set(task.productionOrderId, entry);
  }

  async function submitAssignment() {
    if (!form.assigneeEmployeeId || !form.productionOrderId || form.title.trim().length < 3) {
      notify('Choose an employee, a production order and a task title.', 'error');
      return;
    }
    setBusy(true);
    const order = data.productionOrders.find((item) => item.id === form.productionOrderId);
    const result = await createProductionTask({
      ...form,
      organizationId: context.scope.organizationId,
      createdByEmployeeId: context.employeeId,
      supervisorEmployeeId: context.employeeId,
      targetQuantity: Number(form.targetQuantity) || null,
      dueAt: form.dueAt || null,
      projectId: order?.projectId || null,
    });
    setBusy(false);
    if (result.error) {
      notify(result.error.message, 'error');
      return;
    }
    notify('Task assigned. The operator sees it immediately.');
    setAssignOpen(false);
    setForm({ ...form, title: '', description: '', workInstructions: '', targetQuantity: '', dueAt: '' });
    await workspace.refresh();
  }

  async function changePriority(task, priority) {
    const result = await updateTaskPriority(task.id, priority);
    if (result.error) notify(result.error.message, 'error');
    else {
      notify(`Priority updated to ${priority}.`);
      await workspace.refresh();
    }
  }

  if (!context) return null;
  if (!data) return <div className="pt-page"><LoadingBlock rows={4} label="Loading production data" /></div>;

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Workforce', 'Supervisor']}
        eyebrow="PRODUCTION CONTROL"
        title="Shift control room"
        description="Roster, machines and production for the people you supervise. Reassignments are proposals until an HOD approves them."
        actions={
          <div className="pt-header-actions">
            <Button variant="secondary" icon="Users" onClick={() => navigate('/workforce/employees')}>Team directory</Button>
            <Button icon="Plus" onClick={() => setAssignOpen(true)}>Assign task</Button>
          </div>
        }
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Team assigned" value={team.length} icon="Users" footnote={`${present.length} present · ${absent.length} absent · ${onBreak.length} on leave`} />
        <StatCard label="Active tasks" value={active.length} icon="ListChecks" tone="lime" footnote={`${allVisibleTasks.filter((task) => task.productionStatus === 'blocked' || task.productionStatus === 'paused').length} paused or blocked`} />
        <StatCard label="Machine availability" value={`${machines.length ? Math.round(((machines.length - downMachines.length) / machines.length) * 100) : 0}%`} icon="Zap" tone={downMachines.length ? 'warn' : 'default'} footnote={`${downMachines.length} down of ${machines.length}`} />
        <StatCard label="Rejected today" value={todaySummary.rejected} unit="pcs" icon="AlertTriangle" tone={todaySummary.rejected ? 'warn' : 'default'} footnote={`${todaySummary.good} good · ${todaySummary.rework} rework`} />
      </section>

      <div className="pt-supervisor-grid">
        <Card
          title="Team presence"
          subtitle="Attendance and current work for the shift"
          action={<Button variant="ghost" size="sm" icon="ArrowRight" onClick={() => navigate('/workforce/attendance')}>Attendance register</Button>}
        >
          {team.length ? (
            <div className="pt-table-scroll">
              <table className="pt-table">
                <thead>
                  <tr><th>Employee</th><th>Shift</th><th>Attendance</th><th>Open</th><th>Current task</th><th /></tr>
                </thead>
                <tbody>
                  {team.map((row) => (
                    <tr key={row.employee.id}>
                      <td>
                        <span className="pt-person">
                          <Avatar name={row.employee.fullName} size="xs" />
                          <span><strong>{row.employee.fullName}</strong><small>{row.employee.designation}</small></span>
                        </span>
                      </td>
                      <td>{row.shift ? `${row.shift.code} · ${row.shift.startTime}–${row.shift.endTime}` : '—'}</td>
                      <td><Badge tone={attendanceTone(row.attendanceStatus)} dot>{String(row.attendanceStatus).replaceAll('_', ' ')}</Badge></td>
                      <td className="pt-mono">{row.openTasks}</td>
                      <td>{row.activeTask ? <span className="pt-inline-task"><TaskStatus status={row.activeTask.productionStatus} /> {row.activeTask.title}</span> : <span className="pt-muted">Idle</span>}</td>
                      <td>
                        <Button size="sm" variant="ghost" icon="Plus" onClick={() => { setForm({ ...form, assigneeEmployeeId: row.employee.id }); setAssignOpen(true); }}>Assign</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="Users" title="No team members in scope" description="Employees reporting to you in this department appear here." />
          )}
        </Card>

        <Card title="Target versus actual" subtitle="Open tasks grouped by production order" action={<OrderStatus status="in_progress" />}>
          {orderTargets.size ? (
            <div className="pt-order-progress-list">
              {[...orderTargets.entries()].map(([orderId, totals]) => {
                const order = data.productionOrders.find((item) => item.id === orderId);
                const product = order ? productFor(data, order) : null;
                return (
                  <div key={orderId} className="pt-order-progress">
                    <div className="pt-order-progress-head">
                      <strong>{order?.orderNo || 'Order'} · {product?.name}</strong>
                      <small>{totals.done.toLocaleString()} / {totals.target.toLocaleString()} pcs · {totals.rejected} rejected</small>
                    </div>
                    <Progress value={totals.target ? Math.min((totals.done / totals.target) * 100, 100) : 0} />
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="Gauge" title="No active targets" description="Assign production tasks to see target versus actual." />
          )}
        </Card>
      </div>

      <Card
        title="Active production tasks"
        subtitle="Monitor progress, change priority and open the task board"
        action={<Button variant="ghost" size="sm" icon="ClipboardList" onClick={() => navigate('/production/tasks')}>Task board</Button>}
      >
        {active.length ? (
          <div className="pt-table-scroll">
            <table className="pt-table">
              <thead>
                <tr><th>Task</th><th>Operator</th><th>Order</th><th>Machine</th><th>Status</th><th>Progress</th><th>Priority</th><th>Due</th></tr>
              </thead>
              <tbody>
                {active.map((task) => {
                  const order = orderFor(data, task);
                  const assignee = data.employees.find((employee) => employee.id === task.assigneeEmployeeId);
                  const machine = data.machines.find((item) => item.id === task.machineId);
                  return (
                    <tr key={task.id}>
                      <td><strong>{task.title}</strong><small className="pt-muted">{task.description}</small></td>
                      <td>{assignee?.fullName || '—'}</td>
                      <td className="pt-mono">{order?.orderNo || '—'}</td>
                      <td>{machine ? <span className="pt-inline-task">{machine.name}<MachineStateDot state={machine.status} /></span> : '—'}</td>
                      <td><TaskStatus status={task.productionStatus} /></td>
                      <td className="pt-progress-cell">
                        <Progress value={task.targetQuantity ? Math.min((Number(task.completedQuantity) / Number(task.targetQuantity)) * 100, 100) : 0} />
                        <small>{Number(task.completedQuantity).toLocaleString()} / {Number(task.targetQuantity || 0).toLocaleString()}</small>
                      </td>
                      <td>
                        <Select value={task.priority} onChange={(event) => changePriority(task, event.target.value)} aria-label={`Priority for ${task.title}`}>
                          {['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{value}</option>)}
                        </Select>
                      </td>
                      <td className={new Date(task.dueAt) < new Date() ? 'pt-warn-text' : ''}>{task.dueAt ? relativeTime(task.dueAt) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="ListChecks" title="No active tasks" description="Assign work to an operator to start production." action={<Button size="sm" icon="Plus" onClick={() => setAssignOpen(true)}>Assign task</Button>} />
        )}
      </Card>

      <div className="pt-supervisor-grid">
        <Card title="Open technical tickets" subtitle="Machine issues raised by the team" action={<Button variant="ghost" size="sm" icon="AlertTriangle" onClick={() => navigate('/operations/issues')}>All issues</Button>}>
          {openIssues.length ? (
            <div className="pt-mini-table">
              {openIssues.slice(0, 6).map((issue) => {
                const machine = data.machines.find((item) => item.id === issue.machineId);
                return (
                  <div key={issue.id} className="pt-mini-row">
                    <div>
                      <strong>{issue.category}</strong>
                      <small>{machine?.name || 'Machine'} · {issue.downtimeMinutes} min down</small>
                    </div>
                    <div className="pt-mini-row-tags">
                      <SeverityPill severity={issue.severity} />
                      <IssueStatus status={issue.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="CheckCircle2" title="No open tickets" description="Technical issues raised by operators appear here." />
          )}
        </Card>

        <Card title="Material requests" subtitle="Raised through the shared workflow" action={<Button variant="ghost" size="sm" icon="Box" onClick={() => navigate('/operations/issues')}>New request</Button>}>
          {materials.length ? (
            <div className="pt-mini-table">
              {materials.slice(0, 6).map((row) => (
                <div key={row.requestId} className="pt-mini-row">
                  <div>
                    <strong>{row.material?.name || 'Material'}</strong>
                    <small>{Number(row.requiredQuantity).toLocaleString()} {row.unit} · {row.request?.status || 'submitted'}</small>
                  </div>
                  <Badge tone={row.request?.status === 'approved' ? 'lime' : 'amber'}>{row.request?.status || 'submitted'}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="Box" title="No material requests" description="Shortages raised by the team appear here with their workflow status." />
          )}
        </Card>

        <Card title="Pending reassignments" subtitle="Awaiting HOD or delegated approval" action={<Button variant="ghost" size="sm" icon="ArrowRight" onClick={() => navigate('/operations/reassignment')}>Open workflow</Button>}>
          {pendingProposals.length ? (
            <div className="pt-mini-table">
              {pendingProposals.slice(0, 5).map((proposal) => (
                <div key={proposal.requestId} className="pt-mini-row">
                  <div>
                    <strong>{proposal.employee?.fullName}</strong>
                    <small>{proposal.proposedTask?.title || 'Workstation change'} · effective {formatDateTime(proposal.effectiveAt)}</small>
                  </div>
                  <Badge tone="amber" dot>{proposal.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="UserRoundCheck" title="Nothing pending" description="Reassignment proposals you raise wait here until they are decided." />
          )}
        </Card>
      </div>

      <Card
        title="Shift reports to review"
        subtitle="Completion and handover notes from the team"
        action={<Button variant="ghost" size="sm" icon="ClipboardCheck" onClick={() => navigate('/operations/handover')}>Shift handover</Button>}
      >
        {data.shiftReports?.length ? (
          <div className="pt-table-scroll">
            <table className="pt-table">
              <thead><tr><th>Employee</th><th>Date</th><th>Produced</th><th>Good</th><th>Rejected</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.shiftReports.slice(0, 8).map((report) => {
                  const employee = data.employees.find((item) => item.id === report.employeeId);
                  return (
                    <tr key={report.id}>
                      <td>{employee?.fullName || '—'}</td>
                      <td>{report.workDate}</td>
                      <td className="pt-mono">{Number(report.totalProduced).toLocaleString()}</td>
                      <td className="pt-mono">{Number(report.goodPieces).toLocaleString()}</td>
                      <td className="pt-mono">{Number(report.rejectedPieces).toLocaleString()}</td>
                      <td><Badge tone={report.status === 'acknowledged' ? 'lime' : 'amber'} dot>{report.status}</Badge></td>
                      <td><Button size="sm" variant="ghost" onClick={() => navigate('/operations/handover')}>Review</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="ClipboardCheck" title="No shift reports yet" description="Operators submit a completion report at the end of each shift." />
        )}
      </Card>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign production task"
        description="The operator cannot change this assignment; only you or an HOD can."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button icon="Check" onClick={submitAssignment} disabled={busy}>{busy ? 'Assigning…' : 'Assign task'}</Button>
          </>
        }
      >
        <div className="pt-form-grid">
          <Field label="Operator" required>
            <Select value={form.assigneeEmployeeId} onChange={(event) => setForm({ ...form, assigneeEmployeeId: event.target.value })}>
              <option value="">Choose an employee</option>
              {team.map((row) => <option key={row.employee.id} value={row.employee.id}>{row.employee.fullName} · {row.employee.designation}</option>)}
            </Select>
          </Field>
          <Field label="Production order" required>
            <Select
              value={form.productionOrderId}
              onChange={(event) => {
                const order = data.productionOrders.find((item) => item.id === event.target.value);
                setForm({ ...form, productionOrderId: event.target.value, workstationId: '', machineId: '' });
                if (order) setForm((current) => ({ ...current, productionOrderId: event.target.value }));
              }}
            >
              <option value="">Choose an order</option>
              {(data.productionOrders || []).filter((order) => !['completed', 'cancelled'].includes(order.status)).map((order) => (
                <option key={order.id} value={order.id}>{order.orderNo} · {productFor(data, order)?.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Workstation">
            <Select value={form.workstationId} onChange={(event) => setForm({ ...form, workstationId: event.target.value })}>
              <option value="">Not specified</option>
              {(data.workstations || []).map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
            </Select>
          </Field>
          <Field label="Machine">
            <Select value={form.machineId} onChange={(event) => setForm({ ...form, machineId: event.target.value })}>
              <option value="">Not specified</option>
              {(data.machines || []).map((machine) => <option key={machine.id} value={machine.id}>{machine.name} · {machine.status}</option>)}
            </Select>
          </Field>
          <Field label="Task title" required>
            <TextInput value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Turn axle housing batch A" />
          </Field>
          <Field label="Target quantity">
            <TextInput type="number" min="1" value={form.targetQuantity} onChange={(event) => setForm({ ...form, targetQuantity: event.target.value })} placeholder="120" />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              {['low', 'medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </Field>
          <Field label="Due">
            <TextInput type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} />
          </Field>
          <Field label="Description" className="pt-form-span">
            <Textarea rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <Field label="Work instructions" className="pt-form-span" hint="Shown to the operator before they start.">
            <Textarea rows={3} value={form.workInstructions} onChange={(event) => setForm({ ...form, workInstructions: event.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function attendanceTone(status) {
  if (['present', 'remote'].includes(status)) return 'lime';
  if (['late', 'half_day'].includes(status)) return 'amber';
  if (status === 'absent') return 'red';
  if (status === 'on_leave') return 'violet';
  return 'neutral';
}
