import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { organizationFor } from '../data/selectors.js';
import { hasPermission } from '../data/accessControl.js';
import { createDepartment, updateDepartment, updateOrganization } from '../data/actions.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DefinitionGrid,
  EmptyState,
  Field,
  InfoRow,
  Modal,
  Progress,
  Select,
  StatCard,
  StatusBadge,
  Tabs,
  TextInput,
  Textarea,
  formatDate,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { useToast } from '../components/ToastProvider.jsx';

export default function OrganizationPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const [tab, setTab] = useState('overview');
  const [plantFilter, setPlantFilter] = useState('all');
  const [orgOpen, setOrgOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [orgForm, setOrgForm] = useState({});
  const [deptForm, setDeptForm] = useState({ plantId: '', name: '', code: '', costCenter: '', managerEmployeeId: '' });

  const org = useMemo(() => (workspace.data ? organizationFor(workspace.data) : null), [workspace.data]);
  const canManageOrg = hasPermission(context?.permissions, 'organization.manage');
  const canManageDepartments = hasPermission(context?.permissions, 'departments.manage');
  const canReadAssets = hasPermission(context?.permissions, 'production_lines.read');

  if (workspace.loading || !org) {
    return <div className="pt-page-loading"><span className="pt-spinner" /> Loading organization structure…</div>;
  }

  const { organization, plants, departments, productionLines, workstations, machines, headcountByDepartment } = org;
  const visiblePlants = plantFilter === 'all' ? plants : plants.filter((plant) => plant.id === plantFilter);
  const visibleDepartments = plantFilter === 'all' ? departments : departments.filter((department) => department.plantId === plantFilter);
  const employees = workspace.data.employees;
  const activeEmployees = employees.filter((employee) => employee.employmentStatus === 'active');
  const managers = employees.filter((employee) => employee.employmentStatus === 'active');

  function openOrgEdit() {
    setOrgForm({
      name: organization.name,
      legalName: organization.legalName,
      code: organization.code,
      timezone: organization.timezone,
      currency: organization.currency,
      website: organization.website || '',
      supportEmail: organization.supportEmail || '',
      supportPhone: organization.supportPhone || '',
      address: organization.address || '',
    });
    setError('');
    setOrgOpen(true);
  }

  function openDeptCreate() {
    setEditDept(null);
    setDeptForm({ plantId: plants[0]?.id || '', name: '', code: '', costCenter: '', managerEmployeeId: '' });
    setError('');
    setDeptOpen(true);
  }

  function openDeptEdit(department) {
    setEditDept(department);
    setDeptForm({
      plantId: department.plantId,
      name: department.name,
      code: department.code,
      costCenter: department.costCenter || '',
      managerEmployeeId: department.managerEmployeeId || '',
    });
    setError('');
    setDeptOpen(true);
  }

  async function saveOrganization(event) {
    event.preventDefault();
    if (!orgForm.name.trim() || !orgForm.code.trim()) {
      setError('Organization name and code are required.');
      return;
    }
    setBusy(true);
    const result = await updateOrganization(organization.id, orgForm);
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    notify('Organization profile updated.');
    setOrgOpen(false);
    await workspace.refresh();
  }

  async function saveDepartment(event) {
    event.preventDefault();
    if (!deptForm.name.trim() || !deptForm.code.trim() || !deptForm.plantId) {
      setError('Plant, department name and code are required.');
      return;
    }
    setBusy(true);
    const result = editDept
      ? await updateDepartment(editDept.id, deptForm)
      : await createDepartment({ ...deptForm, organizationId: organization.id });
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    notify(editDept ? 'Department updated.' : 'Department created. Assign a manager and employees next.');
    setDeptOpen(false);
    await workspace.refresh();
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['People & access', 'Organization']}
        eyebrow="MASTER DATA"
        title="Organization structure"
        description="The single source of truth for plants, departments, production lines, workstations and machines. Every platform record and RLS policy is scoped from this hierarchy."
        actions={
          canManageOrg
            ? <Button variant="secondary" icon="Pencil" onClick={openOrgEdit}>Edit organization</Button>
            : null
        }
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Plants" value={plants.length} icon="Factory" footnote={`${plants.filter((plant) => plant.isActive !== false).length} active`} />
        <StatCard label="Departments" value={departments.length} icon="Network" footnote={`${visibleDepartments.length} in current view`} />
        <StatCard label="Headcount" value={employees.length} icon="Users" footnote={`${activeEmployees.length} active employees`} />
        <StatCard label="Assets" value={workstations.length + machines.length} icon="Box" tone="lime" footnote={`${productionLines.length} lines · ${workstations.length} stations · ${machines.length} machines`} />
      </section>

      <div className="pt-org-hero">
        <div className="pt-org-identity">
          <span className="pt-org-logo">{organization.code?.slice(0, 3)}</span>
          <div>
            <span className="pt-eyebrow">ORGANIZATION</span>
            <h2>{organization.name}</h2>
            <p>{organization.legalName}</p>
            <div className="pt-profile-tags">
              <span className="pt-mono">{organization.code}</span>
              <span><Icon name="Globe" size={12} /> {organization.timezone}</span>
              <span><Icon name="MapPin" size={12} /> {organization.address || 'No registered address'}</span>
            </div>
          </div>
        </div>
        <div className="pt-org-facts">
          <div><small>Support</small><strong>{organization.supportEmail || '—'}</strong></div>
          <div><small>Phone</small><strong>{organization.supportPhone || '—'}</strong></div>
          <div><small>Currency · locale</small><strong>{organization.currency} · {organization.locale}</strong></div>
          <div><small>Established</small><strong>{formatDate(organization.createdAt)}</strong></div>
        </div>
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview', icon: 'Building2' },
          { id: 'structure', label: 'Plants & departments', icon: 'Network', count: departments.length },
          { id: 'assets', label: 'Production assets', icon: 'Factory', count: productionLines.length },
          { id: 'master', label: 'Master data', icon: 'Layers' },
        ]}
      />

      <div className="pt-org-toolbar">
        <span className="pt-toolbar-label"><Icon name="MapPin" size={14} /> Plant scope</span>
        <Select value={plantFilter} onChange={(event) => setPlantFilter(event.target.value)} aria-label="Filter by plant">
          <option value="all">All plants</option>
          {plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
        </Select>
        {canManageDepartments && tab === 'structure' && <Button size="sm" icon="Plus" onClick={openDeptCreate}>Add department</Button>}
      </div>

      {tab === 'overview' && (
        <div className="pt-grid-2">
          <Card title="Legal & operating profile" subtitle="Organization-level settings">
            <DefinitionGrid columns={2}>
              <InfoRow label="Legal name" value={organization.legalName} />
              <InfoRow label="Organization code" value={organization.code} mono />
              <InfoRow label="Timezone" value={organization.timezone} />
              <InfoRow label="Currency" value={organization.currency} />
              <InfoRow label="Locale" value={organization.locale} />
              <InfoRow label="Website" value={organization.website || '—'} />
              <InfoRow label="Support email" value={organization.supportEmail || '—'} />
              <InfoRow label="Support phone" value={organization.supportPhone || '—'} />
            </DefinitionGrid>
            <div className="pt-link-row">
              <span className="pt-muted pt-small"><Icon name="LockKeyhole" size={12} /> Editing requires <code className="pt-mono">organization.manage</code> and is audit logged.</span>
            </div>
          </Card>

          <Card title="Plant footprint" subtitle={`${plants.length} plants · ${departments.length} departments`}>
            <div className="pt-plant-summary-list">
              {plants.map((plant) => {
                const plantDepartments = departments.filter((department) => department.plantId === plant.id);
                const plantHeadcount = employees.filter((employee) => employee.plantId === plant.id).length;
                return (
                  <div key={plant.id} className="pt-plant-summary">
                    <span className="pt-plant-mark"><Icon name="Factory" size={17} /></span>
                    <div>
                      <strong>{plant.name} <span className="pt-mono">{plant.code}</span></strong>
                      <small>{plant.city}, {plant.state} · {plantDepartments.length} departments · {plantHeadcount} employees</small>
                    </div>
                    <StatusBadge status={plant.isActive === false ? 'suspended' : 'active'} />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Headcount by department" subtitle="Active and on-leave employees">
            <div className="pt-headcount-list">
              {departments
                .slice()
                .sort((a, b) => (headcountByDepartment[b.id] || 0) - (headcountByDepartment[a.id] || 0))
                .map((department) => {
                  const count = headcountByDepartment[department.id] || 0;
                  const max = Math.max(1, ...Object.values(headcountByDepartment));
                  return (
                    <div key={department.id} className="pt-headcount-row">
                      <div><strong>{department.name}</strong><small>{plants.find((plant) => plant.id === department.plantId)?.code || '—'} · {department.code}</small></div>
                      <div className="pt-headcount-bar"><span style={{ width: `${(count / max) * 100}%` }} /></div>
                      <strong>{count}</strong>
                    </div>
                  );
                })}
            </div>
          </Card>

          <Card title="Governance" subtitle="How organization scope is enforced">
            <ul className="pt-policy-list">
              <li><Icon name="Check" size={13} /> Every plant, department, employee and record carries an organization ID.</li>
              <li><Icon name="Check" size={13} /> RLS helpers resolve the signed-in employee's plant and department before returning rows.</li>
              <li><Icon name="Check" size={13} /> Cross-plant transfers close the old assignment with an effective end date rather than overwriting history.</li>
              <li><Icon name="Check" size={13} /> Soft deletion preserves audit evidence and referential integrity.</li>
              <li><Icon name="Check" size={13} /> Customer approvers see only explicitly shared project records.</li>
            </ul>
          </Card>
        </div>
      )}

      {tab === 'structure' && (
        <div className="pt-structure-list">
          {visiblePlants.map((plant) => (
            <Card
              key={plant.id}
              title={`${plant.name} · ${plant.code}`}
              subtitle={`${plant.city}, ${plant.state} · ${employees.filter((employee) => employee.plantId === plant.id).length} employees`}
              action={<Badge tone={plant.isActive === false ? 'red' : 'green'} dot>{plant.isActive === false ? 'Inactive' : 'Operating'}</Badge>}
            >
              <div className="pt-dept-list">
                {visibleDepartments.filter((department) => department.plantId === plant.id).map((department) => {
                  const manager = employees.find((employee) => employee.id === department.managerEmployeeId);
                  return (
                    <div key={department.id} className="pt-dept-card">
                      <div className="pt-dept-head">
                        <span className="pt-dept-icon"><Icon name="Network" size={15} /></span>
                        <div>
                          <strong>{department.name}</strong>
                          <small className="pt-mono">{department.code} · {department.costCenter || 'No cost centre'}</small>
                        </div>
                        {canManageDepartments && (
                          <Button variant="ghost" size="sm" icon="Pencil" onClick={() => openDeptEdit(department)}>Edit</Button>
                        )}
                      </div>
                      <div className="pt-dept-meta">
                        <span><Avatar name={manager?.fullName || 'Unassigned'} size="xs" /><span>{manager?.fullName || 'No manager'}<small>Department head</small></span></span>
                        <span><strong>{headcountByDepartment[department.id] || 0}</strong><small>Employees</small></span>
                        <span><strong>{productionLines.filter((line) => line.departmentId === department.id).length}</strong><small>Production lines</small></span>
                      </div>
                    </div>
                  );
                })}
                {!visibleDepartments.filter((department) => department.plantId === plant.id).length && <EmptyState icon="Network" title="No departments" description="Create a department to start assigning employees." />}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'assets' && (
        !canReadAssets ? (
          <Card><EmptyState icon="ShieldCheck" title="Production assets are restricted" description="Your roles do not include production_lines.read." /></Card>
        ) : (
          <div className="pt-grid-2">
            {productionLines.map((line) => {
              const lineStations = workstations.filter((station) => station.productionLineId === line.id);
              const lineMachines = machines.filter((machine) => lineStations.some((station) => station.id === machine.workstationId));
              return (
                <Card key={line.id} title={`${line.name} · ${line.code}`} subtitle={`${lineStations.length} workstations · ${lineMachines.length} machines`} action={<StatusBadge status={line.status} />}>
                  <div className="pt-line-meta">
                    <InfoRow label="Plant" value={plants.find((plant) => plant.id === line.plantId)?.name || '—'} />
                    <InfoRow label="Department" value={departments.find((department) => department.id === line.departmentId)?.name || '—'} />
                    <InfoRow label="Shift pattern" value={String(line.shiftPattern || '—').replaceAll('_', ' ')} />
                  </div>
                  <div className="pt-station-list">
                    {lineStations.map((station) => (
                      <div key={station.id} className="pt-station-row">
                        <span className="pt-station-seq pt-mono">{String(station.sequence).padStart(2, '0')}</span>
                        <div><strong>{station.name}</strong><small>{station.stationType} · {station.code}</small></div>
                        <Badge tone="neutral">{machines.filter((machine) => machine.workstationId === station.id).length} machines</Badge>
                      </div>
                    ))}
                    {!lineStations.length && <p className="pt-muted pt-small">No workstations configured on this line.</p>}
                  </div>
                  <div className="pt-link-row">
                    <button type="button" className="pt-link-btn" onClick={() => (window.location.href = '/')}>Open in 3D studio <Icon name="ArrowUpRight" size={12} /></button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {tab === 'master' && (
        <div className="pt-grid-2">
          <Card title="Machines" subtitle={`${machines.length} assets across all plants`}>
            <div className="pt-master-list">
              {machines.map((machine) => (
                <div key={machine.id} className="pt-master-row">
                  <span className="pt-master-icon"><Icon name="Settings2" size={15} /></span>
                  <div><strong>{machine.name}</strong><small><span className="pt-mono">{machine.assetTag}</span> · {machine.manufacturer} {machine.model}</small></div>
                  <div className="pt-master-tags"><StatusBadge status={machine.status} /><Badge tone={machine.criticality === 'high' ? 'red' : 'neutral'}>{machine.criticality}</Badge></div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Designations & job categories" subtitle="Used by employee profiles and approvals">
            <div className="pt-master-list">
              {workspace.data.designations.map((designation) => (
                <div key={designation.id} className="pt-master-row">
                  <span className="pt-master-icon"><Icon name="Briefcase" size={15} /></span>
                  <div><strong>{designation.title}</strong><small>{designation.level} · {workspace.data.jobCategories.find((category) => category.id === designation.jobCategoryId)?.name || '—'}</small></div>
                  <Badge tone="neutral">{employees.filter((employee) => employee.designationId === designation.id).length}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Skills catalogue" subtitle={`${workspace.data.skills.length} verified skill definitions`}>
            <div className="pt-chip-grid">
              {workspace.data.skills.map((skill) => <Badge key={skill.id} tone="blue"><Icon name="GraduationCap" size={11} /> {skill.name}</Badge>)}
            </div>
          </Card>

          <Card title="Certifications & projects" subtitle="Compliance and active programmes">
            <div className="pt-master-list">
              {workspace.data.certifications.slice(0, 4).map((certification) => (
                <div key={certification.id} className="pt-master-row">
                  <span className="pt-master-icon"><Icon name="Award" size={15} /></span>
                  <div><strong>{certification.name}</strong><small>{certification.issuingBody} · {certification.validityMonths} months validity</small></div>
                </div>
              ))}
              {workspace.data.projects.map((project) => (
                <div key={project.id} className="pt-master-row">
                  <span className="pt-master-icon"><Icon name="Layers" size={15} /></span>
                  <div><strong>{project.name}</strong><small className="pt-mono">{project.code} · due {formatDate(project.endDate)}</small><Progress value={project.progress} /></div>
                  <StatusBadge status={project.status} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Modal
        open={orgOpen}
        onClose={() => setOrgOpen(false)}
        title="Edit organization profile"
        description="This record scopes every plant, employee and policy in the platform."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOrgOpen(false)}>Cancel</Button>
            <Button icon="Save" onClick={saveOrganization} disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button>
          </>
        }
      >
        <form className="pt-form-grid" onSubmit={saveOrganization}>
          {error && <div className="pt-form-error pt-span-2"><Icon name="AlertTriangle" size={15} /> {error}</div>}
          <Field label="Organization name" required><TextInput value={orgForm.name || ''} onChange={(event) => setOrgForm({ ...orgForm, name: event.target.value })} /></Field>
          <Field label="Legal name"><TextInput value={orgForm.legalName || ''} onChange={(event) => setOrgForm({ ...orgForm, legalName: event.target.value })} /></Field>
          <Field label="Code" required><TextInput value={orgForm.code || ''} onChange={(event) => setOrgForm({ ...orgForm, code: event.target.value })} /></Field>
          <Field label="Timezone"><TextInput value={orgForm.timezone || ''} onChange={(event) => setOrgForm({ ...orgForm, timezone: event.target.value })} /></Field>
          <Field label="Support email"><TextInput type="email" value={orgForm.supportEmail || ''} onChange={(event) => setOrgForm({ ...orgForm, supportEmail: event.target.value })} /></Field>
          <Field label="Support phone"><TextInput value={orgForm.supportPhone || ''} onChange={(event) => setOrgForm({ ...orgForm, supportPhone: event.target.value })} /></Field>
          <Field label="Address" className="pt-span-2"><Textarea rows={3} value={orgForm.address || ''} onChange={(event) => setOrgForm({ ...orgForm, address: event.target.value })} /></Field>
        </form>
      </Modal>

      <Modal
        open={deptOpen}
        onClose={() => setDeptOpen(false)}
        title={editDept ? 'Edit department' : 'Add department'}
        description="Departments scope approvals, attendance visibility and employee records."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeptOpen(false)}>Cancel</Button>
            <Button icon={editDept ? 'Save' : 'Plus'} onClick={saveDepartment} disabled={busy}>{busy ? 'Saving…' : editDept ? 'Save department' : 'Create department'}</Button>
          </>
        }
      >
        <form className="pt-form-grid" onSubmit={saveDepartment}>
          {error && <div className="pt-form-error pt-span-2"><Icon name="AlertTriangle" size={15} /> {error}</div>}
          <Field label="Plant" required>
            <Select value={deptForm.plantId} onChange={(event) => setDeptForm({ ...deptForm, plantId: event.target.value })}>
              <option value="">Select a plant</option>
              {plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
            </Select>
          </Field>
          <Field label="Department name" required><TextInput value={deptForm.name} onChange={(event) => setDeptForm({ ...deptForm, name: event.target.value })} placeholder="e.g. Tooling" /></Field>
          <Field label="Code" required><TextInput value={deptForm.code} onChange={(event) => setDeptForm({ ...deptForm, code: event.target.value.toUpperCase() })} placeholder="TOOL" /></Field>
          <Field label="Cost centre"><TextInput value={deptForm.costCenter} onChange={(event) => setDeptForm({ ...deptForm, costCenter: event.target.value })} placeholder="CC-1005" /></Field>
          <Field label="Department head" className="pt-span-2">
            <Select value={deptForm.managerEmployeeId} onChange={(event) => setDeptForm({ ...deptForm, managerEmployeeId: event.target.value })}>
              <option value="">Not assigned</option>
              {managers.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.designation}</option>)}
            </Select>
          </Field>
        </form>
      </Modal>

      <Card title="Need deeper changes?" subtitle="Module boundaries">
        <p className="pt-muted">Plant creation, workstations and machine master data are managed through the versioned migrations in <code className="pt-mono">supabase/migrations</code> in this module. Department and organization profile changes are available here and go through RLS-protected writes.</p>
        <div className="pt-link-row">
          <Button variant="secondary" icon="Users" onClick={() => navigate('/admin/employees')}>Manage employees</Button>
          <Button variant="secondary" icon="ShieldCheck" onClick={() => navigate('/admin/roles')}>Roles & permissions</Button>
        </div>
      </Card>
    </div>
  );
}
