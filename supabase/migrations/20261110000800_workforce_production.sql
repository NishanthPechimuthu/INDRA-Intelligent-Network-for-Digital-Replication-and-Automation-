-- INDRA Platform Foundation · Module 02
-- 00800: workforce and production operations schema.
--
-- Module 02 deliberately reuses the Module 01 identity, organization, employee,
-- role, shift and workflow tables. Nothing here creates a second employee or
-- account store: every operational record points at public.employees, and every
-- approval flows through public.requests / public.approvals / public.approval_authorities.

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type public.production_order_status as enum ('planned', 'released', 'in_progress', 'paused', 'on_hold', 'completed', 'cancelled');
create type public.production_task_status as enum ('assigned', 'accepted', 'in_progress', 'paused', 'blocked', 'completed', 'cancelled');
create type public.unit_of_measure as enum ('pcs', 'kg', 'g', 'l', 'm', 'mm');
create type public.issue_severity as enum ('low', 'medium', 'high', 'critical');
create type public.issue_status as enum ('open', 'acknowledged', 'in_progress', 'resolved', 'closed', 'rejected');
create type public.machine_state as enum ('running', 'idle', 'down', 'maintenance', 'setup', 'offline');
create type public.material_category as enum ('raw', 'consumable', 'packaging', 'spare', 'tooling');
create type public.tool_status as enum ('in_service', 'damaged', 'under_repair', 'retired');
create type public.reassignment_status as enum ('submitted', 'approved', 'rejected', 'cancelled', 'applied');
create type public.program_status as enum ('draft', 'in_review', 'approved', 'rejected', 'superseded', 'archived');
create type public.incident_category as enum ('injury', 'near_miss', 'first_aid', 'exposure', 'equipment_safety', 'environmental', 'other');
create type public.incident_status as enum ('reported', 'under_review', 'action_required', 'closed');
create type public.shift_report_status as enum ('submitted', 'acknowledged');

-- New request types flow through the Module 01 shared workflow. Adding enum
-- values is committed immediately, so they are never referenced in this file.
alter type public.request_type add value if not exists 'material_requirement';
alter type public.request_type add value if not exists 'technical_repair';
alter type public.request_type add value if not exists 'tool_request';
alter type public.request_type add value if not exists 'equipment_request';
alter type public.request_type add value if not exists 'manpower_request';
alter type public.request_type add value if not exists 'reassignment';
alter type public.request_type add value if not exists 'program_modification';

-- ---------------------------------------------------------------------------
-- Master data: products, materials and tools
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  unit public.unit_of_measure not null default 'pcs',
  specification text,
  standard_cycle_seconds integer check (standard_cycle_seconds is null or standard_cycle_seconds > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, code)
);

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create index products_org_idx on public.products (organization_id) where deleted_at is null;

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  code text not null,
  name text not null,
  specification text,
  -- The allowed unit is enforced against every material request and consumption
  -- line by the validate_material_unit trigger below.
  unit public.unit_of_measure not null default 'pcs',
  category public.material_category not null default 'raw',
  stock_quantity numeric(14, 3) not null default 0 check (stock_quantity >= 0),
  reorder_level numeric(14, 3) not null default 0 check (reorder_level >= 0),
  unit_cost numeric(14, 2) check (unit_cost is null or unit_cost >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, code)
);

create trigger materials_set_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

create index materials_org_idx on public.materials (organization_id) where deleted_at is null;

create table public.tools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  plant_id uuid references public.plants (id) on delete set null,
  code text not null,
  name text not null,
  tool_type text,
  unit public.unit_of_measure not null default 'pcs',
  quantity_in_service integer not null default 1 check (quantity_in_service >= 0),
  status public.tool_status not null default 'in_service',
  machine_id uuid references public.machines (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, code)
);

create trigger tools_set_updated_at
before update on public.tools
for each row execute function public.set_updated_at();

create index tools_org_idx on public.tools (organization_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Production orders
-- ---------------------------------------------------------------------------
create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  plant_id uuid not null references public.plants (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  production_line_id uuid references public.production_lines (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  product_id uuid not null references public.products (id) on delete restrict,
  order_no text not null,
  batch_no text,
  quantity_planned numeric(14, 3) not null check (quantity_planned > 0),
  quantity_completed numeric(14, 3) not null default 0 check (quantity_completed >= 0),
  quantity_rejected numeric(14, 3) not null default 0 check (quantity_rejected >= 0),
  priority public.task_priority not null default 'medium',
  status public.production_order_status not null default 'planned',
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  released_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by_employee_id uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, order_no),
  check (planned_end_at is null or planned_start_at is null or planned_end_at >= planned_start_at)
);

create trigger production_orders_set_updated_at
before update on public.production_orders
for each row execute function public.set_updated_at();

create index production_orders_scope_idx on public.production_orders (organization_id, plant_id, department_id, status)
  where deleted_at is null;
create index production_orders_line_idx on public.production_orders (production_line_id, status) where deleted_at is null;
create index production_orders_product_idx on public.production_orders (product_id);

-- ---------------------------------------------------------------------------
-- Production tasks: the Module 01 tasks table, extended with manufacturing data.
-- Operators receive task ids from here; they never create or reassign them.
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column production_order_id uuid references public.production_orders (id) on delete cascade,
  add column workstation_id uuid references public.workstations (id) on delete set null,
  add column machine_id uuid references public.machines (id) on delete set null,
  add column supervisor_employee_id uuid references public.employees (id) on delete set null,
  add column target_quantity numeric(14, 3) check (target_quantity is null or target_quantity > 0),
  add column completed_quantity numeric(14, 3) not null default 0 check (completed_quantity >= 0),
  add column rejected_quantity numeric(14, 3) not null default 0 check (rejected_quantity >= 0),
  add column work_instructions text,
  -- Competency gates used when a reassignment is proposed.
  add column required_skill_id uuid references public.skills (id) on delete set null,
  add column required_certification_id uuid references public.certifications (id) on delete set null,
  add column planned_start_at timestamptz,
  add column planned_end_at timestamptz,
  add column production_status public.production_task_status,
  add column paused_reason text,
  add column accepted_at timestamptz,
  add column started_at timestamptz,
  add column production_cancelled_at timestamptz;

create index tasks_order_idx on public.tasks (production_order_id) where production_order_id is not null;
create index tasks_machine_idx on public.tasks (machine_id, production_status) where machine_id is not null;
create index tasks_supervisor_idx on public.tasks (supervisor_employee_id, production_status);

-- Every status transition is recorded so the operator, supervisor and auditor
-- see the same history even though only one row holds the current state.
create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  employee_id uuid references public.employees (id) on delete set null,
  event public.production_task_status not null,
  reason text,
  note text,
  created_at timestamptz not null default now()
);

create index task_events_task_idx on public.task_events (task_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Production reporting
-- ---------------------------------------------------------------------------
create table public.production_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  production_order_id uuid not null references public.production_orders (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  product_id uuid not null references public.products (id) on delete restrict,
  workstation_id uuid references public.workstations (id) on delete set null,
  machine_id uuid references public.machines (id) on delete set null,
  shift_id uuid references public.shifts (id) on delete set null,
  reported_by_employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null default current_date,
  shift_code text,
  batch_no text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  -- Rework is a subset of the rejected count, never an additional quantity, so
  -- the identity below can never double count a reworked piece.
  total_produced numeric(14, 3) not null check (total_produced >= 0),
  good_pieces numeric(14, 3) not null check (good_pieces >= 0),
  rejected_pieces numeric(14, 3) not null default 0 check (rejected_pieces >= 0),
  rework_pieces numeric(14, 3) not null default 0 check (rework_pieces >= 0),
  downtime_minutes integer not null default 0 check (downtime_minutes >= 0),
  downtime_reason text,
  remarks text,
  evidence_document_id uuid references public.documents (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (total_produced = good_pieces + rejected_pieces),
  check (rework_pieces <= rejected_pieces),
  check (ended_at >= started_at)
);

create trigger production_reports_set_updated_at
before update on public.production_reports
for each row execute function public.set_updated_at();

create index production_reports_order_idx on public.production_reports (production_order_id, work_date desc);
create index production_reports_employee_idx on public.production_reports (reported_by_employee_id, work_date desc);
create index production_reports_scope_idx on public.production_reports (organization_id, work_date desc) where deleted_at is null;

create table public.production_report_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  report_id uuid not null references public.production_reports (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete restrict,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit public.unit_of_measure not null,
  created_at timestamptz not null default now(),
  unique (report_id, material_id, unit)
);

create index production_report_materials_report_idx on public.production_report_materials (report_id);

-- Only the unit declared for a material may be used on consumption lines.
create or replace function public.validate_material_unit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  declared unit_of_measure;
begin
  select unit into declared from public.materials where id = new.material_id;
  if declared is null then
    raise exception 'Unknown material %', new.material_id using errcode = '23503';
  end if;
  if new.unit <> declared then
    raise exception 'Unit % is not compatible with material unit %', new.unit, declared using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger production_report_materials_unit
before insert or update on public.production_report_materials
for each row execute function public.validate_material_unit();

-- ---------------------------------------------------------------------------
-- Operator issue reporting
-- ---------------------------------------------------------------------------
create table public.technical_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  plant_id uuid references public.plants (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  production_line_id uuid references public.production_lines (id) on delete set null,
  workstation_id uuid references public.workstations (id) on delete set null,
  machine_id uuid references public.machines (id) on delete restrict,
  production_order_id uuid references public.production_orders (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  reported_by_employee_id uuid not null references public.employees (id) on delete cascade,
  category text not null,
  description text not null,
  occurred_at timestamptz not null default now(),
  severity public.issue_severity not null default 'medium',
  machine_state public.machine_state not null default 'down',
  downtime_minutes integer not null default 0 check (downtime_minutes >= 0),
  production_impact text,
  evidence_document_id uuid references public.documents (id) on delete set null,
  status public.issue_status not null default 'open',
  assigned_to_employee_id uuid references public.employees (id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger technical_issues_set_updated_at
before update on public.technical_issues
for each row execute function public.set_updated_at();

create index technical_issues_scope_idx on public.technical_issues (organization_id, status, severity) where deleted_at is null;
create index technical_issues_machine_idx on public.technical_issues (machine_id, created_at desc);

create table public.tool_damage_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  tool_id uuid not null references public.tools (id) on delete restrict,
  tool_name text not null,
  machine_id uuid references public.machines (id) on delete set null,
  workstation_id uuid references public.workstations (id) on delete set null,
  production_order_id uuid references public.production_orders (id) on delete set null,
  damaged_quantity numeric(14, 3) not null check (damaged_quantity > 0),
  unit public.unit_of_measure not null default 'pcs',
  damage_category text not null,
  description text not null,
  production_impact text,
  evidence_document_id uuid references public.documents (id) on delete set null,
  reported_by_employee_id uuid not null references public.employees (id) on delete cascade,
  status public.issue_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger tool_damage_reports_set_updated_at
before update on public.tool_damage_reports
for each row execute function public.set_updated_at();

create index tool_damage_reports_scope_idx on public.tool_damage_reports (organization_id, status) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Safety reporting: operational facts and restricted medical detail live in
-- separate tables so a supervisor can be granted the former without the latter.
-- ---------------------------------------------------------------------------
create table public.safety_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  plant_id uuid references public.plants (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  workstation_id uuid references public.workstations (id) on delete set null,
  affected_employee_id uuid references public.employees (id) on delete set null,
  reported_by_employee_id uuid not null references public.employees (id) on delete cascade,
  incident_at timestamptz not null default now(),
  category public.incident_category not null,
  severity public.issue_severity not null default 'medium',
  -- Operational summary only. Anything clinical belongs in safety_incident_details.
  operational_summary text not null,
  immediate_action text,
  lost_time_hours numeric(8, 2) check (lost_time_hours is null or lost_time_hours >= 0),
  work_stopped boolean not null default false,
  status public.incident_status not null default 'reported',
  evidence_document_id uuid references public.documents (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger safety_incidents_set_updated_at
before update on public.safety_incidents
for each row execute function public.set_updated_at();

create index safety_incidents_scope_idx on public.safety_incidents (organization_id, status, incident_at desc) where deleted_at is null;

create table public.safety_incident_details (
  incident_id uuid primary key references public.safety_incidents (id) on delete cascade,
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  -- Restricted: occupational health / HR only. Supervisors must never read this.
  medical_narrative text,
  injury_type text,
  body_part text,
  treatment_given text,
  hospital_referral boolean not null default false,
  diagnosis text,
  fit_to_work text,
  restrictions text,
  physician_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger safety_incident_details_set_updated_at
before update on public.safety_incident_details
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Shift completion and handover
-- ---------------------------------------------------------------------------
create table public.shift_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  shift_id uuid references public.shifts (id) on delete set null,
  production_order_id uuid references public.production_orders (id) on delete set null,
  work_date date not null default current_date,
  shift_code text,
  tasks_completed integer not null default 0 check (tasks_completed >= 0),
  total_produced numeric(14, 3) not null default 0 check (total_produced >= 0),
  good_pieces numeric(14, 3) not null default 0 check (good_pieces >= 0),
  rejected_pieces numeric(14, 3) not null default 0 check (rejected_pieces >= 0),
  machine_issue_count integer not null default 0 check (machine_issue_count >= 0),
  tool_issue_count integer not null default 0 check (tool_issue_count >= 0),
  material_shortage_count integer not null default 0 check (material_shortage_count >= 0),
  remaining_work text,
  handover_notes text not null,
  status public.shift_report_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  acknowledged_by_employee_id uuid references public.employees (id) on delete set null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (total_produced = good_pieces + rejected_pieces)
);

create trigger shift_reports_set_updated_at
before update on public.shift_reports
for each row execute function public.set_updated_at();

create index shift_reports_employee_idx on public.shift_reports (employee_id, work_date desc);
create index shift_reports_scope_idx on public.shift_reports (organization_id, work_date desc) where deleted_at is null;

create table public.shift_report_tasks (
  report_id uuid not null references public.shift_reports (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  primary key (report_id, task_id)
);

-- ---------------------------------------------------------------------------
-- Shared-workflow detail tables
-- ---------------------------------------------------------------------------
create table public.material_requests (
  request_id uuid primary key references public.requests (id) on delete cascade,
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete restrict,
  specification text,
  required_quantity numeric(14, 3) not null check (required_quantity > 0),
  unit public.unit_of_measure not null,
  available_quantity numeric(14, 3) check (available_quantity is null or available_quantity >= 0),
  required_by timestamptz,
  production_order_id uuid references public.production_orders (id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index material_requests_org_idx on public.material_requests (organization_id);

create table public.reassignment_requests (
  request_id uuid primary key references public.requests (id) on delete cascade,
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  current_task_id uuid references public.tasks (id) on delete set null,
  proposed_task_id uuid references public.tasks (id) on delete set null,
  current_workstation_id uuid references public.workstations (id) on delete set null,
  proposed_workstation_id uuid references public.workstations (id) on delete set null,
  current_shift_id uuid references public.shifts (id) on delete set null,
  proposed_shift_id uuid references public.shifts (id) on delete set null,
  current_assignment_snapshot jsonb not null default '{}'::jsonb,
  proposed_assignment_snapshot jsonb not null default '{}'::jsonb,
  competency_requirements text,
  reason text not null,
  effective_at timestamptz not null default now(),
  status public.reassignment_status not null default 'submitted',
  approved_by_employee_id uuid references public.employees (id) on delete set null,
  decided_at timestamptz,
  decision_notes text,
  applied_at timestamptz,
  created_by_employee_id uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reassignment_requests_set_updated_at
before update on public.reassignment_requests
for each row execute function public.set_updated_at();

create index reassignment_requests_employee_idx on public.reassignment_requests (employee_id, created_at desc);
create index reassignment_requests_scope_idx on public.reassignment_requests (organization_id, status);

-- ---------------------------------------------------------------------------
-- Machine programs and revision control
-- ---------------------------------------------------------------------------
create table public.machine_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  machine_id uuid not null references public.machines (id) on delete cascade,
  program_number text not null,
  name text not null,
  description text,
  controller_type text,
  current_version integer not null default 0 check (current_version >= 0),
  -- Denormalised pointer to the approved version that is actually running.
  approved_version_id uuid,
  status public.program_status not null default 'draft',
  owner_employee_id uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (machine_id, program_number)
);

create trigger machine_programs_set_updated_at
before update on public.machine_programs
for each row execute function public.set_updated_at();

create index machine_programs_machine_idx on public.machine_programs (machine_id) where deleted_at is null;

create table public.machine_program_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  program_id uuid not null references public.machine_programs (id) on delete cascade,
  version integer not null check (version > 0),
  status public.program_status not null default 'draft',
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  checksum text,
  change_summary text not null,
  revision_notes text,
  production_order_id uuid references public.production_orders (id) on delete set null,
  test_evidence_document_id uuid references public.documents (id) on delete set null,
  created_by_employee_id uuid references public.employees (id) on delete set null,
  submitted_at timestamptz,
  approved_by_employee_id uuid references public.employees (id) on delete set null,
  approved_at timestamptz,
  decision_notes text,
  superseded_by_version_id uuid references public.machine_program_versions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, version)
);

create trigger machine_program_versions_set_updated_at
before update on public.machine_program_versions
for each row execute function public.set_updated_at();

create index machine_program_versions_program_idx on public.machine_program_versions (program_id, version desc);

alter table public.machine_programs
  add constraint machine_programs_approved_version_fk
  foreign key (approved_version_id) references public.machine_program_versions (id) on delete set null;

-- An approved version is immutable: its executable payload and revision fields may
-- never be rewritten in place. Later work must create a new version row.
create or replace function public.protect_approved_program_version()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'approved' and (
    new.storage_path is distinct from old.storage_path
    or new.file_name is distinct from old.file_name
    or new.checksum is distinct from old.checksum
    or new.version is distinct from old.version
    or new.program_id is distinct from old.program_id
    or new.change_summary is distinct from old.change_summary
    or new.size_bytes is distinct from old.size_bytes
  ) then
    raise exception 'Approved program version % is immutable; register a new version instead', old.version
      using errcode = '42501';
  end if;
  if old.status in ('approved', 'superseded') and new.status = 'draft' then
    raise exception 'An approved or superseded program version cannot return to draft' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger machine_program_versions_immutable
before update on public.machine_program_versions
for each row execute function public.protect_approved_program_version();

-- Approved machine files are sensitive. Reads are audited through this helper
-- instead of exposing storage objects straight from the client.
create or replace function public.log_program_access(p_version_id uuid, p_action text default 'program.read')
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_program_id uuid;
begin
  select program_id into v_program_id from public.machine_program_versions where id = p_version_id;
  perform public.write_audit(p_action, 'machine_program_version', p_version_id, 'Machine program file accessed');
end;
$$;

-- ---------------------------------------------------------------------------
-- Employee machine authorization: required before a reassignment is approved.
-- ---------------------------------------------------------------------------
create table public.employee_machine_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  machine_id uuid not null references public.machines (id) on delete cascade,
  authorized_on date not null default current_date,
  expires_on date,
  authorized_by_employee_id uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_id, machine_id)
);

create index employee_machine_authorizations_machine_idx on public.employee_machine_authorizations (machine_id);

grant execute on function public.log_program_access(uuid, text) to authenticated;
