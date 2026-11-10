-- 00200: RBAC, workforce skills, shifts, attendance and leave.

-- ---------------------------------------------------------------------------
-- Roles and permissions
-- ---------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  name text not null,
  level integer not null default 10,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, key)
);

create trigger roles_set_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create table public.permissions (
  key text primary key,
  module text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  assigned_by uuid references public.employees (id) on delete set null,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (employee_id, role_id)
);

create index user_roles_employee_idx on public.user_roles (employee_id);
create index user_roles_role_idx on public.user_roles (role_id);
create index roles_org_idx on public.roles (organization_id) where deleted_at is null;
create index role_permissions_permission_idx on public.role_permissions (permission_key);

-- ---------------------------------------------------------------------------
-- Skills, certifications and projects
-- ---------------------------------------------------------------------------
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  category text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, name)
);

create trigger skills_set_updated_at
before update on public.skills
for each row execute function public.set_updated_at();

create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  issuing_body text,
  validity_months integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, name)
);

create trigger certifications_set_updated_at
before update on public.certifications
for each row execute function public.set_updated_at();

create table public.employee_skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  proficiency smallint not null default 1 check (proficiency between 1 and 5),
  verified boolean not null default false,
  verified_by uuid references public.employees (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, skill_id)
);

create trigger employee_skills_set_updated_at
before update on public.employee_skills
for each row execute function public.set_updated_at();

create table public.employee_certifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  certification_id uuid not null references public.certifications (id) on delete cascade,
  issued_on date,
  expires_on date,
  status public.certification_status not null default 'pending',
  evidence_document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, certification_id, issued_on)
);

create trigger employee_certifications_set_updated_at
before update on public.employee_certifications
for each row execute function public.set_updated_at();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plant_id uuid references public.plants (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  code text not null,
  name text not null,
  description text,
  status text not null default 'active',
  manager_employee_id uuid references public.employees (id) on delete set null,
  start_date date,
  end_date date,
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, code)
);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Shift configuration
-- ---------------------------------------------------------------------------
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  plant_id uuid references public.plants (id) on delete cascade,
  department_id uuid references public.departments (id) on delete cascade,
  code text not null,
  name text not null,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Asia/Kolkata',
  lunch_start time,
  lunch_end time,
  grace_minutes integer not null default 0 check (grace_minutes between 0 and 240),
  overtime_policy public.overtime_policy not null default 'none',
  overtime_multiplier numeric(4, 2) not null default 1.00 check (overtime_multiplier >= 1),
  weekly_working_days smallint[] not null default '{1,2,3,4,5}',
  effective_from date not null default current_date,
  effective_to date,
  is_active boolean not null default true,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, code),
  constraint shifts_effective_range check (effective_to is null or effective_to >= effective_from)
);

create trigger shifts_set_updated_at
before update on public.shifts
for each row execute function public.set_updated_at();

create table public.shift_breaks (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  is_paid boolean not null default true,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shift_breaks_set_updated_at
before update on public.shift_breaks
for each row execute function public.set_updated_at();

create table public.employee_shift_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  effective_from date not null default current_date,
  effective_to date,
  status text not null default 'active',
  assigned_by uuid references public.employees (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignment_effective_range check (effective_to is null or effective_to >= effective_from)
);

create trigger employee_shift_assignments_set_updated_at
before update on public.employee_shift_assignments
for each row execute function public.set_updated_at();

create index shifts_scope_idx on public.shifts (organization_id, plant_id, department_id) where deleted_at is null;
create index shift_breaks_shift_idx on public.shift_breaks (shift_id, sort_order);
create index shift_assignments_employee_idx on public.employee_shift_assignments (employee_id, effective_from desc);
create index shift_assignments_shift_idx on public.employee_shift_assignments (shift_id);

-- ---------------------------------------------------------------------------
-- Attendance, holidays and leave
-- ---------------------------------------------------------------------------
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  shift_id uuid references public.shifts (id) on delete set null,
  work_date date not null,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_in timestamptz,
  actual_out timestamptz,
  status public.attendance_status not null default 'present',
  late_minutes integer not null default 0,
  early_out_minutes integer not null default 0,
  overtime_minutes integer not null default 0,
  worked_minutes integer not null default 0,
  source text not null default 'manual',
  approved_by uuid references public.employees (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

create trigger attendance_records_set_updated_at
before update on public.attendance_records
for each row execute function public.set_updated_at();

create index attendance_employee_date_idx on public.attendance_records (employee_id, work_date desc);
create index attendance_org_date_idx on public.attendance_records (organization_id, work_date desc);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  plant_id uuid references public.plants (id) on delete cascade,
  name text not null,
  holiday_date date not null,
  is_optional boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, plant_id, holiday_date, name)
);

create trigger holidays_set_updated_at
before update on public.holidays
for each row execute function public.set_updated_at();

create table public.leave_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type public.leave_type not null default 'casual',
  start_date date not null,
  end_date date not null,
  days numeric(5, 1) not null default 1,
  reason text,
  status public.leave_status not null default 'submitted',
  approved_by uuid references public.employees (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_date_range check (end_date >= start_date)
);

create trigger leave_records_set_updated_at
before update on public.leave_records
for each row execute function public.set_updated_at();

create index leave_records_employee_idx on public.leave_records (employee_id, start_date desc);
create index leave_records_status_idx on public.leave_records (organization_id, status);
create index employee_skills_employee_idx on public.employee_skills (employee_id);
create index employee_certifications_employee_idx on public.employee_certifications (employee_id);
create index projects_scope_idx on public.projects (organization_id, plant_id, department_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so RLS cannot recurse)
-- ---------------------------------------------------------------------------
create or replace function public.has_role(p_role_key text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.employee_id = public.current_employee_id()
      and r.key = p_role_key
      and r.deleted_at is null
      and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    left join public.role_permissions rp on rp.role_id = r.id
    left join public.permissions p on p.key = rp.permission_key
    where ur.employee_id = public.current_employee_id()
      and r.deleted_at is null
      and (ur.expires_at is null or ur.expires_at > now())
      and (
        r.key = 'administrator'
        or p.key = p_permission
        or p.key = split_part(p_permission, '.', 1) || '.*'
      )
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.has_role('administrator');
$$;

create or replace function public.current_role_keys()
returns text[]
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(array_agg(r.key order by r.level desc), '{}')
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.employee_id = public.current_employee_id()
    and r.deleted_at is null
    and (ur.expires_at is null or ur.expires_at > now());
$$;

/**
 * Scope check used by RLS. Requires the record to belong to the caller's
 * organization. Administrators and employees.read.all bypass plant scope;
 * HODs are additionally limited to their own department.
 */
create or replace function public.can_access_scope(
  p_organization_id uuid,
  p_plant_id uuid,
  p_department_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when p_organization_id is null or p_organization_id <> public.current_org_id() then false
    when public.is_admin() then true
    when public.has_permission('employees.read.all') then true
    else exists (
      select 1
      from public.employees me
      where me.id = public.current_employee_id()
        and me.deleted_at is null
        and (me.plant_id is null or p_plant_id is null or me.plant_id = p_plant_id)
        and (not public.has_role('hod') or p_department_id is null or me.department_id = p_department_id)
    )
  end;
$$;

create or replace function public.can_access_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.employees target
    cross join public.employees me
    where me.id = public.current_employee_id()
      and me.deleted_at is null
      and target.id = p_employee_id
      and target.deleted_at is null
      and target.organization_id = me.organization_id
      and (
        target.id = me.id
        or public.is_admin()
        or public.has_permission('employees.read.all')
        or (
          public.has_permission('employees.read')
          and (me.plant_id is null or target.plant_id = me.plant_id)
          and (not public.has_role('hod') or target.department_id = me.department_id)
        )
      )
  );
$$;

grant execute on function public.has_role(text) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_role_keys() to authenticated;
grant execute on function public.can_access_scope(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_access_employee(uuid) to authenticated;
