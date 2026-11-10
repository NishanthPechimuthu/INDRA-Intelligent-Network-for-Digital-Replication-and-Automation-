-- INDRA Platform Foundation · Module 01
-- 00700: access hardening found during integration testing.
--
-- 1. External customer approvers must never see internal requests.
-- 2. Request/approval state may only be mutated through the protected RPCs,
--    not by direct PostgREST writes.
-- 3. Employees may edit their own contact details but not their own scope,
--    employment status or Auth linkage.

-- ---------------------------------------------------------------------------
-- 1. Request visibility for external customer approvers
-- ---------------------------------------------------------------------------
drop policy if exists requests_select on public.requests;
create policy requests_select on public.requests
for select to authenticated
using (
  employee_id = public.current_employee_id()
  or (
    current_approver_id = public.current_employee_id()
    and (not public.has_role('customer_approver') or customer_visible)
  )
  or public.is_admin()
  or (
    public.has_permission('requests.read.all')
    and not public.has_role('customer_approver')
  )
  or (
    public.has_permission('requests.approve')
    and not public.has_role('customer_approver')
    and public.can_access_scope(organization_id, plant_id, department_id)
  )
  or (public.has_role('customer_approver') and customer_visible)
);

drop policy if exists requests_update on public.requests;
create policy requests_update on public.requests
for update to authenticated
using (
  (employee_id = public.current_employee_id() and status in ('draft', 'submitted'))
  or public.is_admin()
)
with check (
  (employee_id = public.current_employee_id() and status in ('draft', 'submitted', 'cancelled'))
  or public.is_admin()
);

-- Requests and approvals are created/decided exclusively by
-- submit_request() and decide_approval(); both are security-definer RPCs.
revoke insert, update, delete on public.requests from authenticated;
revoke insert, update, delete on public.approvals from authenticated;

-- ---------------------------------------------------------------------------
-- 2. Customer approvers cannot inspect the internal authority matrix
-- ---------------------------------------------------------------------------
drop policy if exists approval_authorities_select on public.approval_authorities;
create policy approval_authorities_select on public.approval_authorities
for select to authenticated
using (
  public.can_access_scope(organization_id, null, null)
  and (not public.has_role('customer_approver') or public.is_admin())
);

-- ---------------------------------------------------------------------------
-- 3. Self-service profile guard
-- ---------------------------------------------------------------------------
create or replace function public.guard_employee_self_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Service-role/seed writes and managers with employees.manage keep full access.
  if auth.uid() is null
     or public.is_admin()
     or public.has_permission('employees.manage')
     or old.user_id is distinct from auth.uid() then
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id
     or new.user_id is distinct from old.user_id
     or new.employee_code is distinct from old.employee_code
     or new.plant_id is distinct from old.plant_id
     or new.department_id is distinct from old.department_id
     or new.production_line_id is distinct from old.production_line_id
     or new.designation_id is distinct from old.designation_id
     or new.job_category_id is distinct from old.job_category_id
     or new.reporting_manager_id is distinct from old.reporting_manager_id
     or new.employment_status is distinct from old.employment_status
     or new.employment_type is distinct from old.employment_type
     or new.work_mode is distinct from old.work_mode
     or new.joined_on is distinct from old.joined_on
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'You may only update your own contact details.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists employees_guard_self_update on public.employees;
create trigger employees_guard_self_update
before update on public.employees
for each row execute function public.guard_employee_self_update();
