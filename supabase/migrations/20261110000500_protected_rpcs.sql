-- 00500: Protected RPCs. These are the only write paths for privileged
-- workflows; every function re-checks the caller's permissions and scope.

-- ---------------------------------------------------------------------------
-- Identity context
-- ---------------------------------------------------------------------------
create or replace function public.get_my_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_employee public.employees;
  v_org public.organizations;
  v_profile public.user_profiles;
  v_roles jsonb;
  v_role_keys text[];
  v_permissions text[];
  v_shift_id uuid;
begin
  select * into v_employee
  from public.employees
  where user_id = auth.uid() and deleted_at is null
  limit 1;

  if v_employee.id is null then
    return null;
  end if;

  select * into v_org from public.organizations where id = v_employee.organization_id;
  select * into v_profile from public.user_profiles where id = auth.uid();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'key', r.key,
    'name', r.name,
    'level', r.level,
    'description', r.description
  ) order by r.level desc), '[]'::jsonb)
  into v_roles
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.employee_id = v_employee.id
    and r.deleted_at is null
    and (ur.expires_at is null or ur.expires_at > now());

  select coalesce(array_agg(r.key order by r.level desc), '{}')
  into v_role_keys
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.employee_id = v_employee.id
    and r.deleted_at is null
    and (ur.expires_at is null or ur.expires_at > now());

  select coalesce(array_agg(distinct p.key order by p.key), '{}')
  into v_permissions
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join public.role_permissions rp on rp.role_id = r.id
  join public.permissions p on p.key = rp.permission_key
  where ur.employee_id = v_employee.id
    and r.deleted_at is null
    and (ur.expires_at is null or ur.expires_at > now());

  -- Administrator is always fully authorized, even when a new permission is
  -- added before the seed migration grants it explicitly.
  if 'administrator' = any(v_role_keys) then
    select coalesce(array_agg(p.key order by p.key), '{}') into v_permissions from public.permissions p;
  end if;

  select a.shift_id into v_shift_id
  from public.employee_shift_assignments a
  where a.employee_id = v_employee.id
    and a.effective_from <= current_date
    and (a.effective_to is null or a.effective_to >= current_date)
  order by a.effective_from desc
  limit 1;

  return jsonb_build_object(
    'employee', jsonb_build_object(
      'id', v_employee.id,
      'organizationId', v_employee.organization_id,
      'plantId', v_employee.plant_id,
      'departmentId', v_employee.department_id,
      'productionLineId', v_employee.production_line_id,
      'employeeCode', v_employee.employee_code,
      'firstName', v_employee.first_name,
      'lastName', v_employee.last_name,
      'fullName', v_employee.full_name,
      'displayName', v_employee.full_name,
      'workEmail', v_employee.work_email,
      'email', v_employee.work_email,
      'personalEmail', v_employee.personal_email,
      'phone', v_employee.phone,
      'photoUrl', v_employee.photo_url,
      'designation', (select title from public.designations d where d.id = v_employee.designation_id),
      'department', (select name from public.departments d where d.id = v_employee.department_id),
      'plant', (select name from public.plants p where p.id = v_employee.plant_id),
      'plantCode', (select code from public.plants p where p.id = v_employee.plant_id),
      'productionLine', (select name from public.production_lines l where l.id = v_employee.production_line_id),
      'jobCategory', (select name from public.job_categories j where j.id = v_employee.job_category_id),
      'reportingManagerId', v_employee.reporting_manager_id,
      'reportingManagerName', (select full_name from public.employees m where m.id = v_employee.reporting_manager_id),
      'employmentStatus', v_employee.employment_status,
      'employmentType', v_employee.employment_type,
      'workMode', v_employee.work_mode,
      'joinedOn', v_employee.joined_on,
      'location', v_employee.location,
      'shiftId', v_shift_id,
      'roles', v_roles,
      'roleKeys', v_role_keys
    ),
    'employeeId', v_employee.id,
    'profile', jsonb_build_object(
      'id', auth.uid(),
      'employeeId', v_employee.id,
      'fullName', coalesce(v_profile.full_name, v_employee.full_name),
      'email', coalesce(v_profile.email, v_employee.work_email),
      'phone', coalesce(v_profile.phone, v_employee.phone),
      'photoUrl', coalesce(v_profile.avatar_url, v_employee.photo_url),
      'timezone', coalesce(v_profile.timezone, 'Asia/Kolkata'),
      'locale', coalesce(v_profile.locale, 'en-IN')
    ),
    'organization', jsonb_build_object(
      'id', v_org.id,
      'name', v_org.name,
      'legalName', v_org.legal_name,
      'code', v_org.code,
      'timezone', v_org.timezone,
      'currency', v_org.currency,
      'locale', v_org.locale,
      'website', v_org.website,
      'supportEmail', v_org.support_email,
      'supportPhone', v_org.support_phone,
      'address', v_org.address,
      'logoUrl', v_org.logo_url
    ),
    'roles', v_roles,
    'roleKeys', v_role_keys,
    'permissions', v_permissions,
    'scope', jsonb_build_object(
      'organizationId', v_employee.organization_id,
      'plantId', v_employee.plant_id,
      'departmentId', v_employee.department_id,
      'productionLineId', v_employee.production_line_id
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications helper
-- ---------------------------------------------------------------------------
create or replace function public.create_notification(
  p_organization_id uuid,
  p_recipient_employee_id uuid,
  p_title text,
  p_body text,
  p_category public.notification_category,
  p_link text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (
    organization_id, recipient_employee_id, title, body, category, link
  ) values (
    p_organization_id, p_recipient_employee_id, p_title, p_body, p_category, p_link
  );
$$;

revoke all on function public.create_notification(uuid, uuid, text, text, public.notification_category, text) from public;

-- ---------------------------------------------------------------------------
-- Requests and approvals
-- ---------------------------------------------------------------------------
create or replace function public.submit_request(
  p_request_type public.request_type,
  p_title text,
  p_details text default null,
  p_amount numeric default null,
  p_customer_visible boolean default false
)
returns public.requests
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_employee public.employees;
  v_approver_id uuid;
  v_request public.requests;
  v_approval public.approvals;
begin
  select * into v_employee
  from public.employees
  where id = public.current_employee_id() and deleted_at is null;

  if v_employee.id is null then
    raise exception 'No active employee profile is linked to this account.' using errcode = '42501';
  end if;

  if not public.has_permission('requests.create') then
    raise exception 'You do not have permission to submit requests.' using errcode = '42501';
  end if;

  if p_title is null or length(trim(p_title)) < 3 then
    raise exception 'A request title of at least three characters is required.' using errcode = '22023';
  end if;

  -- Resolve the level-1 owner from the configured authority matrix. Prefer a
  -- scope match, then fall back to the reporting manager.
  select candidate.employee_id
  into v_approver_id
  from (
    select e.id as employee_id, 1 as priority
    from public.approval_authorities aa
    join public.user_roles ur on ur.role_id = aa.role_id
    join public.employees e on e.id = ur.employee_id
    join public.roles r on r.id = ur.role_id
    where aa.organization_id = v_employee.organization_id
      and aa.request_type = p_request_type
      and aa.level = 1
      and (
        (aa.scope_type = 'department' and aa.scope_id = v_employee.department_id)
        or (aa.scope_type = 'plant' and aa.scope_id = v_employee.plant_id)
        or (aa.scope_type = 'organization' and aa.scope_id = v_employee.organization_id)
      )
      and (aa.threshold_amount is null or coalesce(p_amount, 0) <= aa.threshold_amount)
      and e.deleted_at is null
      and e.employment_status = 'active'
      and r.deleted_at is null
      and (aa.self_approval_allowed or e.id <> v_employee.id)
    union all
    select v_employee.reporting_manager_id, 2
    where v_employee.reporting_manager_id is not null
  ) candidate
  order by candidate.priority
  limit 1;

  insert into public.requests (
    organization_id,
    employee_id,
    request_type,
    title,
    details,
    amount,
    status,
    current_approver_id,
    department_id,
    plant_id,
    customer_visible,
    submitted_at
  ) values (
    v_employee.organization_id,
    v_employee.id,
    p_request_type,
    trim(p_title),
    p_details,
    p_amount,
    'submitted',
    v_approver_id,
    v_employee.department_id,
    v_employee.plant_id,
    coalesce(p_customer_visible, false),
    now()
  )
  returning * into v_request;

  if v_approver_id is not null then
    insert into public.approvals (organization_id, request_id, step, approver_employee_id, status)
    values (v_employee.organization_id, v_request.id, 1, v_approver_id, 'pending')
    returning * into v_approval;

    perform public.create_notification(
      v_employee.organization_id,
      v_approver_id,
      'Approval required: ' || v_request.title,
      v_employee.full_name || ' submitted a ' || replace(p_request_type::text, '_', ' ') || ' request.',
      'approval',
      '/approvals'
    );
  end if;

  perform public.write_audit(
    'request.submitted',
    'request',
    v_request.id,
    'Submitted ' || replace(p_request_type::text, '_', ' ') || ' request: ' || v_request.title
  );

  return v_request;
end;
$$;

create or replace function public.decide_approval(
  p_approval_id uuid,
  p_decision text,
  p_comments text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_approval public.approvals;
  v_request public.requests;
  v_next public.approvals;
  v_me uuid := public.current_employee_id();
  v_status public.request_status;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;

  select * into v_approval
  from public.approvals
  where id = p_approval_id
  for update;

  if v_approval.id is null then
    raise exception 'Approval step not found.' using errcode = 'P0002';
  end if;

  select * into v_request
  from public.requests
  where id = v_approval.request_id
  for update;

  if v_request.id is null then
    raise exception 'Request not found.' using errcode = 'P0002';
  end if;

  if public.has_role('customer_approver') and not v_request.customer_visible then
    raise exception 'This request is not shared with the customer portal.' using errcode = '42501';
  end if;

  if v_request.employee_id = v_me and not exists (
    select 1 from public.approval_authorities aa
    where aa.organization_id = v_request.organization_id
      and aa.request_type = v_request.request_type
      and aa.self_approval_allowed
  ) then
    raise exception 'Segregation of duties: you cannot approve your own request.' using errcode = '42501';
  end if;

  if v_approval.approver_employee_id <> v_me and not public.is_admin() then
    raise exception 'This approval step is assigned to another employee.' using errcode = '42501';
  end if;

  if v_approval.status <> 'pending' then
    raise exception 'This approval step has already been decided.' using errcode = '22023';
  end if;

  update public.approvals
  set status = p_decision::public.approval_status,
      comments = p_comments,
      decided_at = now()
  where id = v_approval.id;

  if p_decision = 'rejected' then
    v_status := 'rejected';
    update public.requests
    set status = v_status,
        current_approver_id = null,
        decided_at = now(),
        decision_notes = p_comments
    where id = v_request.id;
  else
    select * into v_next
    from public.approvals
    where request_id = v_request.id
      and step > v_approval.step
      and status = 'waiting'
    order by step
    limit 1;

    if v_next.id is not null then
      update public.approvals
      set status = 'pending'
      where id = v_next.id;

      update public.requests
      set current_approver_id = v_next.approver_employee_id
      where id = v_request.id;

      perform public.create_notification(
        v_request.organization_id,
        v_next.approver_employee_id,
        'Approval required: ' || v_request.title,
        'A previous approval step was completed. Your decision is now required.',
        'approval',
        '/approvals'
      );
      v_status := 'pending';
    else
      v_status := 'approved';
      update public.requests
      set status = v_status,
          current_approver_id = null,
          decided_at = now(),
          decision_notes = p_comments
      where id = v_request.id;
    end if;
  end if;

  perform public.create_notification(
    v_request.organization_id,
    v_request.employee_id,
    'Request ' || v_status::text || ': ' || v_request.title,
    coalesce(p_comments, 'Your request was ' || v_status::text || '.'),
    'approval',
    '/requests'
  );

  perform public.write_audit(
    'approval.' || p_decision,
    'request',
    v_request.id,
    'Approval step ' || v_approval.step || ' ' || p_decision || ' for ' || v_request.title
  );

  return jsonb_build_object(
    'requestId', v_request.id,
    'approvalId', v_approval.id,
    'requestStatus', v_status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Role administration
-- ---------------------------------------------------------------------------
create or replace function public.assign_role(p_employee_id uuid, p_role_key text)
returns public.user_roles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role public.roles;
  v_employee public.employees;
  v_assignment public.user_roles;
begin
  if not public.has_permission('roles.manage') then
    raise exception 'You do not have permission to assign roles.' using errcode = '42501';
  end if;

  select * into v_employee
  from public.employees
  where id = p_employee_id and deleted_at is null;

  if v_employee.id is null or not public.can_access_employee(v_employee.id) then
    raise exception 'Employee is outside your authorized scope.' using errcode = '42501';
  end if;

  select * into v_role
  from public.roles
  where organization_id = v_employee.organization_id
    and key = p_role_key
    and deleted_at is null;

  if v_role.id is null then
    raise exception 'Role % does not exist in this organization.', p_role_key using errcode = 'P0002';
  end if;

  insert into public.user_roles (organization_id, employee_id, role_id, assigned_by)
  values (v_employee.organization_id, v_employee.id, v_role.id, public.current_employee_id())
  on conflict (employee_id, role_id) do update set assigned_by = excluded.assigned_by, assigned_at = now()
  returning * into v_assignment;

  perform public.create_notification(
    v_employee.organization_id,
    v_employee.id,
    'Role assigned: ' || v_role.name,
    'Your platform access now includes the ' || v_role.name || ' role.',
    'people',
    '/profile'
  );

  perform public.write_audit(
    'role.assigned',
    'user_role',
    v_assignment.id,
    'Assigned ' || v_role.name || ' to ' || v_employee.full_name
  );

  return v_assignment;
end;
$$;

create or replace function public.remove_role(p_employee_id uuid, p_role_key text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role public.roles;
  v_employee public.employees;
  v_admin_role uuid;
  v_admin_count integer;
begin
  if not public.has_permission('roles.manage') then
    raise exception 'You do not have permission to remove roles.' using errcode = '42501';
  end if;

  select * into v_employee
  from public.employees
  where id = p_employee_id and deleted_at is null;

  if v_employee.id is null or not public.can_access_employee(v_employee.id) then
    raise exception 'Employee is outside your authorized scope.' using errcode = '42501';
  end if;

  select * into v_role
  from public.roles
  where organization_id = v_employee.organization_id
    and key = p_role_key
    and deleted_at is null;

  if v_role.id is null then
    return false;
  end if;

  if p_role_key = 'administrator' then
    select id into v_admin_role from public.roles where organization_id = v_employee.organization_id and key = 'administrator';
    select count(distinct ur.employee_id) into v_admin_count
    from public.user_roles ur
    where ur.role_id = v_admin_role;
    if v_admin_count <= 1 then
      raise exception 'Cannot remove the last administrator in the organization.' using errcode = '42501';
    end if;
  end if;

  delete from public.user_roles
  where employee_id = v_employee.id and role_id = v_role.id;

  perform public.write_audit(
    'role.removed',
    'user_role',
    v_employee.id,
    'Removed ' || v_role.name || ' from ' || v_employee.full_name
  );

  return true;
end;
$$;

create or replace function public.set_role_permissions(p_role_key text, p_permissions text[])
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role public.roles;
  v_invalid text[];
begin
  if not public.has_permission('roles.manage') then
    raise exception 'You do not have permission to edit role permissions.' using errcode = '42501';
  end if;

  select * into v_role
  from public.roles
  where organization_id = public.current_org_id()
    and key = p_role_key
    and deleted_at is null;

  if v_role.id is null then
    raise exception 'Role % does not exist in this organization.', p_role_key using errcode = 'P0002';
  end if;

  select coalesce(array_agg(perm_key), '{}')
  into v_invalid
  from unnest(coalesce(p_permissions, '{}')) as perm(perm_key)
  where perm_key <> '*'
    and perm_key !~ '\.\*$'
    and perm_key not in (select p.key from public.permissions p);

  if cardinality(v_invalid) > 0 then
    raise exception 'Unknown permissions: %', array_to_string(v_invalid, ', ') using errcode = '22023';
  end if;

  delete from public.role_permissions where role_id = v_role.id;

  insert into public.role_permissions (role_id, permission_key)
  select v_role.id, perm_key
  from unnest(coalesce(p_permissions, '{}')) as perm(perm_key)
  where perm_key <> '*'
    and perm_key !~ '\.\*$'
    and perm_key in (select p.key from public.permissions p)
  on conflict do nothing;

  perform public.write_audit(
    'role.permissions_updated',
    'role',
    v_role.id,
    'Updated permissions for ' || v_role.name
  );

  return jsonb_build_object('roleKey', v_role.key, 'permissions', p_permissions);
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitation activation
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(p_invitation_id uuid, p_password_set boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_invitation public.invitations;
  v_employee public.employees;
  v_role public.roles;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  select * into v_invitation
  from public.invitations
  where id = p_invitation_id
  for update;

  if v_invitation.id is null then
    raise exception 'Invitation not found.' using errcode = 'P0002';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'This invitation is no longer pending.' using errcode = '22023';
  end if;

  if v_invitation.expires_at < now() then
    update public.invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'This invitation has expired. Ask your administrator for a new one.' using errcode = '22023';
  end if;

  if v_invitation.email <> v_email and not exists (
    select 1 from public.employees e
    where e.id = v_invitation.employee_id and e.user_id = auth.uid()
  ) then
    raise exception 'This invitation belongs to a different email address.' using errcode = '42501';
  end if;

  select * into v_employee
  from public.employees
  where organization_id = v_invitation.organization_id
    and (
      (v_invitation.employee_id is not null and id = v_invitation.employee_id)
      or lower(work_email) = v_email
    )
    and deleted_at is null
  limit 1;

  if v_employee.id is null then
    raise exception 'No employee record is linked to this invitation. Ask HR to create the employee first.' using errcode = 'P0002';
  end if;

  if v_employee.user_id is not null and v_employee.user_id <> auth.uid() then
    raise exception 'This employee record is already linked to another sign-in identity.' using errcode = '42501';
  end if;

  update public.employees set user_id = auth.uid() where id = v_employee.id;

  select * into v_role
  from public.roles
  where organization_id = v_invitation.organization_id
    and key = v_invitation.role_key
    and deleted_at is null;

  if v_role.id is not null then
    insert into public.user_roles (organization_id, employee_id, role_id, assigned_by)
    values (v_invitation.organization_id, v_employee.id, v_role.id, v_invitation.invited_by)
    on conflict (employee_id, role_id) do nothing;
  end if;

  update public.invitations
  set status = 'accepted', accepted_at = now()
  where id = v_invitation.id;

  perform public.write_audit(
    'invitation.accepted',
    'invitation',
    v_invitation.id,
    'Invitation accepted for ' || v_employee.full_name
  );

  return jsonb_build_object('employeeId', v_employee.id, 'roleKey', v_invitation.role_key, 'passwordSet', p_password_set);
end;
$$;

-- ---------------------------------------------------------------------------
-- Session listing (own sessions only)
-- ---------------------------------------------------------------------------
create or replace function public.list_my_sessions()
returns table (
  id uuid,
  user_agent text,
  ip text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = auth
as $$
  select s.id, s.user_agent, s.ip, s.created_at, s.updated_at
  from auth.sessions s
  where s.user_id = auth.uid()
  order by s.updated_at desc nulls last;
$$;

revoke all on function public.get_my_context() from public;
revoke all on function public.submit_request(public.request_type, text, text, numeric, boolean) from public;
revoke all on function public.decide_approval(uuid, text, text) from public;
revoke all on function public.assign_role(uuid, text) from public;
revoke all on function public.remove_role(uuid, text) from public;
revoke all on function public.set_role_permissions(text, text[]) from public;
revoke all on function public.accept_invitation(uuid, boolean) from public;
revoke all on function public.list_my_sessions() from public;

grant execute on function public.get_my_context() to authenticated;
grant execute on function public.submit_request(public.request_type, text, text, numeric, boolean) to authenticated;
grant execute on function public.decide_approval(uuid, text, text) to authenticated;
grant execute on function public.assign_role(uuid, text) to authenticated;
grant execute on function public.remove_role(uuid, text) to authenticated;
grant execute on function public.set_role_permissions(text, text[]) to authenticated;
grant execute on function public.accept_invitation(uuid, boolean) to authenticated;
grant execute on function public.list_my_sessions() to authenticated;
