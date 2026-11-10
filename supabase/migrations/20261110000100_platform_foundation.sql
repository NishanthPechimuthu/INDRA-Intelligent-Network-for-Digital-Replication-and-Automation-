-- INDRA Platform Foundation · Module 01
-- 00100: extensions, core organization structure, profiles and employees.
-- All business data is normalized; no JSON blobs are used for operational records.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerated domains
-- ---------------------------------------------------------------------------
create type public.employment_status as enum ('active', 'probation', 'on_leave', 'suspended', 'terminated', 'resigned');
create type public.employment_type as enum ('full_time', 'part_time', 'contract', 'intern', 'external');
create type public.work_mode as enum ('onsite', 'hybrid', 'remote');
create type public.attendance_status as enum ('present', 'late', 'absent', 'on_leave', 'half_day', 'holiday', 'remote');
create type public.leave_status as enum ('draft', 'submitted', 'approved', 'rejected', 'cancelled');
create type public.leave_type as enum ('casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity', 'compensatory', 'other');
create type public.overtime_policy as enum ('none', 'after_shift', 'manager_approval', 'weekly');
create type public.request_status as enum ('draft', 'submitted', 'pending', 'in_review', 'approved', 'rejected', 'cancelled');
create type public.request_type as enum ('leave', 'expense', 'purchase', 'access', 'shift_swap', 'customer_evidence', 'other');
create type public.approval_status as enum ('waiting', 'pending', 'approved', 'rejected', 'skipped', 'cancelled');
create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'done', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high', 'critical');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.notification_category as enum ('approval', 'schedule', 'people', 'attendance', 'payroll', 'compliance', 'general');
create type public.scope_type as enum ('organization', 'plant', 'department');
create type public.certification_status as enum ('pending', 'verified', 'expired', 'revoked');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizations, sites and structure
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  code text not null unique,
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  locale text not null default 'en-IN',
  website text,
  support_email text,
  support_phone text,
  address text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  timezone text not null default 'Asia/Kolkata',
  locale text not null default 'en-IN',
  mfa_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.job_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, code)
);

create trigger job_categories_set_updated_at
before update on public.job_categories
for each row execute function public.set_updated_at();

create table public.designations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  level text,
  job_category_id uuid references public.job_categories (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger designations_set_updated_at
before update on public.designations
for each row execute function public.set_updated_at();

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  code text not null,
  city text,
  state text,
  country text default 'India',
  timezone text not null default 'Asia/Kolkata',
  address text,
  is_active boolean not null default true,
  head_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, code)
);

create trigger plants_set_updated_at
before update on public.plants
for each row execute function public.set_updated_at();

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete cascade,
  name text not null,
  code text not null,
  cost_center text,
  manager_employee_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, code)
);

create trigger departments_set_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

create table public.production_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  name text not null,
  code text not null,
  status text not null default 'idle',
  shift_pattern text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, code)
);

create trigger production_lines_set_updated_at
before update on public.production_lines
for each row execute function public.set_updated_at();

create table public.workstations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  production_line_id uuid not null references public.production_lines (id) on delete cascade,
  name text not null,
  code text not null,
  station_type text not null default 'assembly',
  sequence integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, code)
);

create trigger workstations_set_updated_at
before update on public.workstations
for each row execute function public.set_updated_at();

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  workstation_id uuid references public.workstations (id) on delete set null,
  name text not null,
  asset_tag text not null,
  manufacturer text,
  model text,
  status text not null default 'idle',
  criticality text not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, asset_tag)
);

create trigger machines_set_updated_at
before update on public.machines
for each row execute function public.set_updated_at();

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete restrict,
  department_id uuid not null references public.departments (id) on delete restrict,
  production_line_id uuid references public.production_lines (id) on delete set null,
  user_id uuid unique references auth.users (id) on delete set null,
  employee_code text not null,
  first_name text not null,
  last_name text not null,
  full_name text not null,
  work_email text not null,
  personal_email text,
  phone text,
  photo_url text,
  designation_id uuid references public.designations (id) on delete set null,
  reporting_manager_id uuid references public.employees (id) on delete set null,
  job_category_id uuid references public.job_categories (id) on delete set null,
  employment_status public.employment_status not null default 'active',
  employment_type public.employment_type not null default 'full_time',
  work_mode public.work_mode not null default 'onsite',
  joined_on date,
  exited_on date,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, employee_code)
);

create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

alter table public.plants
  add constraint plants_head_employee_fk
  foreign key (head_employee_id) references public.employees (id) on delete set null;

alter table public.departments
  add constraint departments_manager_employee_fk
  foreign key (manager_employee_id) references public.employees (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Identity context helpers (the authoritative scope comes from the database)
-- ---------------------------------------------------------------------------
create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select e.id
  from public.employees e
  where e.user_id = auth.uid()
    and e.deleted_at is null
  limit 1;
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select e.organization_id
  from public.employees e
  where e.user_id = auth.uid()
    and e.deleted_at is null
  limit 1;
$$;

/**
 * Prevent an employee from escalating their own record (plant transfer,
 * status change, manager change, auth link) through a direct PostgREST update.
 * HR/administrators with employees.manage keep full access. Service-role calls
 * have no auth.uid() and therefore bypass the trigger.
 */
create or replace function public.protect_employee_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.has_permission('employees.manage') then
    return new;
  end if;

  if old.id = public.current_employee_id() then
    if new.user_id is distinct from old.user_id
      or new.organization_id is distinct from old.organization_id
      or new.plant_id is distinct from old.plant_id
      or new.department_id is distinct from old.department_id
      or new.production_line_id is distinct from old.production_line_id
      or new.employee_code is distinct from old.employee_code
      or new.employment_status is distinct from old.employment_status
      or new.employment_type is distinct from old.employment_type
      or new.reporting_manager_id is distinct from old.reporting_manager_id
      or new.designation_id is distinct from old.designation_id
      or new.job_category_id is distinct from old.job_category_id
      or new.joined_on is distinct from old.joined_on
    then
      raise exception 'Only HR or an administrator can change employment, reporting or organization fields.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'You do not have permission to update this employee record.'
    using errcode = '42501';
end;
$$;

create trigger employees_protect_update
before update on public.employees
for each row execute function public.protect_employee_update();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index organizations_code_idx on public.organizations (code);
create index plants_organization_idx on public.plants (organization_id, is_active) where deleted_at is null;
create index departments_organization_idx on public.departments (organization_id, plant_id) where deleted_at is null;
create index departments_manager_idx on public.departments (manager_employee_id);
create index production_lines_scope_idx on public.production_lines (organization_id, plant_id, department_id) where deleted_at is null;
create index workstations_line_idx on public.workstations (production_line_id) where deleted_at is null;
create index machines_workstation_idx on public.machines (workstation_id) where deleted_at is null;
create index employees_org_idx on public.employees (organization_id, employment_status) where deleted_at is null;
create index employees_plant_dept_idx on public.employees (plant_id, department_id) where deleted_at is null;
create index employees_user_idx on public.employees (user_id) where user_id is not null;
create index employees_manager_idx on public.employees (reporting_manager_id);
create index employees_email_idx on public.employees (lower(work_email));
create index designations_org_idx on public.designations (organization_id) where deleted_at is null;
create index job_categories_org_idx on public.job_categories (organization_id) where deleted_at is null;
