import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import {
  machineFor,
  orderFor,
  productFor,
  productionTaskRows,
  remainingTarget,
  supervisedTasks,
  tasksForEmployee,
} from '../data/productionSelectors.js';
import { hasPermission } from '../data/accessControl.js';
import { transitionTask } from '../data/actions.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Segmented,
  StatCard,
  Textarea,
  relativeTime,
  LoadingBlock,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { PriorityPill, QuantityBreakdown, TaskStatus, TaskTransitionButtons } from '../components/Production.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const COLUMNS = ['assigned', 'accepted', 'in_progress', 'paused', 'blocked', 'completed'];

/**
 * Task board for operators and supervisors.
 *
 * Operators see their own work; supervisors see the tasks they supervise. The
 * board never exposes an assignment control: reassignment goes through the
 * approval workflow.
 */
export default function TaskBoardPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const data = workspace.data;
  const [scope, setScope] = useState('mine');
  const [busyId, setBusyId] = useState('');
  const [reasonTask, setReasonTask] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonAction, setReasonAction] = useState('pause');

  const mine = useMemo(() => (data && context ? tasksForEmployee(data, context.employeeId) : []), [data, context]);
  const supervised = useMemo(() => (data && context ? supervisedTasks(data, context.employeeId) : []), [data, context]);
  const canSeeAll = hasPermission(context?.permissions, 'tasks.read.all');
  const all = useMemo(() => productionTaskRows(data), [data]);
  const tasks = scope === 'mine' ? mine : scope === 'supervised' ? supervised : all;
  const visible = tasks.filter((task) => COLUMNS.includes(task.productionStatus || 'assigned'));

  async function run(task, action, why) {
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
      setReasonTask(task);
      setReasonAction(action);
      setReason('');
      return;
    }
    const done = await run(task, action);
    if (done) {
      notify(`Task ${action === 'complete' ? 'completed' : action}.`);
      if (action === 'complete') navigate('/production/reports');
    }
  }

  async function confirmReason() {
    if (reason.trim().length < 3) {
      notify('A reason of at least three characters is required.', 'error');
      return;
    }
    const done = await run(reasonTask, reasonAction, reason.trim());
    if (done) {
      notify(reasonAction === 'pause' ? 'Task paused.' : 'Task blocked.');
      setReasonTask(null);
    }
  }

  if (!data) return <div className="pt-page"><LoadingBlock rows={4} label="Loading tasks" /></div>;

  const blocked = visible.filter((task) => ['paused', 'blocked'].includes(task.productionStatus));

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Production', 'Task board']}
        eyebrow="EXECUTION BOARD"
        title="Task board"
        description="Every production task with its machine, target and status. Operators drive their own work; supervisors monitor and reassign through approval."
        actions={
          <div className="pt-header-actions">
            <Button variant="secondary" icon="Box" onClick={() => navigate('/production/orders')}>Production orders</Button>
            <Button icon="FileText" onClick={() => navigate('/production/reports')}>Record production</Button>
          </div>
        }
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Open tasks" value={visible.filter((task) => !['completed', 'cancelled'].includes(task.productionStatus)).length} icon="ListChecks" footnote={`${visible.length} in view`} />
        <StatCard label="In progress" value={visible.filter((task) => task.productionStatus === 'in_progress').length} icon="Activity" tone="lime" footnote="Running now" />
        <StatCard label="Paused or blocked" value={blocked.length} icon="AlertTriangle" tone={blocked.length ? 'warn' : 'default'} footnote="Needs a supervisor" />
        <StatCard label="Remaining pieces" value={visible.reduce((total, task) => total + remainingTarget(task), 0).toLocaleString()} icon="Gauge" footnote="Across visible tasks" />
      </section>

      <Card
        title="Board"
        subtitle="Assigned → accepted → in progress → completed"
        action={
          <Segmented
            label="Scope"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'mine', label: `Mine (${mine.length})` },
              ...(supervised.length || canSeeAll ? [{ value: 'supervised', label: `Supervised (${supervised.length})` }] : []),
              ...(canSeeAll ? [{ value: 'all', label: `All (${all.length})` }] : []),
            ]}
          />
        }
      >
        <div className="pt-kanban pt-kanban-production">
          {COLUMNS.map((status) => {
            const columnTasks = visible.filter((task) => (task.productionStatus || 'assigned') === status);
            return (
              <section key={status} className={`pt-kanban-column pt-kanban-${status}`}>
                <header>
                  <span><TaskStatus status={status} /></span>
                  <Badge tone="neutral">{columnTasks.length}</Badge>
                </header>
                <div className="pt-kanban-list">
                  {columnTasks.length ? columnTasks.map((task) => {
                    const order = orderFor(data, task);
                    const product = productFor(data, order);
                    const machine = machineFor(data, task.machineId);
                    const assignee = data.employees.find((employee) => employee.id === task.assigneeEmployeeId);
                    return (
                      <article key={task.id} className="pt-task-card">
                        <div className="pt-task-card-top">
                          <PriorityPill priority={task.priority} />
                          <span className="pt-mono pt-muted">{task.id.slice(-6)}</span>
                        </div>
                        <h3>{task.title}</h3>
                        <p className="pt-muted pt-small">{product?.name} · {order?.orderNo}</p>
                        <div className="pt-task-meta">
                          <span><Icon name="Zap" size={12} /> {machine?.name || 'No machine'}</span>
                          <span><Icon name="Clock" size={12} /> {task.dueAt ? relativeTime(task.dueAt) : 'No due date'}</span>
                        </div>
                        <QuantityBreakdown target={task.targetQuantity} completed={task.completedQuantity} rejected={task.rejectedQuantity} />
                        {task.pausedReason ? <p className="pt-task-reason"><Icon name="AlertTriangle" size={12} /> {task.pausedReason}</p> : null}
                        <div className="pt-task-card-foot">
                          <span className="pt-task-assignee">
                            <Avatar name={assignee?.fullName} size="xs" />
                            <small>{assignee?.fullName || 'Unassigned'}</small>
                          </span>
                          {task.assigneeEmployeeId === context.employeeId ? (
                            <TaskTransitionButtons task={task} busy={busyId === task.id} onTransition={onTransition} compact />
                          ) : (
                            <small className="pt-muted">Supervisor view</small>
                          )}
                        </div>
                      </article>
                    );
                  }) : (
                    <EmptyState icon="Inbox" title="Column clear" description={status === 'assigned' ? 'New work appears here.' : ''} />
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </Card>

      <Modal
        open={Boolean(reasonTask)}
        onClose={() => setReasonTask(null)}
        title={reasonAction === 'pause' ? 'Pause work' : 'Mark task blocked'}
        description={reasonTask?.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReasonTask(null)}>Cancel</Button>
            <Button variant={reasonAction === 'pause' ? 'primary' : 'danger'} icon={reasonAction === 'pause' ? 'Pause' : 'AlertTriangle'} onClick={confirmReason} disabled={busyId === reasonTask?.id}>
              {reasonAction === 'pause' ? 'Pause task' : 'Block task'}
            </Button>
          </>
        }
      >
        <Field label="Reason" required hint="Shared with your supervisor and written to the task history.">
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tool change required; carbide bars exhausted." />
        </Field>
      </Modal>
    </div>
  );
}
