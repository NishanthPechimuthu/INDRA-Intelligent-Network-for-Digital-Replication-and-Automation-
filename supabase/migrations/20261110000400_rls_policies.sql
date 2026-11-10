-- 00400: Row Level Security. The database is the authorization boundary; the
-- browser never receives rows outside the caller's organization and scope.

alter table public.organizations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.job_categories enable row level security;
alter table public.designations enable row level security;
alter table public.plants enable row level security;
alter table public.departments enable row level security;
alter table public.production_lines enable row level security;
alter table public.workstations enable row level security;
alter table public.machines enable row level security;
alter table public.employees enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.skills enable row level security;
alter table public.certifications enable row level security;
alter table public.employee_skills enable row level security;
alter table public.employee_certifications enable row level security;
alter table public.projects enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_breaks enable row level security;
alter table public.employee_shift_assignments enable row level security;
alter table public.attendance_records enable row level security;
alter table public.holidays enable row level security;
alter table public.leave_records enable row level security;
alter table public.notifications enable row level security;
alter table public.tasks enable row level security;
alter table public.requests enable row level security;
alter table public.approvals enable row level security;
alter table public.approval_authorities enable row level security;
alter table public.invitations enable row level security;
alter table public.documents enable row level security;
alter table public.employee_medical enable row level security;
alter table public.audit_logs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;
revoke insert, update, delete on public.user_roles from authenticated;
revoke insert, update, delete on public.role_permissions from authenticated;

-- ---------------------------------------------------------------------------
-- Organization and master structure
-- ---------------------------------------------------------------------------
create policy organizations_select on public.organizations
for select to authenticated
using (id = public.current_org_id());

create policy organizations_update on public.organizations
for update to authenticated
using (id = public.current_org_id() and public.has_permission('organization.manage'))
with check (id = public.current_org_id());

create policy organizations_insert on public.organizations
for insert to authenticated
with check (public.is_admin());

create policy user_profiles_select on public.user_profiles
for select to authenticated
using (id = auth.uid() or public.is_admin() or public.has_permission('employees.read.all'));

create policy user_profiles_update on public.user_profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy user_profiles_insert on public.user_profiles
for insert to authenticated
with check (id = auth.uid() or public.is_admin());

create policy job_categories_select on public.job_categories
for select to authenticated
using (public.has_permission('job_categories.read') and public.can_access_scope(organization_id, null, null));
create policy job_categories_write on public.job_categories
for all to authenticated
using (public.has_permission('job_categories.manage') and public.can_access_scope(organization_id, null, null))
with check (public.has_permission('job_categories.manage') and public.can_access_scope(organization_id, null, null));

create policy designations_select on public.designations
for select to authenticated
using (public.has_permission('designations.read') and public.can_access_scope(organization_id, null, null));
create policy designations_write on public.designations
for all to authenticated
using (public.has_permission('designations.manage') and public.can_access_scope(organization_id, null, null))
with check (public.has_permission('designations.manage') and public.can_access_scope(organization_id, null, null));

create policy plants_select on public.plants
for select to authenticated
using (public.has_permission('plants.read') and public.can_access_scope(organization_id, id, null));
create policy plants_write on public.plants
for all to authenticated
using (public.has_permission('plants.manage') and public.can_access_scope(organization_id, id, null))
with check (public.has_permission('plants.manage') and public.can_access_scope(organization_id, id, null));

create policy departments_select on public.departments
for select to authenticated
using (public.has_permission('departments.read') and public.can_access_scope(organization_id, plant_id, id));
create policy departments_write on public.departments
for all to authenticated
using (public.has_permission('departments.manage') and public.can_access_scope(organization_id, plant_id, id))
with check (public.has_permission('departments.manage') and public.can_access_scope(organization_id, plant_id, id));

create policy production_lines_select on public.production_lines
for select to authenticated
using (public.has_permission('production_lines.read') and public.can_access_scope(organization_id, plant_id, department_id));
create policy production_lines_write on public.production_lines
for all to authenticated
using (public.has_permission('production_lines.manage') and public.can_access_scope(organization_id, plant_id, department_id))
with check (public.has_permission('production_lines.manage') and public.can_access_scope(organization_id, plant_id, department_id));

create policy workstations_select on public.workstations
for select to authenticated
using (public.has_permission('workstations.read') and public.can_access_scope(organization_id, plant_id, department_id));
create policy workstations_write on public.workstations
for all to authenticated
using (public.has_permission('workstations.manage') and public.can_access_scope(organization_id, plant_id, department_id))
with check (public.has_permission('workstations.manage') and public.can_access_scope(organization_id, plant_id, department_id));

create policy machines_select on public.machines
for select to authenticated
using (public.has_permission('machines.read') and public.can_access_scope(organization_id, plant_id, department_id));
create policy machines_write on public.machines
for all to authenticated
using (public.has_permission('machines.manage') and public.can_access_scope(organization_id, plant_id, department_id))
with check (public.has_permission('machines.manage') and public.can_access_scope(organization_id, plant_id, department_id));

-- ---------------------------------------------------------------------------
-- Employees and their restricted profile data
-- ---------------------------------------------------------------------------
create policy employees_select on public.employees
for select to authenticated
using (public.can_access_employee(id));

create policy employees_insert on public.employees
for insert to authenticated
with check (
  public.has_permission('employees.manage')
  and public.can_access_scope(organization_id, plant_id, department_id)
);

create policy employees_update on public.employees
for update to authenticated
using (
  id = public.current_employee_id()
  or (public.has_permission('employees.manage') and public.can_access_employee(id))
)
with check (
  id = public.current_employee_id()
  or (public.has_permission('employees.manage') and public.can_access_scope(organization_id, plant_id, department_id))
);

create policy employees_delete on public.employees
for delete to authenticated
using (public.has_permission('employees.manage') and public.can_access_employee(id));

create policy employee_medical_select on public.employee_medical
for select to authenticated
using (
  employee_id = public.current_employee_id()
  or public.has_permission('employees.medical.read')
);

create policy employee_medical_write on public.employee_medical
for all to authenticated
using (public.has_permission('employees.medical.read') and public.can_access_employee(employee_id))
with check (public.has_permission('employees.medical.read') and public.can_access_employee(employee_id));

-- ---------------------------------------------------------------------------
-- Roles, permissions and assignments
-- ---------------------------------------------------------------------------
create policy roles_select on public.roles
for select to authenticated
using (
  public.can_access_scope(organization_id, null, null)
  and (
    public.has_permission('roles.read')
    or exists (
      select 1 from public.user_roles ur
      where ur.role_id = roles.id
        and ur.employee_id = public.current_employee_id()
    )
  )
);

create policy roles_write on public.roles
for all to authenticated
using (public.has_permission('roles.manage') and public.can_access_scope(organization_id, null, null))
with check (public.has_permission('roles.manage') and public.can_access_scope(organization_id, null, null));

create policy permissions_select on public.permissions
for select to authenticated
using (true);

create policy role_permissions_select on public.role_permissions
for select to authenticated
using (
  public.has_permission('roles.read')
  or exists (
    select 1 from public.user_roles ur
    where ur.role_id = role_permissions.role_id
      and ur.employee_id = public.current_employee_id()
  )
);

create policy user_roles_select on public.user_roles
for select to authenticated
using (
  employee_id = public.current_employee_id()
  or public.has_permission('roles.read')
  or public.is_admin()
);

-- ---------------------------------------------------------------------------
-- Skills, certifications and projects
-- ---------------------------------------------------------------------------
create policy skills_select on public.skills
for select to authenticated
using (public.has_permission('skills.read') and public.can_access_scope(organization_id, null, null));
create policy skills_write on public.skills
for all to authenticated
using (public.has_permission('skills.manage') and public.can_access_scope(organization_id, null, null))
with check (public.has_permission('skills.manage') and public.can_access_scope(organization_id, null, null));

create policy certifications_select on public.certifications
for select to authenticated
using (public.has_permission('certifications.read') and public.can_access_scope(organization_id, null, null));
create policy certifications_write on public.certifications
for all to authenticated
using (public.has_permission('certifications.manage') and public.can_access_scope(organization_id, null, null))
with check (public.has_permission('certifications.manage') and public.can_access_scope(organization_id, null, null));

create policy employee_skills_select on public.employee_skills
for select to authenticated
using (public.has_permission('skills.read') and public.can_access_employee(employee_id));
create policy employee_skills_write on public.employee_skills
for all to authenticated
using (public.has_permission('skills.manage') and public.can_access_employee(employee_id))
with check (public.has_permission('skills.manage') and public.can_access_employee(employee_id));

create policy employee_certifications_select on public.employee_certifications
for select to authenticated
using (public.has_permission('certifications.read') and public.can_access_employee(employee_id));
create policy employee_certifications_write on public.employee_certifications
for all to authenticated
using (public.has_permission('certifications.manage') and public.can_access_employee(employee_id))
with check (public.has_permission('certifications.manage') and public.can_access_employee(employee_id));

create policy projects_select on public.projects
for select to authenticated
using (public.has_permission('projects.read') and public.can_access_scope(organization_id, plant_id, department_id));
create policy projects_write on public.projects
for all to authenticated
using (public.has_permission('projects.manage') and public.can_access_scope(organization_id, plant_id, department_id))
with check (public.has_permission('projects.manage') and public.can_access_scope(organization_id, plant_id, department_id));

-- ---------------------------------------------------------------------------
-- Shifts, schedules, attendance and leave
-- ---------------------------------------------------------------------------
create policy shifts_select on public.shifts
for select to authenticated
using (
  public.has_permission('shifts.read')
  and (
    exists (
      select 1 from public.employee_shift_assignments a
      where a.shift_id = shifts.id
        and a.employee_id = public.current_employee_id()
    )
    or public.can_access_scope(organization_id, plant_id, department_id)
  )
);

create policy shifts_insert on public.shifts
for insert to authenticated
with check (public.has_permission('shifts.manage') and public.can_access_scope(organization_id, plant_id, department_id));
create policy shifts_update on public.shifts
for update to authenticated
using (public.has_permission('shifts.manage') and public.can_access_scope(organization_id, plant_id, department_id))
with check (public.has_permission('shifts.manage') and public.can_access_scope(organization_id, plant_id, department_id));
create policy shifts_delete on public.shifts
for delete to authenticated
using (public.has_permission('shifts.manage') and public.can_access_scope(organization_id, plant_id, department_id));

create policy shift_breaks_select on public.shift_breaks
for select to authenticated
using (public.has_permission('shifts.read') and exists (select 1 from public.shifts s where s.id = shift_id));
create policy shift_breaks_write on public.shift_breaks
for all to authenticated
using (public.has_permission('shifts.manage') and exists (select 1 from public.shifts s where s.id = shift_id))
with check (public.has_permission('shifts.manage') and exists (select 1 from public.shifts s where s.id = shift_id));

create policy shift_assignments_select on public.employee_shift_assignments
for select to authenticated
using (
  employee_id = public.current_employee_id()
  or (public.has_permission('shifts.read') and public.can_access_employee(employee_id))
);
create policy shift_assignments_write on public.employee_shift_assignments
for all to authenticated
using (public.has_permission('shifts.assign') and public.can_access_employee(employee_id))
with check (public.has_permission('shifts.assign') and public.can_access_employee(employee_id));

create policy attendance_select on public.attendance_records
for select to authenticated
using (
  employee_id = public.current_employee_id()
  or public.is_admin()
  or (public.has_permission('attendance.read.all') and public.can_access_employee(employee_id))
);
create policy attendance_write on public.attendance_records
for all to authenticated
using (public.has_permission('attendance.manage') and public.can_access_employee(employee_id))
with check (public.has_permission('attendance.manage') and public.can_access_employee(employee_id));

create policy holidays_select on public.holidays
for select to authenticated
using (public.can_access_scope(organization_id, plant_id, null));
create policy holidays_write on public.holidays
for all to authenticated
using (public.has_permission('shifts.manage') and public.can_access_scope(organization_id, plant_id, null))
with check (public.has_permission('shifts.manage') and public.can_access_scope(organization_id, plant_id, null));

create policy leave_select on public.leave_records
for select to authenticated
using (
  employee_id = public.current_employee_id()
  or (public.has_permission('leave.read') and public.can_access_employee(employee_id))
  or public.is_admin()
);
create policy leave_insert on public.leave_records
for insert to authenticated
with check (
  employee_id = public.current_employee_id()
  or (public.has_permission('employees.manage') and public.can_access_employee(employee_id))
);
create policy leave_update on public.leave_records
for update to authenticated
using (
  (employee_id = public.current_employee_id() and status in ('draft', 'submitted'))
  or (public.has_permission('leave.approve') and public.can_access_employee(employee_id))
  or public.is_admin()
)
with check (
  employee_id = public.current_employee_id()
  or public.can_access_employee(employee_id)
);

-- ---------------------------------------------------------------------------
-- Notifications and tasks
-- ---------------------------------------------------------------------------
create policy notifications_select on public.notifications
for select to authenticated
using (recipient_employee_id = public.current_employee_id() or public.is_admin());
create policy notifications_update on public.notifications
for update to authenticated
using (recipient_employee_id = public.current_employee_id() or public.has_permission('notifications.manage'))
with check (recipient_employee_id = public.current_employee_id() or public.has_permission('notifications.manage'));
create policy notifications_insert on public.notifications
for insert to authenticated
with check (public.has_permission('notifications.manage'));

create policy tasks_select on public.tasks
for select to authenticated
using (
  assignee_employee_id = public.current_employee_id()
  or public.is_admin()
  or (public.has_permission('tasks.read.all') and public.can_access_scope(organization_id, null, null))
);
create policy tasks_insert on public.tasks
for insert to authenticated
with check (public.has_permission('tasks.manage') and public.can_access_scope(organization_id, null, null));
create policy tasks_update on public.tasks
for update to authenticated
using (
  assignee_employee_id = public.current_employee_id()
  or (public.has_permission('tasks.manage') and public.can_access_scope(organization_id, null, null))
)
with check (public.can_access_scope(organization_id, null, null));
create policy tasks_delete on public.tasks
for delete to authenticated
using (public.has_permission('tasks.manage') and public.can_access_scope(organization_id, null, null));

-- ---------------------------------------------------------------------------
-- Requests, approvals and authority configuration
-- ---------------------------------------------------------------------------
create policy requests_select on public.requests
for select to authenticated
using (
  employee_id = public.current_employee_id()
  or current_approver_id = public.current_employee_id()
  or public.is_admin()
  or public.has_permission('requests.read.all')
  or (public.has_permission('requests.approve') and public.can_access_scope(organization_id, plant_id, department_id))
  or (public.has_role('customer_approver') and customer_visible)
);
create policy requests_insert on public.requests
for insert to authenticated
with check (employee_id = public.current_employee_id() and public.has_permission('requests.create'));
create policy requests_update on public.requests
for update to authenticated
using (
  (employee_id = public.current_employee_id() and status in ('draft', 'submitted'))
  or current_approver_id = public.current_employee_id()
  or public.is_admin()
)
with check (public.can_access_scope(organization_id, plant_id, department_id) or public.has_permission('requests.approve'));
create policy requests_delete on public.requests
for delete to authenticated
using (employee_id = public.current_employee_id() and status = 'draft');

create policy approvals_select on public.approvals
for select to authenticated
using (
  approver_employee_id = public.current_employee_id()
  or public.is_admin()
  or exists (select 1 from public.requests r where r.id = request_id)
);
create policy approvals_update on public.approvals
for update to authenticated
using (approver_employee_id = public.current_employee_id() or public.is_admin())
with check (approver_employee_id = public.current_employee_id() or public.is_admin());

create policy approval_authorities_select on public.approval_authorities
for select to authenticated
using (public.can_access_scope(organization_id, null, null));
create policy approval_authorities_write on public.approval_authorities
for all to authenticated
using (public.has_permission('approval_authorities.manage') and public.can_access_scope(organization_id, null, null))
with check (public.has_permission('approval_authorities.manage') and public.can_access_scope(organization_id, null, null));

-- ---------------------------------------------------------------------------
-- Invitations, documents and audit
-- ---------------------------------------------------------------------------
create policy invitations_select on public.invitations
for select to authenticated
using (
  (public.has_permission('employees.manage') or public.has_permission('roles.manage'))
  and public.can_access_scope(organization_id, plant_id, department_id)
);
create policy invitations_insert on public.invitations
for insert to authenticated
with check (
  (public.has_permission('employees.manage') or public.has_permission('roles.manage'))
  and public.can_access_scope(organization_id, plant_id, department_id)
);
create policy invitations_update on public.invitations
for update to authenticated
using (
  (public.has_permission('employees.manage') or public.has_permission('roles.manage'))
  and public.can_access_scope(organization_id, plant_id, department_id)
)
with check (
  (public.has_permission('employees.manage') or public.has_permission('roles.manage'))
  and public.can_access_scope(organization_id, plant_id, department_id)
);

create policy documents_select on public.documents
for select to authenticated
using (
  deleted_at is null
  and (
    owner_employee_id = public.current_employee_id()
    or public.is_admin()
    or (public.has_permission('documents.read') and public.can_access_employee(owner_employee_id))
  )
);
create policy documents_insert on public.documents
for insert to authenticated
with check (
  public.has_permission('documents.upload')
  and (owner_employee_id = public.current_employee_id() or public.has_permission('employees.manage'))
);
create policy documents_update on public.documents
for update to authenticated
using (owner_employee_id = public.current_employee_id() or public.is_admin())
with check (owner_employee_id = public.current_employee_id() or public.is_admin());
create policy documents_delete on public.documents
for delete to authenticated
using (public.has_permission('documents.delete') and public.can_access_employee(owner_employee_id));

create policy audit_logs_select on public.audit_logs
for select to authenticated
using (public.has_permission('audit.read') and organization_id = public.current_org_id());
