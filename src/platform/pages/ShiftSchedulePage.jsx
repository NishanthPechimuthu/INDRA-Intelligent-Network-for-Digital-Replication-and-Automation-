import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { scopedEmployees } from '../data/selectors.js';
import { addDays, dateKey, isWorkingDay, shiftWindow } from '../lib/shift.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { Badge, Button, Card, EmptyState, Segmented, StatCard } from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';

const DAYS = 7;

/** Team shift schedule: who works which shift over the next week. */
export default function ShiftSchedulePage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const context = auth.context;
  const data = workspace.data;
  const [scope, setScope] = useState('team');

  const employees = useMemo(() => (data && context ? scopedEmployees(data, context) : []), [data, context]);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, index) => addDays(new Date(), index)), []);
  const rows = scope === 'mine' ? employees.filter((employee) => employee.id === context?.employeeId) : employees;
  const shifts = data?.shifts || [];

  function assignmentFor(employeeId, date) {
    const key = dateKey(date);
    const assignment = (data?.shiftAssignments || []).find(
      (item) => item.employeeId === employeeId && item.effectiveFrom <= key && (!item.effectiveTo || item.effectiveTo >= key),
    );
    return assignment ? { assignment, shift: shifts.find((shift) => shift.id === assignment.shiftId) || null } : { assignment: null, shift: null };
  }

  const today = dateKey(new Date());
  const scheduledToday = rows.filter((employee) => assignmentFor(employee.id, new Date()).shift);
  const nightShifts = rows.filter((employee) => assignmentFor(employee.id, new Date()).shift?.code === 'NIGHT');

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Workforce', 'Shift schedule']}
        title="Shift schedule"
        eyebrow="WORKFORCE PLANNING"
        description="Seven-day view of assigned shifts, rest days and holidays. Cross-midnight shifts stay attached to their start date."
        actions={
          <div className="pt-header-actions">
            <Button variant="secondary" icon="Fingerprint" onClick={() => navigate('/workforce/attendance')}>Attendance register</Button>
            <Button variant="ghost" icon="CalendarDays" onClick={() => navigate('/admin/shifts')}>Shift definitions</Button>
          </div>
        }
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="People scheduled today" value={scheduledToday.length} icon="CalendarCheck" tone="lime" footnote={`of ${rows.length} in view`} />
        <StatCard label="Night shift" value={nightShifts.length} icon="Moon" footnote="Cross-midnight coverage" />
        <StatCard label="Active shift patterns" value={shifts.filter((shift) => shift.isActive !== false).length} icon="CalendarClock" footnote="Configured definitions" />
        <StatCard label="Public holidays" value={(data?.holidays || []).filter((holiday) => holiday.date >= today).length} icon="Sun" footnote="Upcoming in the calendar" />
      </section>

      <Card
        title="Weekly roster"
        subtitle="Shift code and hours per employee"
        action={<Segmented label="Scope" value={scope} onChange={setScope} options={[{ value: 'team', label: 'Team' }, { value: 'mine', label: 'Only me' }]} />}
      >
        {rows.length ? (
          <div className="pt-table-scroll">
            <table className="pt-table pt-schedule-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  {days.map((day) => (
                    <th key={dateKey(day)} className={dateKey(day) === today ? 'pt-today' : ''}>
                      {day.toLocaleDateString('en-IN', { weekday: 'short' })}<small>{day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((employee) => (
                  <tr key={employee.id}>
                    <td><strong>{employee.fullName}</strong><small className="pt-muted">{employee.designation}</small></td>
                    {days.map((day) => {
                      const { shift } = assignmentFor(employee.id, day);
                      const key = dateKey(day);
                      const holiday = (data.holidays || []).find((item) => item.date === key);
                      const working = shift ? isWorkingDay(day, shift.weeklyWorkingDays) : false;
                      return (
                        <td key={key} className={`pt-schedule-cell ${key === today ? 'pt-today' : ''}`}>
                          {holiday ? (
                            <Badge tone="violet">{holiday.name || 'Holiday'}</Badge>
                          ) : shift && working ? (
                            <span className={`pt-shift-chip pt-shift-${shift.code?.toLowerCase() || 'general'}`}>
                              <strong>{shift.code}</strong>
                              <small>{shift.startTime}–{shift.endTime}</small>
                            </span>
                          ) : shift ? (
                            <span className="pt-rest-chip">Rest day</span>
                          ) : (
                            <span className="pt-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="CalendarDays" title="No employees to schedule" description="Employees in your scope with shift assignments appear here." />
        )}
      </Card>

      <Card title="Shift definitions" subtitle="Timings, breaks and overtime policy">
        {shifts.length ? (
          <div className="pt-shift-defs">
            {shifts.map((shift) => {
              const window = shiftWindow(shift, new Date());
              return (
                <div key={shift.id} className="pt-shift-def">
                  <div className="pt-shift-def-head">
                    <span className="pt-shift-color" style={{ background: shift.color || '#cdf22b' }} />
                    <div>
                      <strong>{shift.name}</strong>
                      <small className="pt-mono">{shift.code} · {shift.startTime}–{shift.endTime}</small>
                    </div>
                    <Badge tone="neutral">{shift.timezone}</Badge>
                  </div>
                  <ul>
                    <li><Icon name="Utensils" size={12} /> Lunch {shift.lunchStart || '—'}–{shift.lunchEnd || '—'}</li>
                    <li><Icon name="Coffee" size={12} /> {shift.breaks?.length || 0} configured break{shift.breaks?.length === 1 ? '' : 's'}</li>
                    <li><Icon name="Timer" size={12} /> {window.end.getDate() !== window.start.getDate() ? 'Crosses midnight' : 'Same-day shift'}</li>
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="CalendarClock" title="No shift definitions" description="Create shift patterns in Shift management." />
        )}
      </Card>
    </div>
  );
}
