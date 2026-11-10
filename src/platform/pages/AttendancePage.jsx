import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { attendanceFor, shiftForEmployee } from '../data/selectors.js';
import { formatMinutes } from '../lib/shift.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Progress,
  Segmented,
  StatCard,
  StatusBadge,
  formatDate,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'on_leave', label: 'Leave' },
];

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(new Date(year, month, day));
  return cells;
}

export default function AttendancePage() {
  const auth = useAuth();
  const { data, loading } = useWorkspace();
  const context = auth.context;
  const [filter, setFilter] = useState('all');
  const attendance = useMemo(() => (data && context ? attendanceFor(data, context, context.employeeId, 45) : null), [data, context]);
  const currentMonth = useMemo(() => new Date(), []);

  if (loading || !attendance) {
    return <div className="pt-page-loading"><span className="pt-spinner" /> Loading attendance…</div>;
  }

  const { employee, records, summary, monthSummary } = attendance;
  const byDate = Object.fromEntries(records.map((record) => [record.workDate, record]));
  const cells = monthMatrix(currentMonth.getFullYear(), currentMonth.getMonth());
  const totalDays = summary.present + summary.absent + summary.onLeave;
  const rate = totalDays ? Math.round((summary.present / totalDays) * 100) : 0;
  const filtered = filter === 'all' ? records : records.filter((record) => record.status === filter);
  const shift = shiftForEmployee(data, employee?.id || context.employeeId).shift;

  function exportCsv() {
    const header = ['Date', 'Shift', 'Status', 'Scheduled start', 'Scheduled end', 'Clock in', 'Clock out', 'Worked minutes', 'Late minutes', 'Overtime minutes'];
    const rows = records.map((record) => [
      record.workDate,
      data.shifts.find((item) => item.id === record.shiftId)?.code || '',
      record.status,
      record.scheduledStart,
      record.scheduledEnd,
      record.actualIn || '',
      record.actualOut || '',
      record.workedMinutes,
      record.lateMinutes,
      record.overtimeMinutes,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `indra-attendance-${employee?.employeeCode || 'employee'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Workspace', 'Attendance']}
        eyebrow="TIME & ATTENDANCE"
        title="Attendance"
        description={`${employee?.fullName} · ${employee?.employeeCode} · ${employee?.plant} · ${shift?.name || 'No shift'}`}
        actions={
          <>
            <Button variant="secondary" icon="Download" onClick={exportCsv}>Export CSV</Button>
            <Button icon="Send" onClick={() => navigate('/requests?new=attendance')}>Regularization request</Button>
          </>
        }
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Attendance rate" value={`${rate}%`} icon="Fingerprint" tone="lime" footnote={`${summary.present} present of ${totalDays} recorded days`} />
        <StatCard label="Late arrivals" value={summary.late} icon="Clock3" tone={summary.late ? 'warn' : 'default'} footnote={`${records.reduce((total, record) => total + record.lateMinutes, 0)} late minutes`} />
        <StatCard label="Hours worked" value={(summary.workedMinutes / 60).toFixed(1)} unit="hrs" icon="Timer" footnote="Last 45 days" />
        <StatCard label="Overtime" value={(summary.overtimeMinutes / 60).toFixed(1)} unit="hrs" icon="TrendingUp" tone={summary.overtimeMinutes > 900 ? 'warn' : 'default'} footnote={`${summary.absent} absent · ${summary.onLeave} leave days`} />
      </section>

      <div className="pt-attendance-layout">
        <Card title={currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} subtitle="Monthly attendance pattern" action={<Badge tone="neutral">{monthSummary.records} records</Badge>}>
          <div className="pt-calendar">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day} className="pt-calendar-head">{day}</span>)}
            {cells.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} className="pt-calendar-empty" />;
              const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              const record = byDate[key];
              const isToday = key === new Date().toISOString().slice(0, 10);
              return (
                <span key={key} className={`pt-calendar-day ${record ? `pt-day-${record.status}` : ''} ${isToday ? 'today' : ''}`} title={record ? `${record.status.replaceAll('_', ' ')} · ${formatMinutes(record.workedMinutes)}` : 'No record'}>
                  <small>{date.getDate()}</small>
                  {record && <i />}
                </span>
              );
            })}
          </div>
          <div className="pt-calendar-legend">
            <span><i className="pt-day-present" /> Present</span>
            <span><i className="pt-day-late" /> Late</span>
            <span><i className="pt-day-absent" /> Absent</span>
            <span><i className="pt-day-on_leave" /> Leave</span>
            <span><i className="pt-day-holiday" /> Holiday</span>
          </div>
        </Card>

        <Card title="Current shift" subtitle={shift ? `${shift.name} · ${shift.timezone}` : 'No assignment'} className="pt-attendance-shift">
          {shift ? (
            <>
              <div className="pt-big-shift">
                <span className="pt-mono">{shift.startTime}</span>
                <i />
                <span className="pt-mono">{shift.endTime}</span>
              </div>
              <p>{shift.weeklyWorkingDays.length} working days · {shift.graceMinutes} min grace period</p>
              <div className="pt-attendance-bullets">
                <div><Icon name="Coffee" size={14} /> {(shift.breaks || []).length + (shift.lunchStart ? 1 : 0)} configured breaks</div>
                <div><Icon name="Moon" size={14} /> {shift.endTime < shift.startTime ? 'Cross-midnight shift' : 'Same-day shift'}</div>
                <div><Icon name="TrendingUp" size={14} /> Overtime: {shift.overtimePolicy.replaceAll('_', ' ')}</div>
              </div>
              <Button variant="secondary" size="sm" icon="CalendarClock" onClick={() => navigate('/schedule')}>View full roster</Button>
            </>
          ) : <EmptyState icon="CalendarClock" title="No shift" />}
          <div className="pt-attendance-score">
            <span>Monthly consistency</span>
            <Progress value={rate} tone={rate > 90 ? 'lime' : 'amber'} label={`${monthSummary.present} present / ${monthSummary.records} recorded`} />
          </div>
        </Card>
      </div>

      <Card
        title="Attendance records"
        subtitle="Last 45 days, newest first"
        action={<Segmented label="Filter attendance" value={filter} onChange={setFilter} options={STATUS_OPTIONS} />}
      >
        <DataTable
          columns={[
            { key: 'workDate', label: 'Date', render: (row) => <span><strong>{formatDate(row.workDate)}</strong><small className="pt-block pt-mono">{new Date(`${row.workDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</small></span> },
            { key: 'shift', label: 'Shift', render: (row) => <span className="pt-muted">{data.shifts.find((item) => item.id === row.shiftId)?.name || '—'}</span> },
            { key: 'scheduled', label: 'Scheduled', render: (row) => <span className="pt-mono pt-small">{new Date(row.scheduledStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – {new Date(row.scheduledEnd).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span> },
            { key: 'actual', label: 'Actual', render: (row) => <span className="pt-mono pt-small">{row.actualIn ? new Date(row.actualIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'} – {row.actualOut ? new Date(row.actualOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</span> },
            { key: 'worked', label: 'Worked', align: 'right', render: (row) => <span>{formatMinutes(row.workedMinutes)}</span> },
            { key: 'late', label: 'Late / OT', align: 'right', render: (row) => <span className={row.lateMinutes ? 'pt-warn-text' : ''}>{row.lateMinutes} / {row.overtimeMinutes}<small className="pt-block pt-muted">min</small></span> },
            { key: 'status', label: 'Status', align: 'right', render: (row) => <StatusBadge status={row.status} /> },
          ]}
          rows={filtered}
          empty={<EmptyState icon="Fingerprint" title="No records match" description="Change the filter or check your shift assignment." />}
        />
      </Card>
    </div>
  );
}
