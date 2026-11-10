import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { rolesFor } from '../data/selectors.js';
import { PERMISSIONS, hasPermission } from '../data/accessControl.js';
import {
  assignRole,
  removeRole,
  updateApprovalAuthority,
  updateRolePermissions,
} from '../data/actions.js';
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
  currency,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const REQUEST_TYPES = ['leave', 'expense', 'purchase', 'access', 'shift_swap', 'customer_evidence'];

function permissionGroups() {
  const groups = new Map();
  PERMISSIONS.forEach((permission) => {
    if (!groups.has(permission.module)) groups.set(permission.module, []);
    groups.get(permission.module).push(permission);
  });
  return [...groups.entries()].map(([module, permissions]) => ({ module, permissions }));
}

function sameSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}

export default function RolesPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const data = workspace.data;

  const [tab, setTab] = useState('catalogue');
  const [selectedKey, setSelectedKey] = useState('');
  const [draft, setDraft] = useState([]);
  const [permissionQuery, setPermissionQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [assignmentDrafts, setAssignmentDrafts] = useState({});
  const [authority, setAuthority] = useState(null);
  const [authorityForm, setAuthorityForm] = useState({});

  const catalogue = useMemo(() => (data && context ? rolesFor(data, context) : null), [data, context]);
  const roles = useMemo(() => catalogue?.roles || [], [catalogue]);
  const employees = useMemo(() => catalogue?.employees || [], [catalogue]);
  const authorities = useMemo(() => catalogue?.approvalAuthorities || [], [catalogue]);
  const canManageRoles = hasPermission(context?.permissions, 'roles.manage');
  const canManageAuthorities = hasPermission(context?.permissions, 'approval_authorities.manage');
  const groups = useMemo(permissionGroups, []);

  const selectedRole = roles.find((role) => role.key === selectedKey) || null;

  useEffect(() => {
    if (!selectedKey && roles.length) setSelectedKey(roles[0].key);
  }, [roles, selectedKey]);

  useEffect(() => {
    if (selectedRole) {
      setDraft([...new Set(selectedRole.permissions || [])]);
      setError('');
    }
  }, [selectedRole]);

  const dirty = selectedRole ? !sameSet(draft, selectedRole.permissions || []) : false;
  const filteredGroups = useMemo(() => {
    const needle = permissionQuery.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) => `${permission.key} ${permission.description}`.toLowerCase().includes(needle)),
      }))
      .filter((group) => group.permissions.length);
  }, [groups, permissionQuery]);

  function togglePermission(key) {
    setDraft((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function toggleModule(modulePermissions) {
    const keys = modulePermissions.map((permission) => permission.key);
    const allGranted = keys.every((key) => draft.includes(key));
    setDraft((current) => (allGranted ? current.filter((key) => !keys.includes(key)) : [...new Set([...current, ...keys])]));
  }

  async function savePermissions() {
    if (!selectedRole) return;
    setBusy('permissions');
    const result = await updateRolePermissions(selectedRole.key, draft);
    setBusy('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    notify(`${selectedRole.name} permissions saved (${draft.length} granted).`);
    await workspace.refresh();
    await auth.refreshContext();
  }

  async function handleAssign(employee) {
    const roleKey = assignmentDrafts[employee.id];
    if (!roleKey) return;
    setBusy(`assign-${employee.id}`);
    const result = await assignRole(employee.id, roleKey);
    setBusy('');
    if (result.error) {
      notify(result.error.message, 'error');
      return;
    }
    setAssignmentDrafts((current) => ({ ...current, [employee.id]: '' }));
    notify(`Assigned ${roles.find((role) => role.key === roleKey)?.name || roleKey} to ${employee.fullName}.`);
    await workspace.refresh();
    if (employee.id === context?.employeeId) await auth.refreshContext();
  }

  async function handleRemove(employee, roleKey) {
    if ((employee.roleKeys || []).length <= 1) {
      notify('An employee must keep at least one role. Assign a replacement first.', 'error');
      return;
    }
    setBusy(`remove-${employee.id}-${roleKey}`);
    const result = await removeRole(employee.id, roleKey);
    setBusy('');
    if (result.error) {
      notify(result.error.message, 'error');
      return;
    }
    notify(`Removed ${roleKey} from ${employee.fullName}.`);
    await workspace.refresh();
    if (employee.id === context?.employeeId) await auth.refreshContext();
  }

  function openAuthority(authorityRecord) {
    setAuthority(authorityRecord);
    setAuthorityForm({
      level: authorityRecord.level,
      thresholdAmount: authorityRecord.thresholdAmount ?? '',
      selfApprovalAllowed: Boolean(authorityRecord.selfApprovalAllowed),
      canDelegate: Boolean(authorityRecord.canDelegate),
      requestType: authorityRecord.requestType,
    });
    setError('');
  }

  async function saveAuthority(event) {
    event.preventDefault();
    if (!authority) return;
    setBusy('authority');
    const result = await updateApprovalAuthority(authority.id, {
      level: Number(authorityForm.level) || 1,
      thresholdAmount: authorityForm.thresholdAmount === '' ? null : Number(authorityForm.thresholdAmount),
      selfApprovalAllowed: Boolean(authorityForm.selfApprovalAllowed),
      canDelegate: Boolean(authorityForm.canDelegate),
      requestType: authorityForm.requestType,
    });
    setBusy('');
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setAuthority(null);
    notify('Approval authority updated.');
    await workspace.refresh();
  }

  if (workspace.loading && !data) {
    return <div className="pt-page-loading"><span className="pt-spinner" /> Loading roles and permissions…</div>;
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['People & access', 'Roles & permissions']}
        eyebrow="ACCESS CONTROL"
        title="Roles & permissions"
        description="Sixteen initial roles map to concrete permission keys. The matrix here mirrors role_permissions in PostgreSQL; RLS and protected RPCs enforce the same grants for every API call."
        actions={canManageRoles ? <Badge tone="lime" dot>Editable</Badge> : <Badge tone="amber" dot>Read only</Badge>}
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Roles" value={roles.length} icon="ShieldCheck" footnote="System role catalogue" />
        <StatCard label="Permissions" value={PERMISSIONS.length} icon="KeyRound" footnote={`${groups.length} modules`} />
        <StatCard label="Assignments" value={employees.reduce((total, employee) => total + (employee.roleKeys?.length || 0), 0)} icon="UserCog" tone="lime" footnote={`${employees.length} employees in scope`} />
        <StatCard label="Approval authorities" value={authorities.length} icon="BadgeCheck" footnote={`${authorities.filter((item) => item.thresholdAmount != null).length} amount thresholds`} />
      </section>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'catalogue', label: 'Role catalogue', icon: 'ShieldCheck', count: roles.length },
          { id: 'assignments', label: 'Assignments', icon: 'UserCog', count: employees.length },
          { id: 'authorities', label: 'Approval authority', icon: 'BadgeCheck', count: authorities.length },
        ]}
      />

      {tab === 'catalogue' && (
        <div className="pt-roles-layout">
          <Card title="Roles" subtitle="Highest level wins for landing pages; permissions are additive." className="pt-roles-list-card">
            <div className="pt-roles-list">
              {roles.map((role) => (
                <button
                  key={role.key}
                  type="button"
                  className={`pt-role-item ${role.key === selectedKey ? 'on' : ''}`}
                  onClick={() => setSelectedKey(role.key)}
                >
                  <span className="pt-role-level">{role.level}</span>
                  <span>
                    <strong>{role.name}</strong>
                    <small>{role.permissions?.length || 0} permissions · {employees.filter((employee) => employee.roleKeys?.includes(role.key)).length} employees</small>
                  </span>
                  {role.key === selectedKey && <Icon name="ChevronRight" size={15} />}
                </button>
              ))}
            </div>
          </Card>

          <div className="pt-roles-detail">
            {selectedRole ? (
              <Card
                title={selectedRole.name}
                subtitle={selectedRole.description}
                action={
                  <div className="pt-role-detail-actions">
                    <Badge tone="neutral">Level {selectedRole.level}</Badge>
                    <Badge tone={selectedRole.isSystem ? 'violet' : 'lime'}>{selectedRole.isSystem ? 'System role' : 'Custom role'}</Badge>
                  </div>
                }
              >
                <div className="pt-role-meta">
                  <div><small>Role key</small><strong className="pt-mono">{selectedRole.key}</strong></div>
                  <div><small>Granted</small><strong>{draft.length} / {PERMISSIONS.length}</strong></div>
                  <div><small>Assigned employees</small><strong>{employees.filter((employee) => employee.roleKeys?.includes(selectedRole.key)).length}</strong></div>
                  <div><small>Draft state</small><strong>{dirty ? 'Unsaved changes' : 'In sync with database'}</strong></div>
                </div>

                {error && <div className="pt-form-error"><Icon name="AlertTriangle" size={15} /> {error}</div>}

                <div className="pt-toolbar pt-role-toolbar">
                  <span className="pt-inline-search">
                    <Icon name="Search" size={15} />
                    <TextInput value={permissionQuery} onChange={(event) => setPermissionQuery(event.target.value)} placeholder="Filter permissions…" aria-label="Filter permissions" />
                  </span>
                  <span className="pt-muted pt-small"><Icon name="LockKeyhole" size={12} /> Changes are audit logged</span>
                </div>

                <div className="pt-permission-groups">
                  {filteredGroups.map((group) => {
                    const allGranted = group.permissions.every((permission) => draft.includes(permission.key));
                    return (
                      <div key={group.module} className="pt-permission-group">
                        <div className="pt-permission-group-head">
                          <div>
                            <strong>{group.module.replaceAll('_', ' ')}</strong>
                            <small>{group.permissions.filter((permission) => draft.includes(permission.key)).length} of {group.permissions.length} granted</small>
                          </div>
                          {canManageRoles && (
                            <button type="button" className="pt-link-btn" onClick={() => toggleModule(group.permissions)}>
                              {allGranted ? 'Clear module' : 'Grant module'}
                            </button>
                          )}
                        </div>
                        <div className="pt-permission-list">
                          {group.permissions.map((permission) => {
                            const on = draft.includes(permission.key);
                            return (
                              <label key={permission.key} className={`pt-permission-row ${on ? 'on' : ''} ${canManageRoles ? '' : 'locked'}`}>
                                <input
                                  type="checkbox"
                                  checked={on}
                                  disabled={!canManageRoles}
                                  onChange={() => togglePermission(permission.key)}
                                />
                                <span className="pt-permission-check"><Icon name="Check" size={11} /></span>
                                <span>
                                  <strong className="pt-mono">{permission.key}</strong>
                                  <small>{permission.description}</small>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {!filteredGroups.length && <EmptyState icon="KeyRound" title="No matching permissions" description="Try a different module or permission key." />}
                </div>

                <div className="pt-form-actions">
                  <span className="pt-muted pt-small">
                    {dirty ? 'You have unsaved permission changes.' : 'Permission matrix matches the last saved state.'}
                  </span>
                  <div>
                    <Button variant="ghost" onClick={() => setDraft([...new Set(selectedRole.permissions || [])])} disabled={!dirty}>Reset</Button>
                    <Button icon="Save" onClick={savePermissions} disabled={!canManageRoles || !dirty || busy === 'permissions'}>
                      {busy === 'permissions' ? 'Saving…' : 'Save permissions'}
                    </Button>
                  </div>
                </div>
              </Card>
            ) : <Card><EmptyState icon="ShieldCheck" title="Select a role" /></Card>}
          </div>
        </div>
      )}

      {tab === 'assignments' && (
        <Card title="Role assignments" subtitle="Multi-role assignments are additive. Removing the final role is blocked to keep every employee with a baseline permission set.">
          <DataTable
            rows={employees}
            columns={[
              {
                key: 'employee',
                label: 'Employee',
                render: (row) => (
                  <span className="pt-person-cell">
                    <Avatar name={row.fullName} src={row.photoUrl} size="sm" />
                    <span><strong>{row.fullName}</strong><small>{row.employeeCode} · {row.designation}</small></span>
                  </span>
                ),
              },
              {
                key: 'roles',
                label: 'Assigned roles',
                render: (row) => (
                  <span className="pt-role-chips">
                    {(row.roleKeys || []).map((key) => {
                      const role = roles.find((item) => item.key === key);
                      return (
                        <span key={key} className="pt-role-chip">
                          <Badge tone={key === 'administrator' ? 'violet' : 'lime'}>{role?.name || key}</Badge>
                          {canManageRoles && (
                            <button
                              type="button"
                              aria-label={`Remove ${key} from ${row.fullName}`}
                              disabled={busy === `remove-${row.id}-${key}`}
                              onClick={() => handleRemove(row, key)}
                            >
                              <Icon name="X" size={11} />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge status={row.employmentStatus} />,
              },
              {
                key: 'assign',
                label: 'Assign role',
                align: 'right',
                render: (row) => canManageRoles ? (
                  <span className="pt-inline-form">
                    <Select
                      value={assignmentDrafts[row.id] || ''}
                      onChange={(event) => setAssignmentDrafts((current) => ({ ...current, [row.id]: event.target.value }))}
                      aria-label={`Role to assign to ${row.fullName}`}
                    >
                      <option value="">Select role</option>
                      {roles.filter((role) => !row.roleKeys?.includes(role.key)).map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
                    </Select>
                    <Button size="sm" icon="Plus" disabled={!assignmentDrafts[row.id] || busy === `assign-${row.id}`} onClick={() => handleAssign(row)}>Assign</Button>
                  </span>
                ) : <span className="pt-muted pt-small">Read only</span>,
              },
            ]}
            empty={<EmptyState icon="UserCog" title="No employees in scope" />}
          />
        </Card>
      )}

      {tab === 'authorities' && (
        <Card title="Approval authority" subtitle="Approval authority determines who can decide which request type, at which level, and up to what amount.">
          <DataTable
            rows={authorities}
            columns={[
              {
                key: 'scope',
                label: 'Scope',
                render: (row) => (
                  <span className="pt-table-primary">
                    {String(row.scopeType || '').replaceAll('_', ' ')}
                    <small className="pt-muted pt-mono">{row.scopeId}</small>
                  </span>
                ),
              },
              { key: 'requestType', label: 'Request type', render: (row) => <Badge tone="neutral">{String(row.requestType).replaceAll('_', ' ')}</Badge> },
              {
                key: 'role',
                label: 'Approver role',
                render: (row) => <span>{roles.find((role) => `role-${role.key}` === row.roleId)?.name || row.roleId}</span>,
              },
              { key: 'level', label: 'Level', align: 'center', render: (row) => <Badge tone="lime">L{row.level}</Badge> },
              { key: 'thresholdAmount', label: 'Threshold', align: 'right', render: (row) => <span className="pt-mono">{row.thresholdAmount == null ? 'No limit' : currency(row.thresholdAmount)}</span> },
              {
                key: 'policy',
                label: 'Policy',
                render: (row) => (
                  <span className="pt-role-chips">
                    <Badge tone={row.selfApprovalAllowed ? 'amber' : 'green'}>{row.selfApprovalAllowed ? 'Self approval allowed' : 'No self approval'}</Badge>
                    <Badge tone="neutral">{row.canDelegate ? 'Delegation allowed' : 'No delegation'}</Badge>
                  </span>
                ),
              },
              {
                key: 'actions',
                label: '',
                align: 'right',
                render: (row) => (
                  <Button variant="ghost" size="sm" icon="Pencil" disabled={!canManageAuthorities} onClick={() => openAuthority(row)}>Edit</Button>
                ),
              },
            ]}
            empty={<EmptyState icon="BadgeCheck" title="No approval authority configured" description="Define who may approve each request type." />}
          />
          {!canManageAuthorities && (
            <p className="pt-muted pt-small"><Icon name="LockKeyhole" size={12} /> Editing requires <code className="pt-mono">approval_authorities.manage</code>.</p>
          )}
        </Card>
      )}

      <Modal
        open={Boolean(authority)}
        onClose={() => setAuthority(null)}
        title="Edit approval authority"
        description="Changes apply to new requests. In-flight requests keep the authority captured at submission."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAuthority(null)}>Cancel</Button>
            <Button icon="Save" onClick={saveAuthority} disabled={busy === 'authority'}>{busy === 'authority' ? 'Saving…' : 'Save authority'}</Button>
          </>
        }
      >
        {authority && (
          <form className="pt-form-grid" onSubmit={saveAuthority}>
            {error && <div className="pt-form-error pt-span-2"><Icon name="AlertTriangle" size={15} /> {error}</div>}
            <Field label="Request type" required>
              <Select value={authorityForm.requestType} onChange={(event) => setAuthorityForm({ ...authorityForm, requestType: event.target.value })}>
                {REQUEST_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
              </Select>
            </Field>
            <Field label="Approval level" hint="Lower numbers approve first.">
              <TextInput type="number" min="1" max="9" value={authorityForm.level} onChange={(event) => setAuthorityForm({ ...authorityForm, level: event.target.value })} />
            </Field>
            <Field label="Threshold amount" hint="Leave blank for no monetary limit.">
              <TextInput type="number" min="0" value={authorityForm.thresholdAmount} onChange={(event) => setAuthorityForm({ ...authorityForm, thresholdAmount: event.target.value })} placeholder="100000" />
            </Field>
            <Field label="Policy">
              <div className="pt-checkbox-stack">
                <label className="pt-inline-check">
                  <input type="checkbox" checked={authorityForm.selfApprovalAllowed} onChange={(event) => setAuthorityForm({ ...authorityForm, selfApprovalAllowed: event.target.checked })} />
                  Allow self approval
                </label>
                <label className="pt-inline-check">
                  <input type="checkbox" checked={authorityForm.canDelegate} onChange={(event) => setAuthorityForm({ ...authorityForm, canDelegate: event.target.checked })} />
                  Allow delegation
                </label>
              </div>
            </Field>
          </form>
        )}
      </Modal>
    </div>
  );
}
