import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { scheduleFor } from '../data/selectors.js';
import { formatMinutes, isCrossMidnight } from '../lib/shift.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  InfoRow,
  DefinitionGrid,
  Segmented,
  StatusBadge,
  formatDate,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SchedulePage() {
  const auth = useAuth();
  const { data, loading } = useWorkspace();
  const context = auth.context;
  const [range, setRange] = useState('14');
  const schedule = useMemo(() => (data && context ? scheduleFor(data, context, Number(range)) : null), [data, context, range]);

  if (loading || !schedule) {
    return <div className="pt-page-loading"><span className="pt-spinner" /> Building your roster…</div>;
  }

  const { shift, assignment, roster, metrics, upcoming, holidays, leave } = schedule;
  const todayKey = roster[0]?.date;
  const workingDays = roster.filter((entry) => entry.working);
  const totalPlannedMinutes = workingDays.reduce((total, entry) => total + entry.netWorkingMinutes, 0);

  if (!shift) {
    return (
      <div className="pt-page">
        <PageHeader breadcrumb={['Workspace', 'My schedule']} eyebrow="ROSTER" title="My schedule" description="Your effective shift assignment and published roster." />
        <Card>
          <EmptyState icon="CalendarClock" title="No shift assigned" description="No effective shift assignment covers today. Ask your supervisor or HR to assign a shift." action={<Button icon="Send" onClick={() => navigate('/requests?new=1')}>Raise a request</Button>} />
        </Card>
      </div>
    );
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Workspace', 'My schedule']}
        eyebrow="ROSTER & SHIFT"
        title="My schedule"
        description={`Every dashboard uses this effective assignment. All times shown in ${shift.timezone}.`}
        actions={
          <>
            <Button variant="secondary" icon="Send" onClick={() => navigate('/requests?new=shift')}>Request shift swap</Button>
            <Button variant="secondary" icon="Download" onClick={() => window.print()}>Print roster</Button>
          </>
        }
      />

      <section className="pt-schedule-hero">
        <div className="pt-schedule-shift">
          <div className="pt-schedule-shift-head">
            <div>
              <span className="pt-eyebrow">EFFECTIVE SHIFT</span>
              <h2>{shift.name} <span className="pt-mono">{shift.code}</span></h2>
              <p>{shift.startTime} – {shift.endTime} · {shift.timezone} {metrics.crossMidnight && <Badge tone="violet"><Icon name="Moon" size={11} /> Cross-midnight</Badge>}</p>
            </div>
            <Badge tone="lime" dot>Active</Badge>
          </div>
          <div className="pt-schedule-metrics">
            <div><small>Net working time</small><strong>{formatMinutes(metrics.netWorkingMinutes)}</strong><em>after unpaid breaks</em></div>
            <div><small>Paid breaks</small><strong>{metrics.breakCount}</strong><em>{formatMinutes(metrics.breakMinutes)} total</em></div>
            <div><small>Grace period</small><strong>{shift.graceMinutes}<i>min</i></strong><em>late after this</em></div>
            <div><small>Overtime</small><strong>{shift.overtimePolicy.replaceAll('_', ' ')}</strong><em>{shift.overtimeMultiplier}× rate</em></div>
            <div><small>Working days</small><strong>{shift.weeklyWorkingDays.map((day) => DAY_LABELS[day - 1]).join(' · ')}</strong><em>{shift.weeklyWorkingDays.length} days/week</em></div>
          </div>
          <div className="pt-schedule-foot">
            <span><Icon name="CalendarCheck" size={13} /> Effective from {formatDate(assignment.effectiveFrom)}</span>
            <span><Icon name="Clock3" size={13} /> {assignment.effectiveTo ? `Until ${formatDate(assignment.effectiveTo)}` : 'Open-ended assignment'}</span>
            {upcoming && <Badge tone="amber">Next: {data.shifts.find((item) => item.id === upcoming.shiftId)?.name} from {formatDate(upcoming.effectiveFrom)}</Badge>}
          </div>
        </div>

        <div className="pt-schedule-side">
          <Card title="Breaks & lunch" subtitle={`${metrics.breakCount} configured intervals`} padded>
            <div className="pt-break-list">
              {shift.lunchStart && <div className="pt-break-row"><span className="pt-break-icon"><Icon name="Utensils" size={15} /></span><div><strong>Lunch</strong><small>{shift.lunchStart} – {shift.lunchEnd}</small></div><Badge tone="neutral">Unpaid</Badge></div>}
              {(shift.breaks || []).map((item) => (
                <div className="pt-break-row" key={item.id}>
                  <span className="pt-break-icon"><Icon name="Coffee" size={15} /></span>
                  <div><strong>{item.name}</strong><small>{item.startTime} – {item.endTime}</small></div>
                  <Badge tone={item.isPaid ? 'green' : 'amber'}>{item.isPaid ? 'Paid' : 'Unpaid'}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <Card
        title="Published roster"
        subtitle={`${workingDays.length} working days · ${(totalPlannedMinutes / 60).toFixed(1)} planned hours`}
        action={<Segmented label="Roster range" value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '28', label: '28 days' }]} />}
      >
        <div className="pt-roster">
          {roster.map((entry) => {
            const date = new Date(`${entry.date}T00:00:00`);
            const isToday = entry.date === todayKey;
            return (
              <div key={entry.date} className={`pt-roster-day ${entry.status} ${isToday ? 'today' : ''}`}>
                <div className="pt-roster-date">
                  <small>{DAY_LABELS[(date.getDay() + 6) % 7]}</small>
                  <strong>{date.getDate()}</strong>
                  <span>{date.toLocaleDateString('en-IN', { month: 'short' })}</span>
                </div>
                <div className="pt-roster-body">
                  {entry.status === 'scheduled' ? (
                    <>
                      <strong>{shift.name}</strong>
                      <small className="pt-mono">{shift.startTime} – {shift.endTime}</small>
                      <StatusBadge status="scheduled" />
                    </>
                  ) : entry.status === 'holiday' ? (
                    <>
                      <strong>{entry.holidayName || 'Holiday'}</strong>
                      <small>Plant holiday</small>
                      <StatusBadge status="holiday" />
                    </>
                  ) : entry.status === 'on_leave' ? (
                    <>
                      <strong>Approved leave</strong>
                      <small>No shift expected</small>
                      <StatusBadge status="on_leave" />
                    </>
                  ) : (
                    <>
                      <strong>Off</strong>
                      <small>Rest day</small>
                      <Badge tone="neutral">Off</Badge>
                    </>
                  )}
                </div>
                {isToday && <span className="pt-roster-today">Today</span>}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="pt-grid-2">
        <Card title="Holidays" subtitle="Upcoming plant and organization holidays">
          {holidays.length ? (
            <div className="pt-holiday-list">
              {holidays.map((holiday) => (
                <div key={holiday.id} className="pt-holiday-row">
                  <span className="pt-holiday-date">
                    <strong>{new Date(`${holiday.holidayDate}T00:00:00`).getDate()}</strong>
                    <small>{new Date(`${holiday.holidayDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</small>
                  </span>
                  <div><strong>{holiday.name}</strong><small>{holiday.isOptional ? 'Optional holiday' : 'Statutory holiday'} · {holiday.plantId ? 'Plant specific' : 'All plants'}</small></div>
                  {holiday.isOptional && <Badge tone="amber">Optional</Badge>}
                </div>
              ))}
            </div>
          ) : <EmptyState icon="Calendar" title="No upcoming holidays" />}
        </Card>

        <Card title="Leave record" subtitle="Approved and pending leave affecting this roster">
          <DataTable
            dense
            columns={[
              { key: 'leaveType', label: 'Type', render: (row) => <span className="pt-capitalize">{row.leaveType}</span> },
              { key: 'dates', label: 'Dates', render: (row) => <span className="pt-mono">{formatDate(row.startDate)} → {formatDate(row.endDate)}</span> },
              { key: 'days', label: 'Days', align: 'right' },
              { key: 'status', label: 'Status', align: 'right', render: (row) => <StatusBadge status={row.status} /> },
            ]}
            rows={leave}
            empty={<EmptyState icon="CalendarCheck" title="No leave recorded" />}
          />
        </Card>
      </div>

      <Card title="Shift assignment rules" subtitle="How INDRA resolves your schedule">
        <DefinitionGrid columns={3}>
          <InfoRow label="Assignment" value={`${formatDate(assignment.effectiveFrom)} → ${assignment.effectiveTo ? formatDate(assignment.effectiveTo) : 'open'}`} />
          <InfoRow label="Timezone" value={shift.timezone} />
          <InfoRow label="Cross-midnight" value={isCrossMidnight(shift.startTime, shift.endTime) ? 'Yes — end time rolls to next day' : 'No'} />
          <InfoRow label="Unpaid interval" value={formatMinutes(metrics.unpaidBreakMinutes)} />
          <InfoRow label="Weekly contracted hours" value={`${(metrics.netWorkingMinutes * shift.weeklyWorkingDays.length / 60).toFixed(1)} h`} />
          <InfoRow label="Grace" value={`${shift.graceMinutes} minutes`} />
        </DefinitionGrid>
        <p className="pt-muted pt-small">Roster calculation applies weekends, holidays, approved leave and the effective-dated shift assignment. Every dashboard reads the same resolved schedule.</p>
      </Card>
    </div>
  );
}
