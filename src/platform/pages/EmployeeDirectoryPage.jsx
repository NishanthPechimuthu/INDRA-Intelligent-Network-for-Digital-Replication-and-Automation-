import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { scopedEmployees, shiftForEmployee } from '../data/selectors.js';
import { tasksForEmployee } from '../data/productionSelectors.js';
import { hasPermission } from '../data/accessControl.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DefinitionGrid,
  EmptyState,
  Modal,
  Select,
  StatCard,
  TextInput,
  formatDate,
} from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';

/** Workforce directory: people, shifts, competency and current workload. */
export default function EmployeeDirectoryPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const context = auth.context;
  const data = workspace.data;
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [selected, setSelected] = useState(null);

  const employees = useMemo(() => (data && context ? scopedEmployees(data, context) : []), [data, context]);
  const departments = (data?.departments || []).filter((item) => employees.some((employee) => employee.departmentId === item.id));
  const filtered = employees.filter((employee) => {
    const matchesQuery = !query
      || [employee.fullName, employee.employeeCode, employee.designation, employee.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query.toLowerCase()));
    const matchesDepartment = department === 'all' || employee.departmentId === department;
    return matchesQuery && matchesDepartment;
  });
  const canSeeSkills = hasPermission(context?.permissions, 'skills.read');

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Workforce', 'Directory']}
        eyebrow="EMPLOYEE DIRECTORY"
        title="People on the floor"
        description="Employees in your scope with their shift, competency and current workload. Medical information is never shown here."
        actions={<Button variant="secondary" icon="CalendarDays" onClick={() => navigate('/workforce/schedule')}>Shift schedule</Button>}
      />

      <section className="pt-stat-grid pt-stat-grid-4">
        <StatCard label="Employees in scope" value={employees.length} icon="Users" footnote={`${departments.length} departments`} />
        <StatCard label="Active" value={employees.filter((employee) => employee.employmentStatus === 'active').length} icon="UserCheck" tone="lime" footnote="Available for assignment" />
        <StatCard label="On leave" value={employees.filter((employee) => employee.employmentStatus === 'on_leave').length} icon="CalendarClock" tone="warn" footnote="Excluded from reassignment" />
        <StatCard label="With open work" value={employees.filter((employee) => tasksForEmployee(data, employee.id).some((task) => !['completed', 'cancelled'].includes(task.productionStatus))).length} icon="ListChecks" footnote="At least one open task" />
      </section>

      <Card
        title="Directory"
        subtitle="Search by name, code, designation or email"
        action={
          <div className="pt-filter-row">
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people…" aria-label="Search employees" />
            <Select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter by department">
              <option value="all">All departments</option>
              {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </div>
        }
      >
        {filtered.length ? (
          <div className="pt-table-scroll">
            <table className="pt-table">
              <thead>
                <tr><th>Employee</th><th>Designation</th><th>Department</th><th>Shift</th><th>Roles</th><th>Open tasks</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {filtered.map((employee) => {
                  const shift = shiftForEmployee(data, employee.id).shift;
                  const openTasks = tasksForEmployee(data, employee.id).filter((task) => !['completed', 'cancelled'].includes(task.productionStatus));
                  return (
                    <tr key={employee.id}>
                      <td>
                        <span className="pt-person">
                          <Avatar name={employee.fullName} size="xs" />
                          <span><strong>{employee.fullName}</strong><small className="pt-mono">{employee.employeeCode}</small></span>
                        </span>
                      </td>
                      <td>{employee.designation}</td>
                      <td>{employee.department}</td>
                      <td>{shift ? `${shift.code} · ${shift.startTime}–${shift.endTime}` : <span className="pt-muted">Unassigned</span>}</td>
                      <td><span className="pt-tag-row">{employee.roles?.map((role) => <Badge key={role.key} tone="blue">{role.name || role.key}</Badge>)}</span></td>
                      <td className="pt-mono">{openTasks.length}</td>
                      <td><Badge tone={employee.employmentStatus === 'active' ? 'lime' : 'amber'} dot>{String(employee.employmentStatus).replaceAll('_', ' ')}</Badge></td>
                      <td><Button size="sm" variant="ghost" onClick={() => setSelected(employee)}>View</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="Users" title="No employees match" description="Adjust the search or department filter." />
        )}
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.fullName}
        description={selected ? `${selected.designation} · ${selected.department}` : ''}
        size="lg"
        footer={<Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>}
      >
        {selected ? (
          <div className="pt-profile-modal">
            <DefinitionGrid columns={2}>
              <span><small>Employee code</small><strong className="pt-mono">{selected.employeeCode}</strong></span>
              <span><small>Work email</small><strong>{selected.email}</strong></span>
              <span><small>Plant</small><strong>{selected.plant}</strong></span>
              <span><small>Production line</small><strong>{selected.productionLine}</strong></span>
              <span><small>Reporting manager</small><strong>{selected.reportingManagerName}</strong></span>
              <span><small>Joined</small><strong>{selected.joinedOn ? formatDate(selected.joinedOn) : '—'}</strong></span>
              <span><small>Shift</small><strong>{shiftForEmployee(data, selected.id).shift?.name || 'Unassigned'}</strong></span>
              <span><small>Employment</small><strong>{String(selected.employmentStatus).replaceAll('_', ' ')}</strong></span>
            </DefinitionGrid>

            {canSeeSkills ? (
              <div className="pt-skill-block">
                <h4><Icon name="GraduationCap" size={14} /> Skills</h4>
                {selected.skills?.length ? (
                  <span className="pt-tag-row">
                    {selected.skills.map((skill) => (
                      <Badge key={skill.id} tone={skill.verified ? 'lime' : 'neutral'}>{skill.name} · {skill.proficiency || 'unrated'}</Badge>
                    ))}
                  </span>
                ) : <p className="pt-muted pt-small">No skills recorded.</p>}
                <h4><Icon name="Award" size={14} /> Certifications</h4>
                {selected.certifications?.length ? (
                  <span className="pt-tag-row">
                    {selected.certifications.map((certification) => (
                      <Badge key={certification.id} tone={certification.status === 'verified' ? 'lime' : 'amber'}>
                        {certification.name}{certification.expiresOn ? ` · expires ${formatDate(certification.expiresOn)}` : ''}
                      </Badge>
                    ))}
                  </span>
                ) : <p className="pt-muted pt-small">No certifications recorded.</p>}
              </div>
            ) : null}

            <div className="pt-skill-block">
              <h4><Icon name="ListChecks" size={14} /> Current work</h4>
              {tasksForEmployee(data, selected.id).length ? (
                <div className="pt-mini-table">
                  {tasksForEmployee(data, selected.id).map((task) => (
                    <div key={task.id} className="pt-mini-row">
                      <div><strong>{task.title}</strong><small>{task.productionStatus} · {Number(task.completedQuantity || 0)} / {Number(task.targetQuantity || 0)} pcs</small></div>
                      <Badge tone={task.productionStatus === 'completed' ? 'lime' : 'blue'}>{task.priority}</Badge>
                    </div>
                  ))}
                </div>
              ) : <p className="pt-muted pt-small">No production tasks assigned.</p>}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
