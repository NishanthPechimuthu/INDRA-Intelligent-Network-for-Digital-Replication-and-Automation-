import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { employeesFor, shiftsFor } from '../data/selectors.js';
import { hasPermission } from '../data/accessControl.js';
import { assignShift, createShift, updateShift } from '../data/actions.js';
import { formatMinutes, shiftMetrics, timezoneLabel } from '../lib/shift.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Modal,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  TextInput,
  formatDate,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const WEEK_DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const OVERTIME_POLICIES = [
  { value: 'none', label: 'No overtime' },
  { value: 'after_shift', label: 'After shift end' },
  { value: 'weekly', label: 'Weekly threshold' },
  { value: 'manager_approval', label: 'Manager approval' },
];

const todayKey = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

function emptyShift(plants, departments) {
  const plantId = plants[0]?.id || '';
  return {
    plantId,
    departmentId: departments.find((department) => department.plantId === plantId)?.id || '',
    code: '',
    name: '',
    startTime: '09:00',
    endTime: '18:00',
    timezone: 'Asia/Kolkata',
    lunchStart: '13:00',
    lunchEnd: '13:30',
    graceMinutes: 10,
    overtimePolicy: 'after_shift',
    overtimeMultiplier: 1.5,
    weeklyWorkingDays: [1, 2, 3, 4, 5],
    effectiveFrom: todayKey(),
    effectiveTo: '',
    color: '#cdf22b',
    breaks: [],
  };
}

export default function ShiftsPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const data = workspace.data;

  const [tab, setTab] = useState('shifts');
  const [plantFilter, setPlantFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ employeeId: '', shiftId: '', effectiveFrom: todayKey() });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const summary = useMemo(() => (data ? shiftsFor(data) : null), [data]);
  const scopedEmployees = useMemo(() => (data && context ? employeesFor(data, context) : []), [data, context]);
  const canManage = hasPermission(context?.permissions, 'shifts.manage');
  const canAssign = hasPermission(context?.permissions, 'shifts.assign');

  if (!summary) {
    return <div className="pt-page-loading"><span className="pt-spinner" /> Loading shift configuration…</div>;
  }

  const { shifts, assignments, holidays } = summary;
  const plants = data.plants || [];
  const departments = data.departments || [];
  const activeAssignments = assignments.filter((assignment) => !assignment.effectiveTo);
  const visibleShifts = plantFilter === 'all' ? shifts : shifts.filter((shift) => shift.plantId === plantFilter);
  const previewMetrics = form ? shiftMetrics(form) : null;

  function openCreate() {
    setEditing(null);
    setForm(emptyShift(plants, departments));
    setError('');
    setCreateOpen(true);
  }

  function openEdit(shift) {
    setEditing(shift);
    setForm({
      ...emptyShift(plants, departments),
      ...shift,
      lunchStart: shift.lunchStart || '',
      lunchEnd: shift.lunchEnd || '',
      effectiveTo: shift.effectiveTo || '',
      breaks: (shift.breaks || []).map((item) => ({ ...item })),
    });
    setError('');
    setCreateOpen(true);
  }

  function updateBreak(index, patch) {
    setForm((current) => ({
      ...current,
      breaks: current.breaks.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  }

  function addBreak() {
    setForm((current) => ({ ...current, breaks: [...current.breaks, { name: 'Break', startTime: '11:00', endTime: '11:15', isPaid: true }] }));
  }

  function removeBreak(index) {
    setForm((current) => ({ ...current, breaks: current.breaks.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function toggleDay(day) {
    setForm((current) => ({
      ...current,
      weeklyWorkingDays: current.weeklyWorkingDays.includes(day)
        ? current.weeklyWorkingDays.filter((value) => value !== day)
        : [...current.weeklyWorkingDays, day].sort((a, b) => a - b),
    }));
  }

  async function saveShift(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      setError('Shift name and code are required.');
      return;
    }
    if (!form.startTime || !form.endTime) {
      setError('Start and end time are required.');
      return;
    }
    if (!form.weeklyWorkingDays.length) {
      setError('Select at least one working day.');
      return;
    }
    if (form.breaks.some((item) => !item.name.trim() || !item.startTime || !item.endTime)) {
      setError('Every break needs a name, start time and end time.');
      return;
    }
    setBusy('save');
    const payload = {
      ...form,
      graceMinutes: Number(form.graceMinutes) || 0,
      overtimeMultiplier: Number(form.overtimeMultiplier) || 1,
      plantId: form.plantId || null,
      departmentId: form.departmentId || null,
      effectiveTo: form.effectiveTo || null,
    };
    const result = editing ? await updateShift(editing.id, payload) : await createShift(payload);
    setBusy('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    notify(editing ? `${form.name} updated.` : `${form.name} created. Assign it to employees from the Assignments tab.`);
    setCreateOpen(false);
    await workspace.refresh();
  }

  async function toggleActive(shift) {
    setBusy(`toggle-${shift.id}`);
    const result = await updateShift(shift.id, { isActive: shift.isActive === false });
    setBusy('');
    if (result.error) {
      notify(result.error.message, 'error');
      return;
    }
    notify(`${shift.name} ${shift.isActive === false ? 'activated' : 'deactivated'}.`);
    await workspace.refresh();
  }

  function openAssign(shiftId = '') {
    setAssignForm({
      employeeId: scopedEmployees[0]?.id || '',
      shiftId: shiftId || shifts[0]?.id || '',
      effectiveFrom: todayKey(),
    });
    setError('');
    setAssignOpen(true);
  }

  async function saveAssignment(event) {
    event.preventDefault();
    if (!assignForm.employeeId || !assignForm.shiftId) {
      setError('Choose an employee and a shift.');
      return;
    }
    setBusy('assign');
    const result = await assignShift(assignForm.employeeId, assignForm.shiftId, assignForm.effectiveFrom);
    setBusy('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    notify('Shift assignment created. The previous active assignment was closed the day before.');
    setAssignOpen(false);
    await workspace.refresh();
    if (assignForm.employeeId === context?.employeeId) await auth.refreshContext();
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['People & access', 'Shift management']}
        eyebrow="WORKFORCE SCHEDULING"
        title="Shift management"
        description="Define day, night and rotating patterns with breaks, lunch, grace, weekly working days and overtime policy. Assignments preserve history with effective dates so attendance and payroll remain auditable."
        actions={
          <>
            {canAssign && <Button variant="secondary" icon="CalendarCheck" onClick={() => openAssign()}>Assign shift</Button>}
            {canManage && <Button icon="Plus" onClick={openCreate}>Create shift</Button>}
          </>
        }
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Shift patterns" value={shifts.length} icon="CalendarDays" footnote={`${shifts.filter((shift) => shift.metrics.crossMidnight).length} cross midnight`} />
        <StatCard label="Active assignments" value={activeAssignments.length} icon="UserCheck" tone="lime" footnote={`${assignments.length} assignments on record`} />
        <StatCard label="Weekly patterns" value={`${new Set(shifts.map((shift) => shift.weeklyWorkingDays.join(','))).size}`} icon="RefreshCw" footnote="Distinct working-day sets" />
        <StatCard label="Holidays" value={holidays.length} icon="Calendar" tone="default" footnote={`${holidays.filter((holiday) => !holiday.plantId).length} organization-wide`} />
      </section>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'shifts', label: 'Shift patterns', icon: 'CalendarDays', count: shifts.length },
          { id: 'assignments', label: 'Assignments', icon: 'CalendarCheck', count: assignments.length },
          { id: 'holidays', label: 'Holidays', icon: 'Calendar', count: holidays.length },
        ]}
      />

      {tab === 'shifts' && (
        <>
          <div className="pt-toolbar">
            <span className="pt-toolbar-label"><Icon name="Factory" size={14} /> Plant scope</span>
            <Select value={plantFilter} onChange={(event) => setPlantFilter(event.target.value)} aria-label="Filter shifts by plant">
              <option value="all">All plants</option>
              {plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
            </Select>
          </div>
          <div className="pt-shift-card-grid">
            {visibleShifts.map((shift) => {
              const plant = plants.find((item) => item.id === shift.plantId);
              const department = departments.find((item) => item.id === shift.departmentId);
              const assigned = activeAssignments.filter((assignment) => assignment.shiftId === shift.id);
              return (
                <Card
                  key={shift.id}
                  className="pt-shift-card"
                  action={<Badge tone={shift.isActive === false ? 'red' : 'green'} dot>{shift.isActive === false ? 'Inactive' : 'Active'}</Badge>}
                >
                  <div className="pt-shift-card-head">
                    <span className="pt-shift-swatch" style={{ background: shift.color || '#cdf22b' }} />
                    <div>
                      <h2>{shift.name}</h2>
                      <p className="pt-muted pt-small">
                        <span className="pt-mono">{shift.code}</span> · {plant?.name || 'Organization-wide'}{department ? ` · ${department.name}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="pt-big-shift">
                    <strong>{shift.startTime}</strong>
                    <span><Icon name="ArrowRight" size={14} /> {shift.metrics.crossMidnight ? 'next day' : formatMinutes(shift.metrics.spanMinutes)}</span>
                    <strong>{shift.endTime}</strong>
                  </div>

                  <div className="pt-shift-metric-grid">
                    <div><small>Net working</small><strong>{formatMinutes(shift.metrics.netWorkingMinutes)}</strong></div>
                    <div><small>Unpaid break</small><strong>{formatMinutes(shift.metrics.unpaidBreakMinutes)}</strong></div>
                    <div><small>Lunch</small><strong>{shift.lunchStart ? `${shift.lunchStart}–${shift.lunchEnd}` : '—'}</strong></div>
                    <div><small>Grace</small><strong>{shift.graceMinutes || 0} min</strong></div>
                    <div><small>Overtime</small><strong>{String(shift.overtimePolicy || 'none').replaceAll('_', ' ')}</strong></div>
                    <div><small>Multiplier</small><strong>{shift.overtimeMultiplier || 1}×</strong></div>
                  </div>

                  <div className="pt-shift-days">
                    {WEEK_DAYS.map((day) => (
                      <span key={day.value} className={shift.weeklyWorkingDays?.includes(day.value) ? 'on' : ''}>{day.label}</span>
                    ))}
                  </div>

                  <div className="pt-break-list">
                    {(shift.breaks || []).map((item) => (
                      <div key={item.id || `${item.name}-${item.startTime}`} className="pt-break-row">
                        <span className="pt-break-icon"><Icon name={item.isPaid ? 'Coffee' : 'Utensils'} size={13} /></span>
                        <span><strong>{item.name}</strong><small>{item.startTime}–{item.endTime} · {item.isPaid ? 'paid' : 'unpaid'}</small></span>
                      </div>
                    ))}
                    {!shift.breaks?.length && <span className="pt-muted pt-small">No configured breaks.</span>}
                  </div>

                  <div className="pt-shift-card-foot">
                    <span className="pt-muted pt-small">
                      <Icon name="Users" size={12} /> {assigned.length} assigned · effective {formatDate(shift.effectiveFrom)}{shift.effectiveTo ? ` – ${formatDate(shift.effectiveTo)}` : ''}
                    </span>
                    <div className="pt-link-row">
                      {canManage && <button type="button" className="pt-link-btn" onClick={() => openEdit(shift)}><Icon name="Pencil" size={12} /> Edit</button>}
                      {canAssign && <button type="button" className="pt-link-btn" onClick={() => openAssign(shift.id)}><Icon name="CalendarCheck" size={12} /> Assign</button>}
                      {canManage && (
                        <button type="button" className="pt-link-btn" disabled={busy === `toggle-${shift.id}`} onClick={() => toggleActive(shift)}>
                          <Icon name={shift.isActive === false ? 'CheckCircle2' : 'Ban'} size={12} /> {shift.isActive === false ? 'Activate' : 'Deactivate'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="pt-shift-timezone"><Icon name="Globe" size={11} /> {shift.timezone} · {timezoneLabel(shift.timezone)}</div>
                </Card>
              );
            })}
            {!visibleShifts.length && <Card><EmptyState icon="CalendarDays" title="No shifts in this view" description="Create a shift pattern or change the plant filter." /></Card>}
          </div>
        </>
      )}

      {tab === 'assignments' && (
        <Card
          title="Employee shift assignments"
          subtitle="Assignments are effective-dated. Creating a new assignment closes the previous open assignment the day before."
          action={canAssign ? <Button size="sm" icon="Plus" onClick={() => openAssign()}>New assignment</Button> : null}
        >
          <DataTable
            rows={assignments.slice().sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))}
            columns={[
              {
                key: 'employee',
                label: 'Employee',
                render: (row) => (
                  <span className="pt-person-cell">
                    <Avatar name={row.employee?.fullName} size="sm" />
                    <span><strong>{row.employee?.fullName || 'Unknown'}</strong><small>{row.employee?.employeeCode} · {row.employee?.designation}</small></span>
                  </span>
                ),
              },
              {
                key: 'shift',
                label: 'Shift',
                render: (row) => row.shift
                  ? <span className="pt-table-primary">{row.shift.name}<small className="pt-muted pt-mono">{row.shift.startTime}–{row.shift.endTime}</small></span>
                  : <span className="pt-muted">—</span>,
              },
              {
                key: 'effective',
                label: 'Effective period',
                render: (row) => (
                  <span className="pt-mono pt-muted">
                    {formatDate(row.effectiveFrom)} → {row.effectiveTo ? formatDate(row.effectiveTo) : 'open'}
                  </span>
                ),
              },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.effectiveTo ? 'cancelled' : 'active'} /> },
              { key: 'notes', label: 'Notes', render: (row) => <span className="pt-muted pt-small">{row.notes || '—'}</span> },
            ]}
            empty={<EmptyState icon="CalendarCheck" title="No assignments" description="Assign shifts to employees to populate schedules and attendance." />}
          />
        </Card>
      )}

      {tab === 'holidays' && (
        <div className="pt-grid-2">
          <Card title="Holiday calendar" subtitle="Holidays suppress scheduled work and attendance exceptions.">
            <div className="pt-holiday-list">
              {holidays.map((holiday) => (
                <div key={holiday.id} className="pt-holiday-row">
                  <span className="pt-holiday-date">
                    <strong>{new Date(`${holiday.holidayDate || holiday.date}T00:00:00`).getDate()}</strong>
                    <small>{new Date(`${holiday.holidayDate || holiday.date}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</small>
                  </span>
                  <span>
                    <strong>{holiday.name}</strong>
                    <small>{plants.find((plant) => plant.id === holiday.plantId)?.name || 'All plants'}{holiday.isOptional ? ' · optional' : ''}</small>
                  </span>
                  <Badge tone={holiday.isOptional ? 'amber' : 'violet'}>{holiday.isOptional ? 'Optional' : 'Mandatory'}</Badge>
                </div>
              ))}
              {!holidays.length && <EmptyState icon="Calendar" title="No holidays" description="Add plant or organization holidays in the next module." />}
            </div>
          </Card>

          <Card title="Scheduling rules" subtitle="How this module resolves a working day">
            <ul className="pt-policy-list">
              <li><Icon name="Check" size={13} /> Cross-midnight shifts roll the scheduled end into the next calendar day.</li>
              <li><Icon name="Check" size={13} /> Lunch and unpaid breaks reduce net working minutes; paid breaks do not.</li>
              <li><Icon name="Check" size={13} /> Grace minutes apply to lateness only and never change scheduled minutes.</li>
              <li><Icon name="Check" size={13} /> Weekly working days drive roster generation and attendance expectations.</li>
              <li><Icon name="Check" size={13} /> Approved leave and holidays override a scheduled working day.</li>
              <li><Icon name="Check" size={13} /> Reassignment closes the previous assignment with an effective end date.</li>
            </ul>
            <div className="pt-toolbar-label"><Icon name="ShieldCheck" size={14} /> Shifts and assignments are protected by shifts.manage and shifts.assign.</div>
          </Card>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Create shift pattern'}
        description="Day and night shifts may cross midnight. All times are wall-clock values interpreted in the selected timezone."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button icon={editing ? 'Save' : 'Plus'} onClick={saveShift} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : editing ? 'Save shift' : 'Create shift'}</Button>
          </>
        }
      >
        {form && (
          <form className="pt-form-grid" onSubmit={saveShift}>
            {error && <div className="pt-form-error pt-span-2"><Icon name="AlertTriangle" size={15} /> {error}</div>}
            <Field label="Shift name" required><TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Night shift" /></Field>
            <Field label="Code" required><TextInput value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="NIGHT" /></Field>
            <Field label="Plant">
              <Select value={form.plantId} onChange={(event) => setForm({ ...form, plantId: event.target.value, departmentId: '' })}>
                <option value="">Organization-wide</option>
                {plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
              </Select>
            </Field>
            <Field label="Department">
              <Select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
                <option value="">All departments</option>
                {departments.filter((department) => !form.plantId || department.plantId === form.plantId).map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Start time" required><TextInput type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></Field>
            <Field label="End time" required><TextInput type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></Field>
            <Field label="Timezone"><TextInput value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} placeholder="Asia/Kolkata" /></Field>
            <Field label="Grace period (minutes)"><TextInput type="number" min="0" max="120" value={form.graceMinutes} onChange={(event) => setForm({ ...form, graceMinutes: event.target.value })} /></Field>
            <Field label="Lunch start"><TextInput type="time" value={form.lunchStart} onChange={(event) => setForm({ ...form, lunchStart: event.target.value })} /></Field>
            <Field label="Lunch end"><TextInput type="time" value={form.lunchEnd} onChange={(event) => setForm({ ...form, lunchEnd: event.target.value })} /></Field>
            <Field label="Overtime policy">
              <Select value={form.overtimePolicy} onChange={(event) => setForm({ ...form, overtimePolicy: event.target.value })}>
                {OVERTIME_POLICIES.map((policy) => <option key={policy.value} value={policy.value}>{policy.label}</option>)}
              </Select>
            </Field>
            <Field label="Overtime multiplier"><TextInput type="number" step="0.25" min="1" max="3" value={form.overtimeMultiplier} onChange={(event) => setForm({ ...form, overtimeMultiplier: event.target.value })} /></Field>
            <Field label="Effective from" required><TextInput type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} /></Field>
            <Field label="Effective to" hint="Leave blank for an open-ended pattern."><TextInput type="date" value={form.effectiveTo} onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} /></Field>

            <Field label="Weekly working days" className="pt-span-2" required>
              <div className="pt-day-picker">
                {WEEK_DAYS.map((day) => (
                  <button key={day.value} type="button" className={form.weeklyWorkingDays.includes(day.value) ? 'on' : ''} onClick={() => toggleDay(day.value)}>
                    {day.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="pt-span-2 pt-break-editor">
              <div className="pt-record-section-head">
                <div><strong>Breaks</strong><small>Paid breaks do not reduce net working minutes; lunch is treated as unpaid.</small></div>
                <Button size="sm" variant="secondary" icon="Plus" onClick={addBreak}>Add break</Button>
              </div>
              {form.breaks.map((item, index) => (
                <div key={index} className="pt-break-edit-row">
                  <TextInput value={item.name} onChange={(event) => updateBreak(index, { name: event.target.value })} placeholder="Break name" aria-label="Break name" />
                  <TextInput type="time" value={item.startTime} onChange={(event) => updateBreak(index, { startTime: event.target.value })} aria-label="Break start" />
                  <TextInput type="time" value={item.endTime} onChange={(event) => updateBreak(index, { endTime: event.target.value })} aria-label="Break end" />
                  <label className="pt-inline-check">
                    <input type="checkbox" checked={Boolean(item.isPaid)} onChange={(event) => updateBreak(index, { isPaid: event.target.checked })} />
                    Paid
                  </label>
                  <Button variant="ghost" size="sm" icon="Trash2" onClick={() => removeBreak(index)}>Remove</Button>
                </div>
              ))}
              {!form.breaks.length && <p className="pt-muted pt-small">No breaks configured. Add tea, meal or rest breaks as required.</p>}
            </div>

            {previewMetrics && (
              <div className="pt-shift-preview pt-span-2">
                <span className="pt-eyebrow">LIVE PREVIEW</span>
                <div className="pt-shift-preview-grid">
                  <div><small>Shift span</small><strong>{formatMinutes(previewMetrics.spanMinutes)}</strong></div>
                  <div><small>Net working</small><strong>{formatMinutes(previewMetrics.netWorkingMinutes)}</strong></div>
                  <div><small>Breaks</small><strong>{previewMetrics.breakCount}</strong></div>
                  <div><small>Crosses midnight</small><strong>{previewMetrics.crossMidnight ? 'Yes' : 'No'}</strong></div>
                </div>
              </div>
            )}
          </form>
        )}
      </Modal>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign a shift"
        description="The previous open assignment is closed the day before the new effective date. History is never overwritten."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button icon="CalendarCheck" onClick={saveAssignment} disabled={busy === 'assign'}>{busy === 'assign' ? 'Assigning…' : 'Create assignment'}</Button>
          </>
        }
      >
        <form className="pt-form-grid" onSubmit={saveAssignment}>
          {error && <div className="pt-form-error pt-span-2"><Icon name="AlertTriangle" size={15} /> {error}</div>}
          <Field label="Employee" required className="pt-span-2">
            <Select value={assignForm.employeeId} onChange={(event) => setAssignForm({ ...assignForm, employeeId: event.target.value })}>
              <option value="">Select an employee</option>
              {scopedEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.employeeCode} · {employee.department}</option>
              ))}
            </Select>
          </Field>
          <Field label="Shift" required>
            <Select value={assignForm.shiftId} onChange={(event) => setAssignForm({ ...assignForm, shiftId: event.target.value })}>
              <option value="">Select a shift</option>
              {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} ({shift.startTime}–{shift.endTime})</option>)}
            </Select>
          </Field>
          <Field label="Effective from" required><TextInput type="date" value={assignForm.effectiveFrom} onChange={(event) => setAssignForm({ ...assignForm, effectiveFrom: event.target.value })} /></Field>
        </form>
      </Modal>
    </div>
  );
}
