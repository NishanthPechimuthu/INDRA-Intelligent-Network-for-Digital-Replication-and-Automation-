-- 00300: operational records, approvals, invitations, documents and audit.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  recipient_employee_id uuid not null references public.employees (id) on delete cascade,
  title text not null,
  body text,
  category public.notification_category not null default 'general',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

create index notifications_recipient_idx on public.notifications (recipient_employee_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_employee_id) where read_at is null;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  assignee_employee_id uuid not null references public.employees (id) on delete cascade,
  created_by_employee_id uuid references public.employees (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create index tasks_assignee_idx on public.tasks (assignee_employee_id, status);
create index tasks_org_due_idx on public.tasks (organization_id, due_at);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  request_type public.request_type not null,
  title text not null,
  details text,
  amount numeric(14, 2) check (amount is null or amount >= 0),
  status public.request_status not null default 'submitted',
  current_approver_id uuid references public.employees (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  plant_id uuid references public.plants (id) on delete set null,
  customer_visible boolean not null default false,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger requests_set_updated_at
before update on public.requests
for each row execute function public.set_updated_at();

create index requests_employee_idx on public.requests (employee_id, created_at desc);
create index requests_approver_idx on public.requests (current_approver_id, status);
create index requests_scope_idx on public.requests (organization_id, plant_id, department_id, status);
create index requests_customer_idx on public.requests (organization_id, status) where customer_visible = true;

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  request_id uuid not null references public.requests (id) on delete cascade,
  step integer not null default 1 check (step > 0),
  approver_employee_id uuid not null references public.employees (id) on delete cascade,
  status public.approval_status not null default 'pending',
  decided_at timestamptz,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, step)
);

create trigger approvals_set_updated_at
before update on public.approvals
for each row execute function public.set_updated_at();

create index approvals_approver_idx on public.approvals (approver_employee_id, status);
create index approvals_request_idx on public.approvals (request_id, step);

create table public.approval_authorities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  scope_type public.scope_type not null default 'department',
  scope_id uuid not null,
  request_type public.request_type not null,
  role_id uuid not null references public.roles (id) on delete cascade,
  level integer not null default 1 check (level > 0),
  threshold_amount numeric(14, 2),
  self_approval_allowed boolean not null default false,
  can_delegate boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, scope_type, scope_id, request_type, level)
);

create trigger approval_authorities_set_updated_at
before update on public.approval_authorities
for each row execute function public.set_updated_at();

create index approval_authorities_scope_idx on public.approval_authorities (organization_id, scope_type, scope_id, request_type);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  email text not null,
  employee_id uuid references public.employees (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  plant_id uuid references public.plants (id) on delete set null,
  role_key text not null,
  status public.invitation_status not null default 'pending',
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid references public.employees (id) on delete set null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger invitations_set_updated_at
before update on public.invitations
for each row execute function public.set_updated_at();

create index invitations_email_idx on public.invitations (lower(email), status);
create index invitations_org_idx on public.invitations (organization_id, status);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  bucket text not null default 'employee-documents',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  category text not null default 'other',
  entity_type text,
  entity_id uuid,
  owner_employee_id uuid references public.employees (id) on delete set null,
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, storage_path)
);

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create index documents_owner_idx on public.documents (owner_employee_id) where deleted_at is null;
create index documents_entity_idx on public.documents (entity_type, entity_id) where deleted_at is null;
create index documents_org_idx on public.documents (organization_id) where deleted_at is null;

create table public.employee_medical (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  blood_group text,
  allergies text,
  conditions text,
  emergency_contact_name text,
  emergency_contact_phone text,
  last_checkup_on date,
  notes text,
  updated_by uuid references public.employees (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger employee_medical_set_updated_at
before update on public.employee_medical
for each row execute function public.set_updated_at();

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_employee_id uuid references public.employees (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_employee_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- Update completed timestamps when a task leaves/enters done.
create or replace function public.set_task_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and (old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_completed_at
before update on public.tasks
for each row execute function public.set_task_completed_at();

-- Security-definer audit writer. Application roles never insert directly.
create or replace function public.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_summary text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    summary,
    ip_address
  )
  values (
    coalesce(public.current_org_id(), (select organization_id from public.employees where id = p_entity_id limit 1)),
    public.current_employee_id(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_summary,
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for'
  );
exception
  when others then
    -- Audit failure must not roll back the business transaction.
    null;
end;
$$;
