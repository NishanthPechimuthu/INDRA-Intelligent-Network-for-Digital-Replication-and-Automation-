import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { attendanceRegister } from '../data/productionSelectors.js';
import { dateKey } from '../lib/shift.js';
import Icon from '../components/Icon.jsx';
import { Avatar, Badge, Card, EmptyState, StatCard, TextInput } from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';

const STATUS_TONE = {
  present: 'lime',
  remote: 'blue',
  late: 'amber',
  half_day: 'amber',
  absent: 'red',
  on_leave: 'violet',
  holiday: 'neutral',
  not_marked: 'neutral',
};

/** Daily attendance register for the viewer's scope. */
export default function AttendanceRegisterPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const context = auth.context;
  const data = workspace.data;
  const [workDate, setWorkDate] = useState(dateKey(new Date()));

  const rows = useMemo(() => (data && context ? attendanceRegister(data, context, workDate) : []), [data, context, workDate]);
  const marked = rows.filter((row) => row.record);
  const counts = rows.reduce((totals, row) => ({ ...totals, [row.status]: (totals[row.status] || 0) + 1 }), {});

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Workforce', 'Attendance']}
        eyebrow="ATTENDANCE REGISTER"
        title="Attendance"
        description="Clock-in, clock-out and evaluated status for the selected day, scoped to your own records or your team."
        actions={
          <TextInput
            type="date"
            value={workDate}
            onChange={(event) => setWorkDate(event.target.value)}
            aria-label="Register date"
          />
        }
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Present" value={counts.present || 0} icon="UserCheck" tone="lime" footnote={`${counts.remote || 0} remote`} />
        <StatCard label="Late" value={counts.late || 0} icon="Clock3" tone={counts.late ? 'warn' : 'default'} footnote={`${counts.half_day || 0} half day`} />
        <StatCard label="Absent" value={counts.absent || 0} icon="Ban" tone={counts.absent ? 'warn' : 'default'} footnote={`${counts.on_leave || 0} on leave`} />
        <StatCard label="Not marked" value={counts.not_marked || 0} icon="Fingerprint" footnote={`${marked.length} of ${rows.length} recorded`} />
      </section>

      <Card title="Register" subtitle={workDate === dateKey(new Date()) ? 'Today' : workDate}>
        {rows.length ? (
          <div className="pt-table-scroll">
            <table className="pt-table">
              <thead>
                <tr><th>Employee</th><th>Shift</th><th>Clock in</th><th>Clock out</th><th>Worked</th><th>Status</th><th>Source</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.employee.id}>
                    <td>
                      <span className="pt-person">
                        <Avatar name={row.employee.fullName} size="xs" />
                        <span><strong>{row.employee.fullName}</strong><small>{row.employee.designation}</small></span>
                      </span>
                    </td>
                    <td>{row.shift ? `${row.shift.code} · ${row.shift.startTime}–${row.shift.endTime}` : '—'}</td>
                    <td className="pt-mono">{row.record?.clockIn ? formatClock(row.record.clockIn) : '—'}</td>
                    <td className="pt-mono">{row.record?.clockOut ? formatClock(row.record.clockOut) : '—'}</td>
                    <td className="pt-mono">{row.record?.workedMinutes != null ? `${Math.round(row.record.workedMinutes / 60)}h ${row.record.workedMinutes % 60}m` : '—'}</td>
                    <td><Badge tone={STATUS_TONE[row.status] || 'neutral'} dot>{String(row.status).replaceAll('_', ' ')}</Badge></td>
                    <td><span className="pt-muted pt-small">{row.record?.source || (row.record ? 'recorded' : 'awaiting clock-in')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="Fingerprint" title="No records for this day" description="Attendance appears once operators clock in or a supervisor records it." />
        )}
      </Card>

      <Card title="How attendance is evaluated" subtitle="Policy applied to every record">
        <ul className="pt-policy-list">
          <li><Icon name="Check" size={13} /> Grace minutes come from the assigned shift definition.</li>
          <li><Icon name="Check" size={13} /> Approved leave and public holidays override absence.</li>
          <li><Icon name="Check" size={13} /> Cross-midnight shifts evaluate against their start date.</li>
          <li><Icon name="Check" size={13} /> Corrections are audit logged against the employee who made them.</li>
        </ul>
      </Card>
    </div>
  );
}

function formatClock(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 5);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
