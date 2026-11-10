import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { tasksFor } from '../data/selectors.js';
import { hasPermission } from '../data/accessControl.js';
import { updateTaskStatus } from '../data/actions.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Select,
  StatCard,
  Tabs,
  formatDate,
  relativeTime,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const COLUMNS = [
  { id: 'todo', label: 'To do', icon: 'Circle' },
  { id: 'in_progress', label: 'In progress', icon: 'Activity' },
  { id: 'blocked', label: 'Blocked', icon: 'AlertTriangle' },
  { id: 'done', label: 'Done', icon: 'CheckCircle2' },
];

const PRIORITY_TONE = { critical: 'red', high: 'amber', medium: 'blue', low: 'neutral' };

export default function TasksPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const [scope, setScope] = useState('mine');
  const [busyId, setBusyId] = useState('');
  const tasks = useMemo(() => (workspace.data && context ? tasksFor(workspace.data, context) : []), [workspace.data, context]);
  const canSeeAll = hasPermission(context?.permissions, 'tasks.read.all');
  const visible = scope === 'mine' ? tasks.filter((task) => task.assigneeEmployeeId === context.employeeId) : tasks;
  const open = visible.filter((task) => task.status !== 'done' && task.status !== 'cancelled');
  const overdue = open.filter((task) => new Date(task.dueAt) < new Date());

  async function changeStatus(task, status) {
    setBusyId(task.id);
    const result = await updateTaskStatus(task.id, status);
    setBusyId('');
    if (result.error) notify(result.error.message, 'error');
    else {
      notify(`“${task.title}” moved to ${status.replaceAll('_', ' ')}.`);
      await workspace.refresh();
    }
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Workspace', 'My tasks']}
        eyebrow="WORK QUEUE"
        title="My tasks"
        description="Actions assigned to you across approvals, operations and projects. Status changes are audit logged."
        actions={canSeeAll ? <Tabs active={scope} onChange={setScope} tabs={[{ id: 'mine', label: 'My tasks', count: tasks.filter((task) => task.assigneeEmployeeId === context.employeeId).length }, { id: 'team', label: 'Team tasks', count: tasks.length }]} /> : null}
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Open tasks" value={open.length} icon="ListChecks" footnote={`${visible.filter((task) => task.status === 'in_progress').length} in progress`} />
        <StatCard label="Overdue" value={overdue.length} icon="AlertTriangle" tone={overdue.length ? 'warn' : 'default'} footnote={overdue.length ? 'Requires attention today' : 'Nothing overdue'} />
        <StatCard label="Due this week" value={open.filter((task) => new Date(task.dueAt) < new Date(Date.now() + 7 * 86400000)).length} icon="CalendarClock" footnote="Next seven days" />
        <StatCard label="Completed" value={visible.filter((task) => task.status === 'done').length} icon="CheckCircle2" tone="lime" footnote="Visible tasks" />
      </section>

      <div className="pt-kanban">
        {COLUMNS.map((column) => {
          const columnTasks = visible.filter((task) => task.status === column.id);
          return (
            <section key={column.id} className={`pt-kanban-column pt-kanban-${column.id}`}>
              <header>
                <span><Icon name={column.icon} size={15} /> {column.label}</span>
                <Badge tone="neutral">{columnTasks.length}</Badge>
              </header>
              <div className="pt-kanban-list">
                {columnTasks.length ? columnTasks.map((task) => (
                  <article key={task.id} className="pt-task-card">
                    <div className="pt-task-card-top">
                      <Badge tone={PRIORITY_TONE[task.priority] || 'neutral'} dot>{task.priority}</Badge>
                      <span className="pt-mono pt-muted">{task.id.slice(-6)}</span>
                    </div>
                    <h3>{task.title}</h3>
                    <p>{task.description}</p>
                    <div className="pt-task-meta">
                      {task.project && <span><Icon name="Layers" size={12} /> {task.project.name}</span>}
                      <span className={new Date(task.dueAt) < new Date() && task.status !== 'done' ? 'pt-warn-text' : ''}>
                        <Icon name="Calendar" size={12} /> {relativeTime(task.dueAt)} · {formatDate(task.dueAt)}
                      </span>
                    </div>
                    <div className="pt-task-card-foot">
                      <span className="pt-task-assignee">
                        <Avatar name={task.assignee?.fullName} size="xs" />
                        <small>{task.assignee?.fullName}</small>
                      </span>
                      <Select
                        aria-label={`Change status for ${task.title}`}
                        value={task.status}
                        disabled={busyId === task.id || (task.assigneeEmployeeId !== context.employeeId && !hasPermission(context.permissions, 'tasks.manage'))}
                        onChange={(event) => changeStatus(task, event.target.value)}
                      >
                        {COLUMNS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                        <option value="cancelled">Cancelled</option>
                      </Select>
                    </div>
                  </article>
                )) : (
                  <EmptyState icon={column.icon} title={column.id === 'done' ? 'Nothing completed yet' : 'Column clear'} description={column.id === 'todo' ? 'New assignments appear here.' : ''} />
                )}
              </div>
            </section>
          );
        })}
      </div>

      {!visible.length && <Card><EmptyState icon="ListChecks" title="No tasks assigned" description="Your manager or workflow will assign operational tasks here." /></Card>}
    </div>
  );
}
