-- INDRA Platform Foundation · Module 02
-- 00900: row level security for workforce and production operations.
--
-- Every policy is expressed in terms of the Module 01 helpers:
--   current_org_id(), current_employee_id(), has_permission(), has_role(),
--   can_access_scope(org, plant, department), can_access_employee(employee_id).
-- The browser duplicate of these rules only drives navigation; these policies are
-- the authoritative authorization for every read and write.

-- ---------------------------------------------------------------------------
-- Team helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_manager_of(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.employees target
    join public.employees me on me.id = public.current_employee_id()
    where target.id = p_employee_id
      and target.deleted_at is null
      and target.organization_id = me.organization_id
      and (
        target.reporting_manager_id = me.id
        or (public.has_permission('employees.read.all') and target.plant_id is not distinct from me.plant_id)
      )
  );
$$;

create or replace function public.can_access_team(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p_employee_id = public.current_employee_id()
    or public.is_admin()
    or (public.has_permission('workforce.team.read') and public.is_manager_of(p_employee_id));
$$;

grant execute on function public.is_manager_of(uuid) to authenticated;
grant execute on function public.can_access_team(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Assignment integrity: operators may execute a task but never reassign one.
-- ---------------------------------------------------------------------------
create or replace function public.guard_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if public.is_admin() or public.has_permission('tasks.manage') then
    return new;
  end if;

  if new.assignee_employee_id is distinct from old.assignee_employee_id
     or new.workstation_id is distinct from old.workstation_id
     or new.machine_id is distinct from old.machine_id
     or new.supervisor_employee_id is distinct from old.supervisor_employee_id
     or new.production_order_id is distinct from old.production_order_id
     or new.target_quantity is distinct from old.target_quantity
     or new.title is distinct from old.title
     or new.planned_start_at is distinct from old.planned_start_at then
    raise exception 'Task assignment can only be changed by a supervisor' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger tasks_guard_assignment
before update on public.tasks
for each row execute function public.guard_task_assignment();

-- ---------------------------------------------------------------------------
-- Master data
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.materials enable row level security;
alter table public.tools enable row level security;
alter table public.production_orders enable row level security;
alter table public.task_events enable row level security;
alter table public.production_reports enable row level security;
alter table public.production_report_materials enable row level security;
alter table public.technical_issues enable row level security;
alter table public.tool_damage_reports enable row level security;
alter table public.safety_incidents enable row level security;
alter table public.safety_incident_details enable row level security;
alter table public.shift_reports enable row level security;
alter table public.shift_report_tasks enable row level security;
alter table public.material_requests enable row level security;
alter table public.reassignment_requests enable row level security;
alter table public.machine_programs enable row level security;
alter table public.machine_program_versions enable row level security;
alter table public.employee_machine_authorizations enable row level security;

create policy products_select on public.products
for select to authenticated
using (organization_id = public.current_org_id() and public.has_permission('production.orders.read') and deleted_at is null);
create policy products_write on public.products
for all to authenticated
using (organization_id = public.current_org_id() and public.has_permission('production.orders.manage'))
with check (organization_id = public.current_org_id() and public.has_permission('production.orders.manage'));

create policy materials_select on public.materials
for select to authenticated
using (organization_id = public.current_org_id() and (public.has_permission('materials.read') or public.has_permission('production.reports.create')) and deleted_at is null);
create policy materials_write on public.materials
for all to authenticated
using (organization_id = public.current_org_id() and public.has_permission('materials.manage'))
with check (organization_id = public.current_org_id() and public.has_permission('materials.manage'));

create policy tools_select on public.tools
for select to authenticated
using (organization_id = public.current_org_id() and (public.has_permission('tools.read') or public.has_permission('production.issues.create')) and deleted_at is null);
create policy tools_write on public.tools
for all to authenticated
using (organization_id = public.current_org_id() and public.has_permission('tools.manage'))
with check (organization_id = public.current_org_id() and public.has_permission('tools.manage'));

-- ---------------------------------------------------------------------------
-- Production orders
-- ---------------------------------------------------------------------------
create policy production_orders_select on public.production_orders
for select to authenticated
using (
  organization_id = public.current_org_id()
  and deleted_at is null
  and public.can_access_scope(organization_id, plant_id, department_id)
  and (public.has_permission('production.orders.read') or public.has_permission('tasks.read.self'))
);
create policy production_orders_insert on public.production_orders
for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and public.has_permission('production.orders.manage')
  and public.can_access_scope(organization_id, plant_id, department_id)
);
create policy production_orders_update on public.production_orders
for update to authenticated
using (organization_id = public.current_org_id() and public.has_permission('production.orders.manage') and public.can_access_scope(organization_id, plant_id, department_id))
with check (organization_id = public.current_org_id());
create policy production_orders_delete on public.production_orders
for delete to authenticated
using (public.has_permission('production.orders.manage') and public.is_admin());

-- Tasks: extend the Module 01 read model so supervisors see the production
-- tasks they control even when the assignee is not their direct report.
create policy tasks_production_select on public.tasks
for select to authenticated
using (
  production_order_id is not null
  and organization_id = public.current_org_id()
  and (
    assignee_employee_id = public.current_employee_id()
    or supervisor_employee_id = public.current_employee_id()
    or (public.has_permission('tasks.read.all') and public.can_access_scope(organization_id, null, null))
  )
);

create policy task_events_select on public.task_events
for select to authenticated
using (
  organization_id = public.current_org_id()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (
        t.assignee_employee_id = public.current_employee_id()
        or t.supervisor_employee_id = public.current_employee_id()
        or (public.has_permission('tasks.read.all') and public.can_access_scope(t.organization_id, null, null))
      )
  )
);
-- Events are written by the protected task RPCs, never directly by the client.
create policy task_events_insert on public.task_events
for insert to authenticated
with check (organization_id = public.current_org_id() and employee_id = public.current_employee_id());

-- ---------------------------------------------------------------------------
-- Production reports
-- ---------------------------------------------------------------------------
create policy production_reports_select on public.production_reports
for select to authenticated
using (
  organization_id = public.current_org_id()
  and deleted_at is null
  and (
    reported_by_employee_id = public.current_employee_id()
    or (public.has_permission('production.reports.read') and public.can_access_scope(organization_id, null, null))
    or (public.has_permission('workforce.team.read') and public.is_manager_of(reported_by_employee_id))
  )
);
create policy production_reports_insert on public.production_reports
for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and reported_by_employee_id = public.current_employee_id()
  and public.has_permission('production.reports.create')
  and exists (
    select 1 from public.production_orders po
    where po.id = production_order_id
      and po.organization_id = public.current_org_id()
  )
);
create policy production_reports_update on public.production_reports
for update to authenticated
using (
  organization_id = public.current_org_id()
  and (
    (reported_by_employee_id = public.current_employee_id() and public.has_permission('production.reports.create'))
    or public.has_permission('production.reports.manage')
  )
)
with check (organization_id = public.current_org_id());
create policy production_reports_delete on public.production_reports
for delete to authenticated
using (public.has_permission('production.reports.manage') and public.is_admin());

create policy production_report_materials_select on public.production_report_materials
for select to authenticated
using (
  exists (
    select 1 from public.production_reports r
    where r.id = report_id
      and (
        r.reported_by_employee_id = public.current_employee_id()
        or public.has_permission('production.reports.read')
      )
  )
);
create policy production_report_materials_write on public.production_report_materials
for all to authenticated
using (
  organization_id = public.current_org_id()
  and exists (
    select 1 from public.production_reports r
    where r.id = report_id
      and r.reported_by_employee_id = public.current_employee_id()
  )
)
with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- Issues
-- ---------------------------------------------------------------------------
create policy technical_issues_select on public.technical_issues
for select to authenticated
using (
  organization_id = public.current_org_id()
  and deleted_at is null
  and (
    reported_by_employee_id = public.current_employee_id()
    or assigned_to_employee_id = public.current_employee_id()
    or (public.has_permission('production.issues.read') and public.can_access_scope(organization_id, plant_id, department_id))
  )
);
create policy technical_issues_insert on public.technical_issues
for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and reported_by_employee_id = public.current_employee_id()
  and public.has_permission('production.issues.create')
);
create policy technical_issues_update on public.technical_issues
for update to authenticated
using (
  organization_id = public.current_org_id()
  and (
    assigned_to_employee_id = public.current_employee_id()
    or public.has_permission('production.issues.manage')
  )
)
with check (organization_id = public.current_org_id());

create policy tool_damage_reports_select on public.tool_damage_reports
for select to authenticated
using (
  organization_id = public.current_org_id()
  and deleted_at is null
  and (
    reported_by_employee_id = public.current_employee_id()
    or (public.has_permission('production.issues.read') and public.can_access_scope(organization_id, null, null))
  )
);
create policy tool_damage_reports_insert on public.tool_damage_reports
for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and reported_by_employee_id = public.current_employee_id()
  and public.has_permission('production.issues.create')
);
create policy tool_damage_reports_update on public.tool_damage_reports
for update to authenticated
using (organization_id = public.current_org_id() and public.has_permission('production.issues.manage'))
with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- Safety: operational facts and restricted clinical detail are separated.
-- ---------------------------------------------------------------------------
create policy safety_incidents_select on public.safety_incidents
for select to authenticated
using (
  organization_id = public.current_org_id()
  and deleted_at is null
  and (
    reported_by_employee_id = public.current_employee_id()
    or affected_employee_id = public.current_employee_id()
    or (
      public.has_permission('safety.operational.read')
      and public.can_access_scope(organization_id, plant_id, department_id)
    )
    or public.has_permission('safety.medical.read')
  )
);
create policy safety_incidents_insert on public.safety_incidents
for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and reported_by_employee_id = public.current_employee_id()
  and public.has_permission('safety.report')
);
-- Supervisors may progress the operational record, never reopen clinical detail.
create policy safety_incidents_update on public.safety_incidents
for update to authenticated
using (
  organization_id = public.current_org_id()
  and (
    reported_by_employee_id = public.current_employee_id()
    or public.has_permission('safety.operational.read')
  )
)
with check (organization_id = public.current_org_id());

-- Clinical detail is withheld from supervisors by policy, not by the interface.
create policy safety_incident_details_select on public.safety_incident_details
for select to authenticated
using (
  organization_id = public.current_org_id()
  and public.has_permission('safety.medical.read')
  and exists (
    select 1 from public.safety_incidents i
    where i.id = incident_id
      and public.can_access_scope(i.organization_id, i.plant_id, i.department_id)
  )
);
create policy safety_incident_details_write on public.safety_incident_details
for all to authenticated
using (organization_id = public.current_org_id() and public.has_permission('safety.medical.read'))
with check (organization_id = public.current_org_id() and public.has_permission('safety.medical.read'));

-- ---------------------------------------------------------------------------
-- Shift completion and handover
-- ---------------------------------------------------------------------------
create policy shift_reports_select on public.shift_reports
for select to authenticated
using (
  organization_id = public.current_org_id()
  and deleted_at is null
  and (
    employee_id = public.current_employee_id()
    or (public.has_permission('handover.read') and public.can_access_scope(organization_id, null, null))
    or (public.has_permission('workforce.team.read') and public.is_manager_of(employee_id))
  )
);
create policy shift_reports_insert on public.shift_reports
for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and employee_id = public.current_employee_id()
  and public.has_permission('handover.submit')
);
create policy shift_reports_update on public.shift_reports
for update to authenticated
using (
  organization_id = public.current_org_id()
  and (
    (employee_id = public.current_employee_id() and status = 'submitted')
    or public.has_permission('handover.read')
  )
)
with check (organization_id = public.current_org_id());

create policy shift_report_tasks_select on public.shift_report_tasks
for select to authenticated
using (exists (select 1 from public.shift_reports r where r.id = report_id));
create policy shift_report_tasks_write on public.shift_report_tasks
for all to authenticated
using (exists (select 1 from public.shift_reports r where r.id = report_id and r.employee_id = public.current_employee_id()))
with check (exists (select 1 from public.shift_reports r where r.id = report_id and r.employee_id = public.current_employee_id()));

-- ---------------------------------------------------------------------------
-- Shared workflow detail tables
-- ---------------------------------------------------------------------------
create policy material_requests_select on public.material_requests
for select to authenticated
using (exists (select 1 from public.requests r where r.id = request_id));
create policy material_requests_insert on public.material_requests
for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and exists (
    select 1 from public.requests r
    where r.id = request_id and r.employee_id = public.current_employee_id()
  )
);

create policy reassignment_requests_select on public.reassignment_requests
for select to authenticated
using (
  organization_id = public.current_org_id()
  and (
    employee_id = public.current_employee_id()
    or public.has_permission('reassignment.approve')
    or public.has_permission('workforce.team.read')
  )
);
create policy reassignment_requests_insert on public.reassignment_requests
for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and public.has_permission('reassignment.create')
  and exists (
    select 1 from public.requests r
    where r.id = request_id and r.employee_id = public.current_employee_id()
  )
);
create policy reassignment_requests_update on public.reassignment_requests
for update to authenticated
using (organization_id = public.current_org_id() and public.has_permission('reassignment.approve'))
with check (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- Machine programs
-- ---------------------------------------------------------------------------
create policy machine_programs_select on public.machine_programs
for select to authenticated
using (
  organization_id = public.current_org_id()
  and deleted_at is null
  and public.has_permission('programs.read')
);
create policy machine_programs_insert on public.machine_programs
for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and public.has_permission('programs.manage')
  and exists (select 1 from public.machines m where m.id = machine_id and public.can_access_scope(m.organization_id, m.plant_id, m.department_id))
);
create policy machine_programs_update on public.machine_programs
for update to authenticated
using (
  organization_id = public.current_org_id()
  and (public.has_permission('programs.manage') or public.has_permission('programs.approve'))
)
with check (organization_id = public.current_org_id());

create policy machine_program_versions_select on public.machine_program_versions
for select to authenticated
using (
  organization_id = public.current_org_id()
  and public.has_permission('programs.read')
  and exists (select 1 from public.machine_programs p where p.id = program_id and p.deleted_at is null)
);
create policy machine_program_versions_insert on public.machine_program_versions
for insert to authenticated
with check (
  organization_id = public.current_org_id()
  and public.has_permission('programs.manage')
  and created_by_employee_id = public.current_employee_id()
  and exists (select 1 from public.machine_programs p where p.id = program_id)
);
create policy machine_program_versions_update on public.machine_program_versions
for update to authenticated
using (
  organization_id = public.current_org_id()
  and (
    (created_by_employee_id = public.current_employee_id() and status in ('draft', 'rejected', 'in_review'))
    or public.has_permission('programs.approve')
  )
)
with check (organization_id = public.current_org_id());

create policy employee_machine_authorizations_select on public.employee_machine_authorizations
for select to authenticated
using (
  organization_id = public.current_org_id()
  and (employee_id = public.current_employee_id() or public.has_permission('employees.read') or public.has_permission('reassignment.approve'))
);
create policy employee_machine_authorizations_write on public.employee_machine_authorizations
for all to authenticated
using (organization_id = public.current_org_id() and public.has_permission('employees.manage'))
with check (organization_id = public.current_org_id() and public.has_permission('employees.manage'));
