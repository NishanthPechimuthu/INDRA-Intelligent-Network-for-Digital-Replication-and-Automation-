import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { todayShiftSummary } from '../data/selectors.js';
import {
  machineFor,
  openTasks,
  orderFor,
  productFor,
  reportsForEmployee,
  summariseReports,
  tasksForEmployee,
  workstationFor,
  productionLineFor,
  remainingTarget,
} from '../data/productionSelectors.js';
import { transitionTask } from '../data/actions.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Textarea,
  formatDate,
  formatDateTime,
  relativeTime,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import {
  MachineStateDot,
  MetricStrip,
  OrderStatus,
  PriorityPill,
  QuantityBreakdown,
  TaskStatus,
  TaskTransitionButtons,
} from '../components/Production.jsx';
import { useToast } from '../components/ToastProvider.jsx';

/**
 * Operator workstation view.
 *
 * Everything on this page is read through RLS: the tasks, order, machine and
 * shift are already scoped to the signed-in employee. The action buttons call
 * protected RPCs, so an operator cannot move a task they were not assigned, nor
 * reassign themselves to different work.
 */
export default function OperatorDashboardPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const data = workspace.data;
  const employee = context?.employee;
  const [busyId, setBusyId] = useState('');
  const [reasonTask, setReasonTask] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonAction, setReasonAction] = useState('pause');

  const tasks = useMemo(() => (data && context ? tasksForEmployee(data, context.employeeId) : []), [data, context]);
  const active = tasks.filter((task) => ['in_progress', 'paused', 'blocked', 'accepted'].includes(task.productionStatus));
  const currentTask = tasks.find((task) => task.productionStatus === 'in_progress') || active[0] || null;
  const shiftSummary = useMemo(() => (data && context ? todayShiftSummary(data, context.employeeId) : null), [data, context]);
  const currentOrder = currentTask ? orderFor(data, currentTask) : null;
  const product = currentOrder ? productFor(data, currentOrder) : null;
  const machine = currentTask ? machineFor(data, currentTask.machineId) : null;
  const workstation = currentTask ? workstationFor(data, currentTask.workstationId) : null;
  const line = currentTask ? productionLineFor(data, workstation?.productionLineId || currentOrder?.productionLineId) : null;
  const supervisor = data?.employees?.find((item) => item.id === (currentTask?.supervisorEmployeeId || employee?.reportingManagerId));
  const todayReports = data && context ? reportsForEmployee(data, context.employeeId, new Date().toISOString().slice(0, 10)) : [];
  const todaySummary = summariseReports(todayReports);
  const open = openTasks(tasks);
  const completed = tasks.filter((task) => task.productionStatus === 'completed');
  const attendance = data?.attendanceRecords?.find(
    (record) => record.employeeId === context?.employeeId && record.workDate === new Date().toISOString().slice(0, 10),
  );
  const lunch = shiftSummary?.shift ? { start: shiftSummary.shift.lunchStart, end: shiftSummary.shift.lunchEnd } : null;
  const breaks = shiftSummary?.shift?.breaks || [];
  const dailyTarget = open.reduce((total, task) => total + Number(task.targetQuantity || 0), 0);
  const dailyDone = open.reduce((total, task) => total + Number(task.completedQuantity || 0), 0);
  const dailyRejected = open.reduce((total, task) => total + Number(task.rejectedQuantity || 0), 0);

  function requestReason(task, action) {
    setReasonAction(action);
    setReasonTask(task);
    setReason('');
  }

  async function runTransition(task, action, why) {
    setBusyId(task.id);
    const result = await transitionTask(task.id, action, why);
    setBusyId('');
    if (result.error) {
      notify(result.error.message, 'error');
      return false;
    }
    await workspace.refresh();
    return true;
  }

  async function onTransition(task, action) {
    if (action === 'pause' || action === 'blocked') {
      requestReason(task, action);
      return;
    }
    const done = await runTransition(task, action);
    if (done) {
      notify(
        action === 'complete'
          ? 'Completion reported. Record the produced quantity next.'
          : `Task ${action === 'start' ? 'started' : action}.`,
      );
      if (action === 'complete') navigate('/production/reports');
    }
  }

  async function confirmReason() {
    if (reason.trim().length < 3) {
      notify('Describe why the work is stopping (at least three characters).', 'error');
      return;
    }
    const done = await runTransition(reasonTask, reasonAction, reason.trim());
    if (done) {
      notify(reasonAction === 'pause' ? 'Task paused and your supervisor notified.' : 'Task marked blocked.');
      setReasonTask(null);
    }
  }

  if (!context) return null;

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Workforce', 'Operator']}
        eyebrow="OPERATOR WORKSTATION"
        title={`Good ${greeting()}, ${employee?.firstName || 'operator'}`}
        description="Your shift, machine and assigned production for today. Actions are recorded against your employee identity."
        actions={
          <div className="pt-header-actions">
            <Button variant="secondary" icon="FileText" onClick={() => navigate('/production/reports')}>Record production</Button>
            <Button icon="ClipboardList" onClick={() => navigate('/production/tasks')}>My task board</Button>
          </div>
        }
      />

      <MetricStrip
        metrics={[
          { label: 'Daily target', value: dailyTarget.toLocaleString(), unit: 'pcs', icon: 'Gauge', footnote: `${open.length} open task${open.length === 1 ? '' : 's'}` },
          { label: 'Completed today', value: todaySummary.good.toLocaleString(), unit: 'pcs', icon: 'CheckCircle2', tone: 'lime', footnote: `${todaySummary.entries} production entries` },
          { label: 'Rejected today', value: todaySummary.rejected.toLocaleString(), unit: 'pcs', icon: 'AlertTriangle', tone: todaySummary.rejected ? 'warn' : 'default', footnote: `${todaySummary.rework} rework inside rejects` },
          { label: 'Remaining', value: Math.max(dailyTarget - dailyDone, 0).toLocaleString(), unit: 'pcs', icon: 'Timer', footnote: `${dailyRejected} rejected so far` },
        ]}
      />

      <div className="pt-operator-grid">
        <Card title="Shift & assignment" subtitle={shiftSummary?.label || 'No shift assigned today'} action={<Badge tone={shiftSummary?.working ? 'lime' : 'neutral'} dot>{shiftSummary?.working ? 'Working day' : 'Non-working'}</Badge>}>
          <div className="pt-shift-block">
            <div className="pt-shift-time">
              <span className="pt-shift-icon"><Icon name="Clock3" size={18} /></span>
              <div>
                <strong>{shiftSummary?.shift?.name || 'Unassigned'}</strong>
                <small>{shiftSummary?.label || '—'} · {shiftSummary?.duration || '—'} net</small>
              </div>
            </div>
            <dl className="pt-fact-list">
              <div><dt><Icon name="Utensils" size={13} /> Lunch</dt><dd>{lunch?.start ? `${lunch.start} – ${lunch.end}` : 'No lunch break configured'}</dd></div>
              <div><dt><Icon name="Coffee" size={13} /> Breaks</dt><dd>{breaks.length ? breaks.map((item) => `${item.name} ${item.startTime}–${item.endTime}`).join(' · ') : 'None configured'}</dd></div>
              <div><dt><Icon name="Fingerprint" size={13} /> Attendance</dt><dd><Badge tone={attendanceTone(attendance?.status)} dot>{String(attendance?.status || 'not marked').replaceAll('_', ' ')}</Badge></dd></div>
              <div><dt><Icon name="UserRoundCheck" size={13} /> Supervisor</dt><dd>{supervisor?.fullName || 'Not assigned'}</dd></div>
              <div><dt><Icon name="Building2" size={13} /> Department</dt><dd>{employee?.department || '—'}</dd></div>
              <div><dt><Icon name="Factory" size={13} /> Production line</dt><dd>{line?.name || employee?.productionLine || '—'}</dd></div>
              <div><dt><Icon name="Box" size={13} /> Workstation</dt><dd>{workstation?.name || 'Not assigned'}</dd></div>
              <div><dt><Icon name="Zap" size={13} /> Machine</dt><dd>{machine ? <>{machine.name} <MachineStateDot state={machine.status} /></> : '—'}</dd></div>
            </dl>
          </div>
        </Card>

        <Card
          title="Current production"
          subtitle={currentOrder ? `${currentOrder.orderNo} · ${product?.name || 'Product'}` : 'No order released to you'}
          action={currentOrder ? <OrderStatus status={currentOrder.status} /> : null}
        >
          {currentOrder ? (
            <div className="pt-current-production">
              <div className="pt-current-order-head">
                <div>
                  <h3>{currentTask?.title || product?.name}</h3>
                  <p className="pt-muted pt-small">{currentTask?.description || currentOrder.notes}</p>
                </div>
                <div className="pt-current-tags">
                  <PriorityPill priority={currentTask?.priority || currentOrder.priority} />
                  {currentTask ? <TaskStatus status={currentTask.productionStatus} /> : null}
                </div>
              </div>
              <QuantityBreakdown
                target={currentTask?.targetQuantity || currentOrder.quantityPlanned}
                completed={currentTask?.completedQuantity || currentOrder.quantityCompleted}
                rejected={currentTask?.rejectedQuantity || currentOrder.quantityRejected}
              />
              <dl className="pt-fact-grid">
                <div><dt>Batch</dt><dd className="pt-mono">{currentOrder.batchNo || '—'}</dd></div>
                <div><dt>Planned end</dt><dd>{currentOrder.plannedEndAt ? formatDateTime(currentOrder.plannedEndAt) : '—'}</dd></div>
                <div><dt>Order target</dt><dd>{Number(currentOrder.quantityPlanned).toLocaleString()} pcs</dd></div>
                <div><dt>Remaining</dt><dd>{remainingTarget(currentTask || {}).toLocaleString()} pcs</dd></div>
              </dl>
              {currentTask?.workInstructions ? (
                <details className="pt-instructions">
                  <summary><Icon name="BookOpen" size={13} /> Work instructions</summary>
                  <pre>{currentTask.workInstructions}</pre>
                </details>
              ) : null}
              {currentTask ? (
                <TaskTransitionButtons task={currentTask} busy={busyId === currentTask.id} onTransition={onTransition} />
              ) : null}
            </div>
          ) : (
            <EmptyState icon="Factory" title="No active production task" description="Your supervisor releases work to this workstation. Existing completed work stays visible in your history." />
          )}
        </Card>

        <Card title="Today at a glance" subtitle="Live figures from your own reports">
          <ul className="pt-mini-list">
            <li><span><Icon name="CheckCircle2" size={14} /> Good pieces</span><strong>{todaySummary.good.toLocaleString()}</strong></li>
            <li><span><Icon name="AlertTriangle" size={14} /> Rejected pieces</span><strong>{todaySummary.rejected.toLocaleString()}</strong></li>
            <li><span><Icon name="RefreshCw" size={14} /> Rework (inside rejects)</span><strong>{todaySummary.rework.toLocaleString()}</strong></li>
            <li><span><Icon name="Timer" size={14} /> Downtime recorded</span><strong>{todaySummary.downtime} min</strong></li>
            <li><span><Icon name="ListChecks" size={14} /> Tasks completed</span><strong>{completed.length}</strong></li>
          </ul>
          <Button variant="secondary" size="sm" icon="Plus" onClick={() => navigate('/operations/issues')}>Report an issue</Button>
        </Card>
      </div>

      <Card
        title="My assigned tasks"
        subtitle="Accept work before starting. Pausing or blocking requires a reason."
        action={<Button variant="ghost" size="sm" icon="ArrowRight" onClick={() => navigate('/production/tasks')}>Open task board</Button>}
      >
        {tasks.length ? (
          <div className="pt-task-list">
            {tasks.map((task) => {
              const order = orderFor(data, task);
              const taskProduct = productFor(data, order);
              const taskMachine = machineFor(data, task.machineId);
              return (
                <article key={task.id} className={`pt-task-row pt-task-row-${task.productionStatus || 'assigned'}`}>
                  <div className="pt-task-row-main">
                    <div className="pt-task-row-head">
                      <span className="pt-mono pt-muted">{task.id.slice(-8)}</span>
                      <TaskStatus status={task.productionStatus} />
                      <PriorityPill priority={task.priority} />
                      {task.pausedReason ? <Badge tone="amber">{task.pausedReason}</Badge> : null}
                    </div>
                    <h3>{task.title}</h3>
                    <p className="pt-muted pt-small">{task.description}</p>
                    <div className="pt-task-row-meta">
                      <span><Icon name="Layers" size={12} /> {taskProduct?.name || 'Product'}</span>
                      <span><Icon name="FileText" size={12} /> {order?.orderNo || 'No order'}</span>
                      <span><Icon name="Zap" size={12} /> {taskMachine?.name || 'No machine'}</span>
                      <span><Icon name="UserRoundCheck" size={12} /> {data?.employees?.find((item) => item.id === task.supervisorEmployeeId)?.fullName || 'Supervisor'}</span>
                      <span><Icon name="Calendar" size={12} /> {task.plannedStartAt ? formatDateTime(task.plannedStartAt) : 'Not scheduled'}</span>
                      <span className={new Date(task.dueAt) < new Date() && task.productionStatus !== 'completed' ? 'pt-warn-text' : ''}>
                        <Icon name="Clock" size={12} /> Due {task.dueAt ? relativeTime(task.dueAt) : '—'}
                      </span>
                    </div>
                    <QuantityBreakdown target={task.targetQuantity} completed={task.completedQuantity} rejected={task.rejectedQuantity} />
                  </div>
                  <div className="pt-task-row-side">
                    <TaskTransitionButtons task={task} busy={busyId === task.id} onTransition={onTransition} compact />
                    {task.workInstructions ? <small className="pt-muted">Instructions attached</small> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="ListChecks" title="No tasks assigned" description="Work assigned to you by your supervisor appears here with its machine, target and instructions." />
        )}
      </Card>

      <Card title="Previous work" subtitle="Completed and cancelled tasks" action={<Button variant="ghost" size="sm" icon="History" onClick={() => navigate('/work-history')}>Full work history</Button>}>
        {completed.length ? (
          <div className="pt-history-strip">
            {completed.slice(0, 6).map((task) => (
              <div key={task.id} className="pt-history-chip">
                <TaskStatus status={task.productionStatus} />
                <strong>{task.title}</strong>
                <small>{Number(task.completedQuantity || 0).toLocaleString()} / {Number(task.targetQuantity || 0).toLocaleString()} pcs · {Number(task.rejectedQuantity || 0)} rejected</small>
                <small className="pt-muted">{task.startedAt ? formatDate(task.startedAt) : '—'}</small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="History" title="No completed work yet" description="Completed tasks and their production figures appear here." />
        )}
      </Card>

      <Modal
        open={Boolean(reasonTask)}
        onClose={() => setReasonTask(null)}
        title={reasonAction === 'pause' ? 'Pause work' : 'Mark task blocked'}
        description={reasonTask ? `${reasonTask.title} · the reason is shared with your supervisor.` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReasonTask(null)}>Cancel</Button>
            <Button
              variant={reasonAction === 'pause' ? 'primary' : 'danger'}
              icon={reasonAction === 'pause' ? 'Pause' : 'AlertTriangle'}
              onClick={confirmReason}
              disabled={busyId === reasonTask?.id}
            >
              {busyId === reasonTask?.id ? 'Recording…' : reasonAction === 'pause' ? 'Pause task' : 'Block task'}
            </Button>
          </>
        }
      >
        <Field label="Reason" hint="Material shortage, machine fault, quality hold or a handover instruction." required>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Awaiting M8 flange bolts from stores." />
        </Field>
      </Modal>
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function attendanceTone(status) {
  if (!status || status === 'not_marked') return 'neutral';
  if (['present', 'remote'].includes(status)) return 'lime';
  if (['late', 'half_day'].includes(status)) return 'amber';
  if (['absent'].includes(status)) return 'red';
  return 'blue';
}
