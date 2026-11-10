import React from 'react';
import { Button, Badge as BadgeComponent, EmptyState, Progress, StatCard } from './Ui.jsx';
import Icon from './Icon.jsx';

/**
 * Status vocabulary shared by the workforce and production screens. Labels and
 * tones mirror the PostgreSQL enums so the interface and the database never
 * disagree about what a status means.
 */
export const TASK_STATUS = {
  assigned: { label: 'Assigned', tone: 'blue' },
  accepted: { label: 'Accepted', tone: 'violet' },
  in_progress: { label: 'In progress', tone: 'lime' },
  paused: { label: 'Paused', tone: 'amber' },
  blocked: { label: 'Blocked', tone: 'red' },
  completed: { label: 'Completed', tone: 'lime' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export const ORDER_STATUS = {
  planned: { label: 'Planned', tone: 'neutral' },
  released: { label: 'Released', tone: 'blue' },
  in_progress: { label: 'In progress', tone: 'lime' },
  paused: { label: 'Paused', tone: 'amber' },
  on_hold: { label: 'On hold', tone: 'violet' },
  completed: { label: 'Completed', tone: 'lime' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

export const ISSUE_STATUS = {
  open: { label: 'Open', tone: 'red' },
  acknowledged: { label: 'Acknowledged', tone: 'amber' },
  in_progress: { label: 'In progress', tone: 'blue' },
  resolved: { label: 'Resolved', tone: 'lime' },
  closed: { label: 'Closed', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'neutral' },
};

export const PROGRAM_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  in_review: { label: 'In review', tone: 'amber' },
  approved: { label: 'Approved', tone: 'lime' },
  rejected: { label: 'Rejected', tone: 'red' },
  superseded: { label: 'Superseded', tone: 'violet' },
  archived: { label: 'Archived', tone: 'neutral' },
};

export const SEVERITY = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'blue' },
  high: { label: 'High', tone: 'amber' },
  critical: { label: 'Critical', tone: 'red' },
};

export const PRIORITY = { low: 'neutral', medium: 'blue', high: 'amber', critical: 'red' };

export function StatusPill({ map, status, dot = true }) {
  const meta = map[status] || { label: String(status || '—').replaceAll('_', ' '), tone: 'neutral' };
  return <BadgeComponent tone={meta.tone} dot={dot}>{meta.label}</BadgeComponent>;
}

export const TaskStatus = ({ status }) => <StatusPill map={TASK_STATUS} status={status} />;
export const OrderStatus = ({ status }) => <StatusPill map={ORDER_STATUS} status={status} />;
export const IssueStatus = ({ status }) => <StatusPill map={ISSUE_STATUS} status={status} />;
export const ProgramStatus = ({ status }) => <StatusPill map={PROGRAM_STATUS} status={status} />;
export const SeverityPill = ({ severity }) => <StatusPill map={SEVERITY} status={severity} />;
export const PriorityPill = ({ priority }) => <BadgeComponent tone={PRIORITY[priority] || 'neutral'}>{priority}</BadgeComponent>;

/** Good / rejected / remaining breakdown used on dashboards and order rows. */
export function QuantityBreakdown({ target, completed, rejected, unit = 'pcs' }) {
  const done = Number(completed || 0);
  const goal = Number(target || 0);
  const remaining = Math.max(goal - done, 0);
  return (
    <div className="pt-quantity">
      <div className="pt-quantity-row">
        <span><strong className="pt-mono">{done.toLocaleString()}</strong> / {goal.toLocaleString()} {unit}</span>
        <small>{remaining.toLocaleString()} remaining · {Number(rejected || 0).toLocaleString()} rejected</small>
      </div>
      <Progress value={goal ? Math.min((done / goal) * 100, 100) : 0} />
    </div>
  );
}

/** Operator action buttons, shown only for legal transitions. */
export function TaskTransitionButtons({ task, busy, onTransition, compact = false }) {
  const status = task.productionStatus || (task.status === 'done' ? 'completed' : 'assigned');
  const actions = [];
  if (status === 'assigned') actions.push({ id: 'accepted', label: 'Accept', icon: 'Check', variant: 'secondary' });
  if (status === 'assigned' || status === 'accepted' || status === 'paused' || status === 'blocked') {
    actions.push({ id: 'start', label: status === 'assigned' ? 'Start work' : 'Resume', icon: 'Play' });
  }
  if (status === 'in_progress') {
    actions.push({ id: 'pause', label: 'Pause', icon: 'Pause', variant: 'secondary' });
    actions.push({ id: 'blocked', label: 'Block', icon: 'AlertTriangle', variant: 'ghost' });
    actions.push({ id: 'complete', label: 'Report completion', icon: 'CheckCircle2' });
  }
  if (!actions.length) return null;
  return (
    <div className={`pt-task-actions${compact ? ' pt-task-actions-compact' : ''}`}>
      {actions.map((action) => (
        <Button
          key={action.id}
          size="sm"
          variant={action.variant || 'primary'}
          icon={action.icon}
          disabled={busy}
          onClick={() => onTransition(task, action.id)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function MachineStateDot({ state }) {
  const tone = {
    running: 'lime',
    idle: 'blue',
    down: 'red',
    maintenance: 'amber',
    setup: 'violet',
    offline: 'neutral',
  }[state] || 'neutral';
  return (
    <span className={`pt-machine-state pt-machine-${tone}`}>
      <i /> {String(state || 'unknown').replaceAll('_', ' ')}
    </span>
  );
}

export function SectionEmpty({ icon = 'Inbox', title, description, action }) {
  return (
    <div className="pt-section-empty">
      <EmptyState icon={icon} title={title} description={description} action={action} />
    </div>
  );
}

export function FieldHint({ icon = 'ShieldCheck', children }) {
  return (
    <p className="pt-muted pt-small pt-field-hint">
      <Icon name={icon} size={13} /> {children}
    </p>
  );
}

/** Simple KPI strip used by the three dashboards. */
export function MetricStrip({ metrics }) {
  return (
    <section className="pt-stat-grid pt-stat-grid-4">
      {metrics.map((metric) => (
        <StatCard key={metric.label} {...metric} />
      ))}
    </section>
  );
}
