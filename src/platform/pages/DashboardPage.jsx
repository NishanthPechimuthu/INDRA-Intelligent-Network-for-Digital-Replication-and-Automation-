import React, { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { dashboardFor } from '../data/selectors.js';
import { hasPermission } from '../data/accessControl.js';
import { formatMinutes, shiftMetrics } from '../lib/shift.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Progress,
  StatCard,
  StatusBadge,
  formatDate,
  formatDateTime,
  relativeTime,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function Timeline({ schedule }) {
  const shift = schedule.shift;
  if (!shift) return <EmptyState icon="CalendarClock" title="No shift assigned" description="Your manager needs to assign an effective shift before a schedule can be calculated." />;
  const lunch = shift.lunchStart && shift.lunchEnd ? [{ label: 'Lunch', time: `${shift.lunchStart} – ${shift.lunchEnd}`, icon: 'Utensils', kind: 'lunch' }] : [];
  const breaks = (shift.breaks || []).map((item) => ({ label: item.name, time: `${item.startTime} – ${item.endTime}`, icon: 'Coffee', kind: 'break' }));
  const events = [
    { label: 'Shift starts', time: shift.startTime, icon: 'Sun', kind: 'start' },
    ...breaks.slice(0, 1),
    ...lunch,
    ...breaks.slice(1),
    { label: 'Shift ends', time: shift.endTime, icon: 'Moon', kind: 'end' },
  ];
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (value) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  return (
    <div className="pt-timeline">
      {events.map((event, index) => {
        const eventMinutes = toMinutes(event.time.slice(0, 5));
        const isPast = shift.startTime <= shift.endTime
          ? eventMinutes < nowMinutes
          : nowMinutes >= toMinutes(shift.startTime) || nowMinutes < toMinutes(shift.endTime) ? eventMinutes <= nowMinutes || eventMinutes > toMinutes(shift.startTime) : eventMinutes < nowMinutes;
        const isNext = events.findIndex((item) => toMinutes(item.time.slice(0, 5)) > nowMinutes) === index;
        return (
          <div key={`${event.label}-${index}`} className={`pt-timeline-item ${isPast ? 'past' : ''} ${isNext ? 'next' : ''}`}>
            <span className={`pt-timeline-icon pt-timeline-${event.kind}`}><Icon name={event.icon} size={14} /></span>
            <div>
              <strong>{event.label}</strong>
              <small>{event.time}</small>
            </div>
            {isNext && <Badge tone="lime">Next</Badge>}
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const auth = useAuth();
  const { data, loading } = useWorkspace();
  const context = auth.context;
  const dashboard = useMemo(() => (data && context ? dashboardFor(data, context) : null), [data, context]);

  if (loading || !dashboard) {
    return <div className="pt-page-loading"><span className="pt-spinner" /> Loading your workspace…</div>;
  }

  const { employee, schedule, todayEntry, todayRecord, attendance, tasks, approvals, notifications, headcount, departmentHeadcount, activeLines, teamLeave, recentActivity } = dashboard;
  const metrics = schedule.shift ? shiftMetrics(schedule.shift) : null;
  const presentDays = attendance.summary.present;
  const totalDays = attendance.summary.present + attendance.summary.absent + attendance.summary.onLeave;
  const attendanceRate = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;
  const shiftStatus = todayRecord?.status === 'present' || todayRecord?.status === 'late' ? 'On shift' : todayEntry?.status === 'scheduled' ? 'Scheduled' : todayEntry?.status === 'holiday' ? 'Holiday' : 'Off today';
  const canApprove = hasPermission(context.permissions, 'requests.approve');
  const isManager = ['administrator', 'plant_head', 'hod', 'supervisor'].some((key) => context.roleKeys.includes(key));

  return (
    <div className="pt-page pt-dashboard">
      <PageHeader
        breadcrumb={['Workspace', 'Dashboard']}
        eyebrow={`${formatDate(new Date(), { weekday: 'long' })} · ${employee?.plantCode || 'ORG'}`}
        title={`${greeting()}, ${employee?.firstName || 'operator'}.`}
        description={todayEntry?.status === 'holiday' ? `${todayEntry.holidayName} is a plant holiday.` : `Your ${schedule.shift?.name || 'shift'} starts at ${schedule.shift?.startTime || '—'} · ${employee?.department || ''}.`}
        actions={
          <>
            <Button variant="secondary" icon="CalendarClock" onClick={() => navigate('/schedule')}>My schedule</Button>
            <Button icon="Plus" onClick={() => navigate('/requests?new=1')}>New request</Button>
          </>
        }
      />

      <section className="pt-dashboard-hero">
        <div className="pt-shift-hero">
          <div className="pt-shift-hero-head">
            <div>
              <span className="pt-eyebrow">TODAY&apos;S OPERATION</span>
              <h2>{schedule.shift?.name || 'No shift assigned'}</h2>
              <p>
                {schedule.shift ? `${schedule.shift.startTime} – ${schedule.shift.endTime} · ${schedule.shift.timezone}` : 'Contact your supervisor to be rostered.'}
                {metrics && <> · {formatMinutes(metrics.netWorkingMinutes)} paid working time · {metrics.breakCount} breaks</>}
              </p>
            </div>
            <Badge tone={shiftStatus === 'On shift' ? 'green' : shiftStatus === 'Scheduled' ? 'lime' : 'neutral'} dot>{shiftStatus}</Badge>
          </div>
          <div className="pt-shift-hero-stats">
            <div><small>Clock-in</small><strong className="pt-mono">{todayRecord?.actualIn ? new Date(todayRecord.actualIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></div>
            <div><small>Clock-out</small><strong className="pt-mono">{todayRecord?.actualOut ? new Date(todayRecord.actualOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></div>
            <div><small>Late</small><strong className={todayRecord?.lateMinutes ? 'pt-warn-text' : ''}>{todayRecord?.lateMinutes || 0}<em>min</em></strong></div>
            <div><small>Overtime</small><strong>{todayRecord?.overtimeMinutes || 0}<em>min</em></strong></div>
            <div><small>Assigned line</small><strong>{employee?.productionLine || '—'}</strong></div>
          </div>
          <div className="pt-shift-hero-foot">
            <span><Icon name="MapPin" size={13} /> {employee?.plant || 'Plant'} · {employee?.department}</span>
            <span><Icon name="UserRound" size={13} /> Reports to {employee?.reportingManagerName || '—'}</span>
            <a href="/attendance" onClick={(event) => { event.preventDefault(); navigate('/attendance'); }}>Attendance detail <Icon name="ArrowRight" size={12} /></a>
          </div>
        </div>

        <div className="pt-dashboard-side">
          <div className="pt-quick-card">
            <span className="pt-eyebrow">ACCOUNT</span>
            <div className="pt-profile-mini">
              <Avatar name={employee?.fullName} src={employee?.photoUrl} size="lg" status={employee?.employmentStatus === 'active' ? 'active' : 'away'} />
              <div>
                <strong>{employee?.fullName}</strong>
                <small>{employee?.designation}</small>
                <span className="pt-mono">{employee?.employeeCode}</span>
              </div>
            </div>
            <div className="pt-mini-roles">
              {context.roles.map((role) => <Badge key={role.key} tone="neutral">{role.name}</Badge>)}
            </div>
            <button type="button" className="pt-quick-link" onClick={() => navigate('/profile')}>
              View employee profile <Icon name="ArrowRight" size={13} />
            </button>
          </div>
        </div>
      </section>

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Attendance this month" value={`${attendanceRate}%`} icon="Fingerprint" footnote={`${presentDays} present · ${attendance.monthSummary.late} late · ${attendance.monthSummary.onLeave} leave`} trend={{ label: attendanceRate >= 95 ? 'On track' : 'Review', tone: attendanceRate >= 95 ? 'up' : 'down' }} />
        <StatCard label="Hours recorded" value={(attendance.monthSummary.workedMinutes / 60).toFixed(1)} unit="hrs" icon="Clock" footnote={`${(attendance.monthSummary.overtimeMinutes / 60).toFixed(1)} overtime hours`} />
        <StatCard label="Open tasks" value={tasks.length} icon="ListChecks" tone={tasks.filter((task) => task.priority === 'critical').length ? 'warn' : 'default'} footnote={`${tasks.filter((task) => task.priority === 'high' || task.priority === 'critical').length} high priority`} />
        <StatCard label={canApprove ? 'Awaiting my approval' : 'Unread notifications'} value={canApprove ? approvals.length : notifications.length} icon={canApprove ? 'BadgeCheck' : 'Bell'} tone={canApprove && approvals.length ? 'lime' : 'default'} footnote={canApprove ? `${approvals.filter((item) => item.request?.requestType === 'leave').length} leave requests` : `${notifications.length} unread updates`} />
      </section>

      <section className="pt-dashboard-grid">
        <Card title="My day" subtitle={schedule.shift ? `${schedule.shift.name} · ${schedule.shift.timezone}` : 'No shift'} action={<Badge tone="neutral">{formatDate(new Date(), { weekday: 'short', day: '2-digit', month: 'short' })}</Badge>} className="pt-card-timeline">
          <Timeline schedule={schedule} />
          {schedule.holidays?.length > 0 && (
            <div className="pt-next-holiday">
              <Icon name="Calendar" size={15} />
              <span>Next holiday <strong>{schedule.holidays[0]?.name}</strong> · {formatDate(schedule.holidays[0]?.holidayDate)}</span>
            </div>
          )}
        </Card>

        <Card
          title="My tasks"
          subtitle={`${tasks.length} open`}
          action={<button type="button" className="pt-link-btn" onClick={() => navigate('/tasks')}>All tasks <Icon name="ArrowRight" size={12} /></button>}
          className="pt-card-span"
        >
          {tasks.length ? (
            <div className="pt-task-list">
              {tasks.slice(0, 4).map((task) => (
                <button key={task.id} type="button" className="pt-task-row" onClick={() => navigate('/tasks')}>
                  <span className={`pt-priority-dot pt-priority-${task.priority}`} />
                  <span>
                    <strong>{task.title}</strong>
                    <small>{task.project?.name || 'General'} · due {relativeTime(task.dueAt)}</small>
                  </span>
                  <StatusBadge status={task.status} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon="CheckCircle2" title="Nothing due" description="Your task queue is clear for now." />
          )}
        </Card>

        {canApprove && (
          <Card
            title="My approvals"
            subtitle={`${approvals.length} pending decision${approvals.length === 1 ? '' : 's'}`}
            action={<button type="button" className="pt-link-btn" onClick={() => navigate('/approvals')}>Open queue <Icon name="ArrowRight" size={12} /></button>}
          >
            {approvals.length ? (
              <div className="pt-approval-list">
                {approvals.slice(0, 3).map((step) => (
                  <div key={step.id} className="pt-approval-mini">
                    <Avatar name={step.requester?.fullName} size="sm" />
                    <div>
                      <strong>{step.request.title}</strong>
                      <small>{step.requester?.fullName} · {step.request.requestType.replaceAll('_', ' ')} · {relativeTime(step.request.submittedAt)}</small>
                    </div>
                    <Badge tone="amber">Step {step.step}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="BadgeCheck" title="Queue clear" description="You have no approvals waiting. Requests routed to you appear here." />
            )}
          </Card>
        )}

        <Card title="Notifications" subtitle={`${notifications.length} unread`} action={<button type="button" className="pt-link-btn" onClick={() => navigate('/notifications')}>View all <Icon name="ArrowRight" size={12} /></button>}>
          {notifications.length ? (
            <div className="pt-notification-mini-list">
              {notifications.map((notification) => (
                <button key={notification.id} type="button" className="pt-notification-mini" onClick={() => navigate(notification.link || '/notifications')}>
                  <span className={`pt-notif-icon pt-notif-${notification.category}`}><Icon name={notification.category === 'approval' ? 'BadgeCheck' : notification.category === 'schedule' ? 'CalendarClock' : notification.category === 'attendance' ? 'Fingerprint' : 'Bell'} size={14} /></span>
                  <span><strong>{notification.title}</strong><small>{relativeTime(notification.createdAt)}</small></span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon="Bell" title="No unread notifications" description="Updates about your schedule, approvals and requests will appear here." />
          )}
        </Card>

        {isManager && (
          <Card title="Plant pulse" subtitle={`${employee?.plant || 'Organization'} overview`} action={<Badge tone="lime" dot>Live</Badge>}>
            <div className="pt-pulse-grid">
              <div><small>Headcount</small><strong>{headcount}</strong><span>in your scope</span></div>
              <div><small>Department</small><strong>{departmentHeadcount}</strong><span>{employee?.department}</span></div>
              <div><small>Active lines</small><strong>{activeLines}</strong><span>of {data.productionLines.length}</span></div>
              <div><small>On leave today</small><strong>{teamLeave.length}</strong><span>{teamLeave.map((item) => data.employeesById[item.employeeId]?.firstName).filter(Boolean).join(', ') || 'Full coverage'}</span></div>
            </div>
            <div className="pt-pulse-bar">
              <span>Shift coverage</span>
              <Progress value={Math.max(0, 100 - teamLeave.length * 8)} tone="lime" label={teamLeave.length ? 'Cover maintained' : 'Full team available'} />
            </div>
          </Card>
        )}
      </section>

      {hasPermission(context.permissions, 'audit.read') && (
        <Card title="Recent activity" subtitle="Actions visible within your scope" action={<button type="button" className="pt-link-btn" onClick={() => navigate('/activity')}>Full history <Icon name="ArrowRight" size={12} /></button>}>
          <DataTable
            dense
            columns={[
              { key: 'action', label: 'Event', render: (row) => <span className="pt-table-primary">{row.summary}</span> },
              { key: 'actor', label: 'Actor', render: (row) => data.employeesById[row.actorEmployeeId]?.fullName || 'System' },
              { key: 'created', label: 'When', align: 'right', render: (row) => <span className="pt-muted pt-mono">{formatDateTime(row.createdAt)}</span> },
            ]}
            rows={recentActivity}
            empty={<EmptyState icon="History" title="No activity in scope" />}
          />
        </Card>
      )}
    </div>
  );
}
