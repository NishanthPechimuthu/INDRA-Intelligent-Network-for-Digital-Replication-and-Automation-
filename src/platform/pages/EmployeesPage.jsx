import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { employeesFor } from '../data/selectors.js';
import { hasPermission } from '../data/accessControl.js';
import {
  assignRole,
  inviteEmployee,
  removeRole,
  revokeInvitation,
  updateEmployee,
} from '../data/actions.js';
import { queryParam } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  DefinitionGrid,
  EmptyState,
  Field,
  InfoRow,
  Modal,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  TextInput,
  formatDate,
  relativeTime,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'suspended', 'terminated'];

function defaultInviteForm(plants) {
  return {
    email: '',
    employeeId: '',
    roleKey: 'operator',
    plantId: plants[0]?.id || '',
    departmentId: '',
  };
}

export default function EmployeesPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const data = workspace.data;

  const [tab, setTab] = useState('directory');
  const [query, setQuery] = useState('');
  const [plantFilter, setPlantFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(queryParam('employee') || null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', employeeId: '', roleKey: 'operator', plantId: '', departmentId: '' });
  const [roleDraft, setRoleDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('active');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const employees = useMemo(() => (data && context ? employeesFor(data, context) : []), [data, context]);
  const canManageEmployees = hasPermission(context?.permissions, 'employees.manage');
  const canManageRoles = hasPermission(context?.permissions, 'roles.manage');
  const canSeeAll = hasPermission(context?.permissions, 'employees.read.all');
  const plants = useMemo(() => data?.plants || [], [data]);
  const departments = useMemo(() => data?.departments || [], [data]);
  const roles = useMemo(() => data?.roles || [], [data]);
  const invitations = data?.invitations || [];

  const scopedPlants = useMemo(() => {
    const ids = new Set(employees.map((employee) => employee.plantId).filter(Boolean));
    return plants.filter((plant) => ids.has(plant.id));
  }, [employees, plants]);

  const scopedDepartments = useMemo(() => {
    const ids = new Set(employees.map((employee) => employee.departmentId).filter(Boolean));
    return departments.filter((department) => ids.has(department.id));
  }, [employees, departments]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees.filter((employee) => {
      if (plantFilter !== 'all' && employee.plantId !== plantFilter) return false;
      if (departmentFilter !== 'all' && employee.departmentId !== departmentFilter) return false;
      if (statusFilter !== 'all' && employee.employmentStatus !== statusFilter) return false;
      if (roleFilter !== 'all' && !employee.roleKeys?.includes(roleFilter)) return false;
      if (!needle) return true;
      const haystack = [
        employee.fullName,
        employee.employeeCode,
        employee.email,
        employee.designation,
        employee.department,
        employee.plant,
        ...(employee.roleKeys || []),
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [employees, query, plantFilter, departmentFilter, statusFilter, roleFilter]);

  const selected = employees.find((employee) => employee.id === selectedId) || null;
  const activeCount = employees.filter((employee) => employee.employmentStatus === 'active').length;
  const onLeaveCount = employees.filter((employee) => employee.employmentStatus === 'on_leave').length;
  const pendingInvitations = invitations.filter((invitation) => invitation.status === 'pending');

  useEffect(() => {
    if (!selected) return;
    setStatusDraft(selected.employmentStatus || 'active');
    const available = roles.find((role) => !selected.roleKeys?.includes(role.key));
    setRoleDraft(available?.key || '');
    setError('');
  }, [selectedId, selected, roles]);

  function openInvite() {
    setInviteForm(defaultInviteForm(scopedPlants.length ? scopedPlants : plants));
    setError('');
    setInviteOpen(true);
  }

  async function afterMutation(message, { refreshContext = false } = {}) {
    notify(message);
    await workspace.refresh();
    if (refreshContext) await auth.refreshContext();
  }

  async function handleInvite(event) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email.trim())) {
      setError('Enter a valid work email address.');
      return;
    }
    if (!inviteForm.roleKey) {
      setError('Choose the initial role for the invited employee.');
      return;
    }
    setBusy('invite');
    const result = await inviteEmployee({
      email: inviteForm.email.trim(),
      employeeId: inviteForm.employeeId || null,
      roleKey: inviteForm.roleKey,
      plantId: inviteForm.plantId || null,
      departmentId: inviteForm.departmentId || null,
    });
    setBusy('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setInviteOpen(false);
    await afterMutation(`Invitation sent to ${inviteForm.email.trim()}.`);
  }

  async function handleRevoke(invitation) {
    setBusy(invitation.id);
    const result = await revokeInvitation(invitation.id);
    setBusy('');
    if (result.error) {
      notify(result.error.message, 'error');
      return;
    }
    await afterMutation(`Invitation for ${invitation.email} revoked.`);
  }

  async function handleStatusSave() {
    if (!selected) return;
    setBusy('status');
    const result = await updateEmployee(selected.id, { employmentStatus: statusDraft });
    setBusy('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await afterMutation(`${selected.fullName} is now ${statusDraft.replaceAll('_', ' ')}.`, {
      refreshContext: selected.id === context?.employeeId,
    });
  }

  async function handleAssignRole() {
    if (!selected || !roleDraft) return;
    setBusy('role');
    const result = await assignRole(selected.id, roleDraft);
    setBusy('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await afterMutation(`Role assigned to ${selected.fullName}.`, { refreshContext: selected.id === context?.employeeId });
  }

  async function handleRemoveRole(roleKey) {
    if (!selected) return;
    if ((selected.roleKeys || []).length <= 1) {
      setError('An employee must keep at least one role. Assign a replacement role first.');
      return;
    }
    setBusy(`role-${roleKey}`);
    const result = await removeRole(selected.id, roleKey);
    setBusy('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await afterMutation(`Role removed from ${selected.fullName}.`, { refreshContext: selected.id === context?.employeeId });
  }

  if (workspace.loading && !data) {
    return <div className="pt-page-loading"><span className="pt-spinner" /> Loading employee directory…</div>;
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['People & access', 'Employees']}
        eyebrow="EMPLOYEE DIRECTORY"
        title="Employees & assignments"
        description="Profiles, reporting lines, roles and account status. Results are restricted to your plant and department scope; cross-scope records are never returned to the browser."
        actions={
          canManageEmployees
            ? <Button icon="UserPlus" onClick={openInvite}>Invite employee</Button>
            : null
        }
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Employees" value={employees.length} icon="Users" footnote={canSeeAll ? 'Organization-wide visibility' : 'Within your scope'} />
        <StatCard label="Active" value={activeCount} icon="UserCheck" tone="lime" footnote={`${onLeaveCount} on leave`} />
        <StatCard label="Roles in use" value={new Set(employees.flatMap((employee) => employee.roleKeys || [])).size} icon="ShieldCheck" footnote={`${roles.length} configured roles`} />
        <StatCard label="Pending invitations" value={pendingInvitations.length} icon="Send" tone={pendingInvitations.length ? 'warn' : 'default'} footnote={`${invitations.length} total invitations`} />
      </section>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'directory', label: 'Directory', icon: 'Users', count: employees.length },
          { id: 'invitations', label: 'Invitations', icon: 'Mail', count: invitations.length },
        ]}
      />

      {tab === 'directory' && (
        <Card
          title="Employee directory"
          subtitle={`${filtered.length} of ${employees.length} employees`}
          action={<Badge tone={canSeeAll ? 'lime' : 'neutral'} dot>{canSeeAll ? 'All plants' : 'Scoped'}</Badge>}
        >
          <div className="pt-toolbar pt-directory-toolbar">
            <span className="pt-inline-search">
              <Icon name="Search" size={15} />
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, code, email, role…"
                aria-label="Search employees"
              />
            </span>
            <Select value={plantFilter} onChange={(event) => setPlantFilter(event.target.value)} aria-label="Filter by plant">
              <option value="all">All plants</option>
              {scopedPlants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
            </Select>
            <Select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Filter by department">
              <option value="all">All departments</option>
              {scopedDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              {EMPLOYMENT_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
            </Select>
            <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
              <option value="all">All roles</option>
              {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
            </Select>
          </div>

          <DataTable
            rows={filtered}
            onRowClick={(employee) => setSelectedId(employee.id)}
            columns={[
              {
                key: 'employee',
                label: 'Employee',
                render: (row) => (
                  <span className="pt-person-cell">
                    <Avatar name={row.fullName} src={row.photoUrl} size="sm" status={row.employmentStatus === 'active' ? 'active' : 'away'} />
                    <span>
                      <strong>{row.fullName}</strong>
                      <small>{row.email}</small>
                    </span>
                  </span>
                ),
              },
              { key: 'employeeCode', label: 'Employee ID', render: (row) => <span className="pt-mono pt-muted">{row.employeeCode}</span> },
              {
                key: 'assignment',
                label: 'Designation & department',
                render: (row) => (
                  <span className="pt-table-primary">
                    {row.designation}
                    <small className="pt-muted">{row.department} · {row.plantCode}</small>
                  </span>
                ),
              },
              {
                key: 'shift',
                label: 'Current shift',
                render: (row) => row.currentShift
                  ? <span><strong>{row.currentShift.name}</strong><small className="pt-muted pt-mono">{row.currentShift.startTime}–{row.currentShift.endTime}</small></span>
                  : <span className="pt-muted">Unassigned</span>,
              },
              {
                key: 'roles',
                label: 'Roles',
                render: (row) => (
                  <span className="pt-role-chips">
                    {(row.roleKeys || []).map((key) => {
                      const role = roles.find((item) => item.key === key);
                      return <Badge key={key} tone={key === 'administrator' ? 'violet' : 'neutral'}>{role?.name || key.replaceAll('_', ' ')}</Badge>;
                    })}
                  </span>
                ),
              },
              { key: 'employmentStatus', label: 'Status', render: (row) => <StatusBadge status={row.employmentStatus} /> },
            ]}
            empty={<EmptyState icon="Users" title="No employees match" description="Adjust the filters or search for a different employee." />}
          />
        </Card>
      )}

      {tab === 'invitations' && (
        <Card
          title="Invitations"
          subtitle="Invitation links expire after seven days. Activation is handled by the protected accept_invitation RPC."
          action={canManageEmployees ? <Button size="sm" icon="Plus" onClick={openInvite}>New invitation</Button> : null}
        >
          <DataTable
            rows={invitations}
            columns={[
              {
                key: 'email',
                label: 'Invitee',
                render: (row) => {
                  const employee = employees.find((item) => item.id === row.employeeId);
                  return (
                    <span className="pt-person-cell">
                      <span className="pt-invite-badge"><Icon name="Mail" size={15} /></span>
                      <span><strong>{row.email}</strong><small>{employee?.fullName || 'New employee profile'}</small></span>
                    </span>
                  );
                },
              },
              {
                key: 'role',
                label: 'Initial role',
                render: (row) => <Badge tone="neutral">{roles.find((role) => role.key === row.roleKey)?.name || row.roleKey}</Badge>,
              },
              {
                key: 'scope',
                label: 'Plant / department',
                render: (row) => (
                  <span className="pt-table-primary">
                    {plants.find((plant) => plant.id === row.plantId)?.name || 'Organization'}
                    <small className="pt-muted">{departments.find((department) => department.id === row.departmentId)?.name || 'Unassigned'}</small>
                  </span>
                ),
              },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
              { key: 'expiresAt', label: 'Expires', render: (row) => <span className="pt-muted pt-mono">{formatDate(row.expiresAt)}</span> },
              {
                key: 'actions',
                label: '',
                align: 'right',
                render: (row) => row.status === 'pending'
                  ? <Button variant="ghost" size="sm" icon="Ban" disabled={busy === row.id || !canManageEmployees} onClick={(event) => { event.stopPropagation(); handleRevoke(row); }}>Revoke</Button>
                  : <span className="pt-muted pt-small">{relativeTime(row.expiresAt)}</span>,
              },
            ]}
            empty={<EmptyState icon="Mail" title="No invitations" description="Invite an employee to create their platform identity." />}
          />
        </Card>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? selected.fullName : 'Employee record'}
        description={selected ? `${selected.designation} · ${selected.employeeCode}` : ''}
        size="lg"
        footer={<Button variant="ghost" onClick={() => setSelectedId(null)}>Close</Button>}
      >
        {selected && (
          <div className="pt-employee-record">
            {error && <div className="pt-form-error"><Icon name="AlertTriangle" size={15} /> {error}</div>}
            <div className="pt-employee-record-head">
              <Avatar name={selected.fullName} src={selected.photoUrl} size="lg" status={selected.employmentStatus === 'active' ? 'active' : 'away'} />
              <div>
                <strong>{selected.fullName}</strong>
                <small>{selected.email} · {selected.phone || 'No phone'}</small>
                <div className="pt-profile-tags">
                  <StatusBadge status={selected.employmentStatus} />
                  <Badge tone="neutral"><Icon name="MapPin" size={11} /> {selected.plant}</Badge>
                  <Badge tone="neutral"><Icon name="Briefcase" size={11} /> {selected.jobCategory}</Badge>
                </div>
              </div>
            </div>

            <DefinitionGrid columns={2}>
              <InfoRow label="Employee ID" value={selected.employeeCode} mono />
              <InfoRow label="Designation" value={selected.designation} />
              <InfoRow label="Department" value={selected.department} />
              <InfoRow label="Plant" value={`${selected.plant} (${selected.plantCode})`} />
              <InfoRow label="Reporting manager" value={selected.manager?.fullName || selected.reportingManagerName || '—'} />
              <InfoRow label="Direct reports" value={selected.reports} />
              <InfoRow label="Production line" value={selected.productionLine || 'Not line-assigned'} />
              <InfoRow label="Joined" value={formatDate(selected.joinedOn)} />
              <InfoRow label="Employment type" value={(selected.employmentType || 'full time').replaceAll('_', ' ')} />
              <InfoRow label="Work mode" value={(selected.workMode || 'onsite').replaceAll('_', ' ')} />
              <InfoRow label="Current shift" value={selected.currentShift ? `${selected.currentShift.name} (${selected.currentShift.startTime}–${selected.currentShift.endTime})` : 'Unassigned'} />
              <InfoRow label="Role count" value={(selected.roleKeys || []).length} />
            </DefinitionGrid>

            <div className="pt-record-section">
              <div className="pt-record-section-head">
                <div><strong>Assigned roles</strong><small>Roles are additive; the union of permissions applies.</small></div>
                <Badge tone="neutral">{selected.roleKeys?.length || 0} assigned</Badge>
              </div>
              <div className="pt-role-chips">
                {(selected.roleKeys || []).map((key) => {
                  const role = roles.find((item) => item.key === key);
                  return (
                    <span key={key} className="pt-role-chip">
                      <Badge tone={key === 'administrator' ? 'violet' : 'lime'}>{role?.name || key}</Badge>
                      {canManageRoles && (
                        <button type="button" aria-label={`Remove ${key} role`} disabled={busy === `role-${key}`} onClick={() => handleRemoveRole(key)}>
                          <Icon name="X" size={11} />
                        </button>
                      )}
                    </span>
                  );
                })}
                {!selected.roleKeys?.length && <span className="pt-muted">No roles assigned.</span>}
              </div>
              {canManageRoles && (
                <div className="pt-inline-form">
                  <Select value={roleDraft} onChange={(event) => setRoleDraft(event.target.value)} aria-label="Role to assign">
                    <option value="">Select a role</option>
                    {roles.filter((role) => !selected.roleKeys?.includes(role.key)).map((role) => (
                      <option key={role.key} value={role.key}>{role.name}</option>
                    ))}
                  </Select>
                  <Button size="sm" icon="Plus" onClick={handleAssignRole} disabled={!roleDraft || busy === 'role'}>Assign role</Button>
                </div>
              )}
            </div>

            <div className="pt-record-section">
              <div className="pt-record-section-head">
                <div><strong>Account status</strong><small>Suspending an employee immediately blocks platform access.</small></div>
                {canManageEmployees ? (
                  <div className="pt-inline-form">
                    <Select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)} aria-label="Employment status">
                      {EMPLOYMENT_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                    </Select>
                    <Button size="sm" icon="Save" onClick={handleStatusSave} disabled={busy === 'status' || statusDraft === selected.employmentStatus}>Save status</Button>
                  </div>
                ) : <span className="pt-muted pt-small"><Icon name="LockKeyhole" size={12} /> Requires employees.manage</span>}
              </div>
              <p className="pt-muted pt-small">Status changes and role assignments are written to the audit log with the acting employee, source IP and timestamp.</p>
            </div>

            <div className="pt-record-section">
              <div className="pt-record-section-head">
                <div><strong>Skills & certifications</strong><small>Compliance evidence is read-only in this module.</small></div>
              </div>
              <div className="pt-chip-grid">
                {(selected.skills || []).map((skill) => <Badge key={skill.id} tone="blue"><Icon name="GraduationCap" size={11} /> {skill.name} · L{skill.proficiency}</Badge>)}
                {(selected.certifications || []).map((certification) => <Badge key={certification.id} tone={certification.status === 'verified' ? 'green' : 'red'}><Icon name="Award" size={11} /> {certification.name}</Badge>)}
                {!selected.skills?.length && !selected.certifications?.length && <span className="pt-muted pt-small">No skills or certifications recorded.</span>}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite an employee"
        description="The invitation is created by the platform-operations Edge Function; activation uses the protected accept_invitation RPC."
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button icon="Send" onClick={handleInvite} disabled={busy === 'invite'}>{busy === 'invite' ? 'Sending…' : 'Send invitation'}</Button>
          </>
        }
      >
        <form className="pt-form-grid" onSubmit={handleInvite}>
          {error && <div className="pt-form-error pt-span-2"><Icon name="AlertTriangle" size={15} /> {error}</div>}
          <Field label="Work email" required className="pt-span-2">
            <TextInput type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} placeholder="name@company.com" />
          </Field>
          <Field label="Initial role" required>
            <Select value={inviteForm.roleKey} onChange={(event) => setInviteForm({ ...inviteForm, roleKey: event.target.value })}>
              {roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
            </Select>
          </Field>
          <Field label="Link to existing employee" hint="Leave blank to create a new profile on activation.">
            <Select value={inviteForm.employeeId} onChange={(event) => setInviteForm({ ...inviteForm, employeeId: event.target.value })}>
              <option value="">Create a new profile</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.employeeCode}</option>)}
            </Select>
          </Field>
          <Field label="Plant">
            <Select value={inviteForm.plantId} onChange={(event) => setInviteForm({ ...inviteForm, plantId: event.target.value, departmentId: '' })}>
              <option value="">Organization-level</option>
              {plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
            </Select>
          </Field>
          <Field label="Department">
            <Select value={inviteForm.departmentId} onChange={(event) => setInviteForm({ ...inviteForm, departmentId: event.target.value })}>
              <option value="">Unassigned</option>
              {departments.filter((department) => !inviteForm.plantId || department.plantId === inviteForm.plantId).map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </Select>
          </Field>
          <div className="pt-invite-summary pt-span-2">
            <Icon name="ShieldCheck" size={16} />
            <span>
              The invitee receives <strong>{roles.find((role) => role.key === inviteForm.roleKey)?.name || 'the selected role'}</strong> permissions.
              Row-level security still limits every record to their assigned plant and department.
            </span>
          </div>
        </form>
      </Modal>
    </div>
  );
}
