-- INDRA Platform Foundation · Module 02
-- 01000: protected RPCs for task execution, reporting, requests, reassignment
-- and machine program revision control.
--
-- The browser may read operational data through RLS, but every state transition
-- that matters (starting work, recording production, proposing a reassignment,
-- approving a program version) happens inside a security-definer function that
-- re-checks the caller's employee identity, permission and scope.

-- ---------------------------------------------------------------------------
-- Task execution lifecycle
-- ---------------------------------------------------------------------------
create or replace function public.production_task_transition(
  p_task_id uuid,
  p_status public.production_task_status,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_task public.tasks;
  v_me uuid := public.current_employee_id();
  v_is_manager boolean;
  v_allowed boolean := false;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null then
    raise exception 'Task not found.' using errcode = 'P0002';
  end if;
  if v_task.organization_id <> public.current_org_id() then
    raise exception 'Task belongs to another organization.' using errcode = '42501';
  end if;

  v_is_manager := public.is_admin()
    or public.has_permission('tasks.manage')
    or v_task.supervisor_employee_id = v_me;

  -- Operators may only drive their own task forward through execution states.
  if not v_is_manager and v_task.assignee_employee_id <> v_me then
    raise exception 'Only the assigned operator can update this task.' using errcode = '42501';
  end if;
  if not v_is_manager and p_status in ('cancelled', 'assigned') then
    raise exception 'Only a supervisor can cancel or reassign a task.' using errcode = '42501';
  end if;

  v_allowed := case coalesce(v_task.production_status, 'assigned')
    when 'assigned' then p_status in ('accepted', 'in_progress', 'cancelled')
    when 'accepted' then p_status in ('in_progress', 'paused', 'blocked', 'cancelled')
    when 'in_progress' then p_status in ('paused', 'blocked', 'completed', 'cancelled')
    when 'paused' then p_status in ('in_progress', 'blocked', 'cancelled')
    when 'blocked' then p_status in ('in_progress', 'paused', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'Cannot move task from % to %.', coalesce(v_task.production_status, 'assigned'), p_status
      using errcode = '22023';
  end if;

  if p_status in ('paused', 'blocked') and (p_reason is null or length(trim(p_reason)) < 3) then
    raise exception 'A reason is required to pause or block a task.' using errcode = '22023';
  end if;

  update public.tasks
  set production_status = p_status,
      paused_reason = case when p_status in ('paused', 'blocked') then trim(p_reason) else null end,
      accepted_at = case when p_status = 'accepted' then now() else accepted_at end,
      started_at = case when p_status = 'in_progress' then coalesce(started_at, now()) else started_at end,
      production_cancelled_at = case when p_status = 'cancelled' then now() else production_cancelled_at end,
      status = case p_status
        when 'in_progress' then 'in_progress'::public.task_status
        when 'paused' then 'blocked'::public.task_status
        when 'blocked' then 'blocked'::public.task_status
        when 'completed' then 'done'::public.task_status
        when 'cancelled' then 'cancelled'::public.task_status
        else 'todo'::public.task_status
      end
  where id = p_task_id
  returning * into v_task;

  insert into public.task_events (organization_id, task_id, employee_id, event, reason)
  values (v_task.organization_id, v_task.id, v_me, p_status, p_reason);

  if v_task.supervisor_employee_id is not null and v_task.supervisor_employee_id <> v_me then
    perform public.create_notification(
      v_task.organization_id,
      v_task.supervisor_employee_id,
      'Task ' || p_status || ': ' || v_task.title,
      coalesce(p_reason, 'Task status updated by the assigned operator.'),
      'general',
      '/supervisor/tasks'
    );
  end if;

  perform public.write_audit(
    'task.' || p_status,
    'task',
    v_task.id,
    'Task ' || v_task.title || ' moved to ' || p_status || coalesce(' · ' || p_reason, '')
  );

  return jsonb_build_object('id', v_task.id, 'status', v_task.production_status, 'task_status', v_task.status);
end;
$$;

create or replace function public.start_production_task(p_task_id uuid)
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  select public.production_task_transition(p_task_id, 'in_progress', null);
$$;

create or replace function public.pause_production_task(p_task_id uuid, p_reason text)
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  select public.production_task_transition(p_task_id, 'paused', p_reason);
$$;

create or replace function public.resume_production_task(p_task_id uuid)
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  select public.production_task_transition(p_task_id, 'in_progress', null);
$$;

create or replace function public.complete_production_task(p_task_id uuid, p_reason text default null)
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  select public.production_task_transition(p_task_id, 'completed', p_reason);
$$;

-- ---------------------------------------------------------------------------
-- Production reporting
-- ---------------------------------------------------------------------------
create or replace function public.refresh_production_totals(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_good numeric;
  v_rejected numeric;
begin
  select coalesce(sum(good_pieces), 0), coalesce(sum(rejected_pieces), 0)
  into v_good, v_rejected
  from public.production_reports
  where production_order_id = p_order_id and deleted_at is null;

  update public.production_orders
  set quantity_completed = v_good,
      quantity_rejected = v_rejected,
      status = case
        when status = 'planned' then 'in_progress'::public.production_order_status
        when v_good >= quantity_planned and status not in ('cancelled') then 'completed'::public.production_order_status
        else status
      end,
      completed_at = case when v_good >= quantity_planned then coalesce(completed_at, now()) else completed_at end
  where id = p_order_id;
end;
$$;

create or replace function public.record_production_report(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid := public.current_employee_id();
  v_org uuid := public.current_org_id();
  v_order public.production_orders;
  v_task public.tasks;
  v_report public.production_reports;
  v_total numeric := coalesce((p_payload ->> 'totalProduced')::numeric, 0);
  v_good numeric := coalesce((p_payload ->> 'goodPieces')::numeric, 0);
  v_rejected numeric := coalesce((p_payload ->> 'rejectedPieces')::numeric, 0);
  v_rework numeric := coalesce((p_payload ->> 'reworkPieces')::numeric, 0);
  v_item jsonb;
  v_material public.materials;
  v_done numeric;
  v_rejected_task numeric;
begin
  if not public.has_permission('production.reports.create') then
    raise exception 'You do not have permission to record production.' using errcode = '42501';
  end if;
  if v_me is null then
    raise exception 'No active employee profile is linked to this account.' using errcode = '42501';
  end if;

  -- Arithmetic is re-validated here as well as by the table check constraint so
  -- the caller receives an actionable message instead of a constraint name.
  if v_total <= 0 then
    raise exception 'Total produced must be greater than zero.' using errcode = '22023';
  end if;
  if v_total <> v_good + v_rejected then
    raise exception 'Total produced (%) must equal good pieces (%) plus rejected pieces (%). Rework is counted inside rejects, not added again.',
      v_total, v_good, v_rejected using errcode = '22023';
  end if;
  if v_rework > v_rejected then
    raise exception 'Rework pieces (%) cannot exceed rejected pieces (%).', v_rework, v_rejected using errcode = '22023';
  end if;

  select * into v_order from public.production_orders where id = (p_payload ->> 'productionOrderId')::uuid;
  if v_order.id is null or v_order.organization_id <> v_org then
    raise exception 'Production order not found.' using errcode = 'P0002';
  end if;
  if not public.can_access_scope(v_order.organization_id, v_order.plant_id, v_order.department_id) then
    raise exception 'Production order is outside your scope.' using errcode = '42501';
  end if;

  if (p_payload ->> 'taskId') is not null then
    select * into v_task from public.tasks where id = (p_payload ->> 'taskId')::uuid;
    if v_task.id is null then
      raise exception 'Task not found.' using errcode = 'P0002';
    end if;
    if v_task.assignee_employee_id <> v_me and not (public.has_permission('production.reports.manage')) then
      raise exception 'You can only report production against your own task.' using errcode = '42501';
    end if;
    if v_task.production_order_id is distinct from v_order.id then
      raise exception 'Task does not belong to the selected production order.' using errcode = '22023';
    end if;
  end if;

  insert into public.production_reports (
    organization_id, production_order_id, task_id, product_id, workstation_id, machine_id,
    shift_id, reported_by_employee_id, work_date, shift_code, batch_no, started_at, ended_at,
    total_produced, good_pieces, rejected_pieces, rework_pieces, downtime_minutes,
    downtime_reason, remarks, evidence_document_id
  ) values (
    v_org,
    v_order.id,
    nullif(p_payload ->> 'taskId', '')::uuid,
    coalesce(nullif(p_payload ->> 'productId', '')::uuid, v_order.product_id),
    nullif(p_payload ->> 'workstationId', '')::uuid,
    nullif(p_payload ->> 'machineId', '')::uuid,
    nullif(p_payload ->> 'shiftId', '')::uuid,
    v_me,
    coalesce((p_payload ->> 'workDate')::date, current_date),
    p_payload ->> 'shiftCode',
    coalesce(p_payload ->> 'batchNo', v_order.batch_no),
    (p_payload ->> 'startedAt')::timestamptz,
    (p_payload ->> 'endedAt')::timestamptz,
    v_total, v_good, v_rejected, v_rework,
    coalesce((p_payload ->> 'downtimeMinutes')::integer, 0),
    p_payload ->> 'downtimeReason',
    p_payload ->> 'remarks',
    nullif(p_payload ->> 'evidenceDocumentId', '')::uuid
  )
  returning * into v_report;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload -> 'materials', '[]'::jsonb))
  loop
    if (v_item ->> 'quantity')::numeric > 0 then
      select * into v_material from public.materials where id = (v_item ->> 'materialId')::uuid;
      if v_material.id is null or v_material.organization_id <> v_org then
        raise exception 'Material not found.' using errcode = 'P0002';
      end if;
      if (v_item ->> 'unit')::public.unit_of_measure <> v_material.unit then
        raise exception 'Material % is measured in %, not %.', v_material.name, v_material.unit, v_item ->> 'unit'
          using errcode = '22023';
      end if;
      insert into public.production_report_materials (organization_id, report_id, material_id, quantity, unit)
      values (v_org, v_report.id, v_material.id, (v_item ->> 'quantity')::numeric, v_material.unit);
      update public.materials
      set stock_quantity = greatest(stock_quantity - (v_item ->> 'quantity')::numeric, 0)
      where id = v_material.id;
    end if;
  end loop;

  if v_task.id is not null then
    select coalesce(sum(good_pieces), 0), coalesce(sum(rejected_pieces), 0)
    into v_done, v_rejected_task
    from public.production_reports
    where task_id = v_task.id and deleted_at is null;

    update public.tasks
    set completed_quantity = v_done, rejected_quantity = v_rejected_task
    where id = v_task.id;
  end if;

  perform public.refresh_production_totals(v_order.id);

  perform public.write_audit(
    'production.reported',
    'production_report',
    v_report.id,
    format('Reported %s pcs (%s good / %s rejected) on order %s', v_total, v_good, v_rejected, v_order.order_no)
  );

  return jsonb_build_object(
    'id', v_report.id,
    'orderId', v_order.id,
    'totalProduced', v_total,
    'goodPieces', v_good,
    'rejectedPieces', v_rejected
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Operator issue reporting
-- ---------------------------------------------------------------------------
create or replace function public.report_technical_issue(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid := public.current_employee_id();
  v_org uuid := public.current_org_id();
  v_employee public.employees;
  v_machine public.machines;
  v_id uuid;
begin
  if not public.has_permission('production.issues.create') then
    raise exception 'You do not have permission to report technical issues.' using errcode = '42501';
  end if;

  select * into v_employee from public.employees where id = v_me;
  select * into v_machine from public.machines where id = (p_payload ->> 'machineId')::uuid;
  if v_machine.id is null or v_machine.organization_id <> v_org then
    raise exception 'Machine not found.' using errcode = 'P0002';
  end if;

  insert into public.technical_issues (
    organization_id, plant_id, department_id, production_line_id, workstation_id, machine_id,
    production_order_id, task_id, reported_by_employee_id, category, description, occurred_at,
    severity, machine_state, downtime_minutes, production_impact
  ) values (
    v_org,
    coalesce(v_machine.plant_id, v_employee.plant_id),
    coalesce(v_machine.department_id, v_employee.department_id),
    (select w.production_line_id from public.workstations w where w.id = v_machine.workstation_id),
    coalesce(nullif(p_payload ->> 'workstationId', '')::uuid, v_machine.workstation_id),
    v_machine.id,
    nullif(p_payload ->> 'productionOrderId', '')::uuid,
    nullif(p_payload ->> 'taskId', '')::uuid,
    v_me,
    coalesce(nullif(trim(p_payload ->> 'category'), ''), 'other'),
    trim(p_payload ->> 'description'),
    coalesce((p_payload ->> 'occurredAt')::timestamptz, now()),
    coalesce((p_payload ->> 'severity')::public.issue_severity, 'medium'),
    coalesce((p_payload ->> 'machineState')::public.machine_state, 'down'),
    coalesce((p_payload ->> 'downtimeMinutes')::integer, 0),
    p_payload ->> 'productionImpact'
  )
  returning id into v_id;

  if v_machine.status is distinct from 'down' then
    update public.machines set status = 'down' where id = v_machine.id;
  end if;

  perform public.write_audit('issue.technical', 'technical_issue', v_id, 'Reported technical issue on ' || v_machine.name);
  return v_id;
end;
$$;

create or replace function public.report_tool_damage(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid := public.current_employee_id();
  v_org uuid := public.current_org_id();
  v_tool public.tools;
  v_id uuid;
begin
  if not public.has_permission('production.issues.create') then
    raise exception 'You do not have permission to report tool damage.' using errcode = '42501';
  end if;

  select * into v_tool from public.tools where id = (p_payload ->> 'toolId')::uuid;
  if v_tool.id is null or v_tool.organization_id <> v_org then
    raise exception 'Tool not found.' using errcode = 'P0002';
  end if;
  if coalesce((p_payload ->> 'damagedQuantity')::numeric, 0) <= 0 then
    raise exception 'Damaged quantity must be greater than zero.' using errcode = '22023';
  end if;

  insert into public.tool_damage_reports (
    organization_id, tool_id, tool_name, machine_id, workstation_id, production_order_id,
    damaged_quantity, unit, damage_category, description, production_impact, reported_by_employee_id
  ) values (
    v_org, v_tool.id, v_tool.name,
    nullif(p_payload ->> 'machineId', '')::uuid,
    nullif(p_payload ->> 'workstationId', '')::uuid,
    nullif(p_payload ->> 'productionOrderId', '')::uuid,
    (p_payload ->> 'damagedQuantity')::numeric,
    v_tool.unit,
    coalesce(nullif(trim(p_payload ->> 'damageCategory'), ''), 'other'),
    trim(p_payload ->> 'description'),
    p_payload ->> 'productionImpact',
    v_me
  )
  returning id into v_id;

  perform public.write_audit('issue.tool_damage', 'tool_damage_report', v_id, 'Reported damage to ' || v_tool.name);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Requests built on the shared Module 01 workflow
-- ---------------------------------------------------------------------------
create or replace function public.request_material(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid := public.current_employee_id();
  v_org uuid := public.current_org_id();
  v_material public.materials;
  v_request public.requests;
  v_unit public.unit_of_measure;
begin
  if not public.has_permission('requests.create') then
    raise exception 'You do not have permission to raise requests.' using errcode = '42501';
  end if;

  select * into v_material from public.materials where id = (p_payload ->> 'materialId')::uuid;
  if v_material.id is null or v_material.organization_id <> v_org then
    raise exception 'Material not found.' using errcode = 'P0002';
  end if;

  v_unit := coalesce((p_payload ->> 'unit')::public.unit_of_measure, v_material.unit);
  if v_unit <> v_material.unit then
    raise exception 'Material % is measured in %; % is not a compatible unit.', v_material.name, v_material.unit, v_unit
      using errcode = '22023';
  end if;

  v_request := public.submit_request(
    'material_requirement',
    coalesce(nullif(trim(p_payload ->> 'title'), ''), 'Material requirement · ' || v_material.name),
    coalesce(p_payload ->> 'reason', 'Material required for production.'),
    null,
    false
  );

  insert into public.material_requests (
    request_id, organization_id, material_id, specification, required_quantity, unit,
    available_quantity, required_by, production_order_id, reason
  ) values (
    v_request.id, v_org, v_material.id,
    coalesce(p_payload ->> 'specification', v_material.specification),
    (p_payload ->> 'requiredQuantity')::numeric,
    v_unit,
    nullif(p_payload ->> 'availableQuantity', '')::numeric,
    nullif(p_payload ->> 'requiredBy', '')::timestamptz,
    nullif(p_payload ->> 'productionOrderId', '')::uuid,
    p_payload ->> 'reason'
  );

  return jsonb_build_object('requestId', v_request.id, 'approverId', v_request.current_approver_id);
end;
$$;

create or replace function public.request_reassignment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid := public.current_employee_id();
  v_org uuid := public.current_org_id();
  v_employee public.employees;
  v_task public.tasks;
  v_proposed public.tasks;
  v_request public.requests;
  v_effective timestamptz := coalesce((p_payload ->> 'effectiveAt')::timestamptz, now());
  v_machine_id uuid;
  v_reason text := nullif(trim(p_payload ->> 'reason'), '');
begin
  if not public.has_permission('reassignment.create') then
    raise exception 'You do not have permission to propose reassignments.' using errcode = '42501';
  end if;
  if v_reason is null or length(v_reason) < 5 then
    raise exception 'A reassignment reason is required.' using errcode = '22023';
  end if;

  select * into v_employee from public.employees
  where id = (p_payload ->> 'employeeId')::uuid and organization_id = v_org and deleted_at is null;
  if v_employee.id is null then
    raise exception 'Employee not found.' using errcode = 'P0002';
  end if;
  -- A supervisor may only propose moves for employees they actually manage.
  if not (public.is_manager_of(v_employee.id) or public.is_admin()) then
    raise exception 'Reassignment scope: you can only propose moves for your own team.' using errcode = '42501';
  end if;

  -- Availability: an employee on approved leave or absent cannot be reassigned.
  if exists (
    select 1 from public.leave_records l
    where l.employee_id = v_employee.id
      and l.status = 'approved'
      and v_effective::date between l.start_date and l.end_date
  ) then
    raise exception '% is on approved leave for the proposed effective date.', v_employee.full_name using errcode = '22023';
  end if;
  if v_employee.employment_status <> 'active' then
    raise exception '% is not in an active employment status (%).', v_employee.full_name, v_employee.employment_status
      using errcode = '22023';
  end if;

  if nullif(p_payload ->> 'currentTaskId', '') is not null then
    select * into v_task from public.tasks where id = (p_payload ->> 'currentTaskId')::uuid;
    if v_task.id is null or v_task.assignee_employee_id <> v_employee.id then
      raise exception 'Current task is not assigned to this employee.' using errcode = '22023';
    end if;
  end if;

  if nullif(p_payload ->> 'proposedTaskId', '') is not null then
    select * into v_proposed from public.tasks where id = (p_payload ->> 'proposedTaskId')::uuid;
    if v_proposed.id is null then
      raise exception 'Proposed task not found.' using errcode = 'P0002';
    end if;
    if v_proposed.assignee_employee_id is not null and v_proposed.assignee_employee_id <> v_employee.id then
      raise exception 'Proposed task is already assigned to another employee.' using errcode = '22023';
    end if;
    v_machine_id := coalesce(v_proposed.machine_id, null);
  end if;
  v_machine_id := coalesce(v_machine_id, nullif(p_payload ->> 'proposedMachineId', '')::uuid);

  -- Machine authorization gate.
  if v_machine_id is not null and not exists (
    select 1 from public.employee_machine_authorizations a
    where a.employee_id = v_employee.id
      and a.machine_id = v_machine_id
      and (a.expires_on is null or a.expires_on >= v_effective::date)
  ) then
    raise exception '% is not authorised to operate the proposed machine.', v_employee.full_name using errcode = '42501';
  end if;

  -- Competency gate for the proposed task.
  if v_proposed.id is not null then
    if v_proposed.required_skill_id is not null and not exists (
      select 1 from public.employee_skills s
      where s.employee_id = v_employee.id and s.skill_id = v_proposed.required_skill_id
    ) then
      raise exception 'Proposed task requires a skill % does not hold.', v_employee.full_name using errcode = '22023';
    end if;
    if v_proposed.required_certification_id is not null and not exists (
      select 1 from public.employee_certifications c
      where c.employee_id = v_employee.id
        and c.certification_id = v_proposed.required_certification_id
        and c.status = 'verified'
        and (c.expires_on is null or c.expires_on >= v_effective::date)
    ) then
      raise exception 'Proposed task requires a valid certification % does not hold.', v_employee.full_name using errcode = '22023';
    end if;

    -- Working hours: the proposed task must fall inside the proposed shift.
    if nullif(p_payload ->> 'proposedShiftId', '') is not null then
      if not exists (
        select 1 from public.shifts s
        where s.id = (p_payload ->> 'proposedShiftId')::uuid and s.is_active
      ) then
        raise exception 'Proposed shift not found or inactive.' using errcode = 'P0002';
      end if;
      if exists (
        select 1 from public.shifts s
        where s.id = (p_payload ->> 'proposedShiftId')::uuid
          and v_proposed.planned_start_at is not null
          and v_proposed.planned_end_at is not null
          and v_proposed.planned_end_at - v_proposed.planned_start_at > interval '12 hours'
      ) then
        raise exception 'Proposed task exceeds the 12 hour working limit.' using errcode = '22023';
      end if;
    end if;
  end if;

  -- Shift overlap: the employee must not already hold an overlapping assignment.
  if nullif(p_payload ->> 'proposedShiftId', '') is not null then
    if exists (
      select 1
      from public.employee_shift_assignments a
      where a.employee_id = v_employee.id
        and a.status = 'active'
        and a.shift_id <> (p_payload ->> 'proposedShiftId')::uuid
        and a.effective_from <= v_effective::date
        and (a.effective_to is null or a.effective_to >= v_effective::date)
    ) then
      raise exception 'Shift overlap: % already has a different active shift for that date.', v_employee.full_name
        using errcode = '22023';
    end if;
  end if;

  v_request := public.submit_request(
    'reassignment',
    coalesce(nullif(trim(p_payload ->> 'title'), ''), 'Reassignment · ' || v_employee.full_name),
    v_reason,
    null,
    false
  );

  insert into public.reassignment_requests (
    request_id, organization_id, employee_id, current_task_id, proposed_task_id,
    current_workstation_id, proposed_workstation_id, current_shift_id, proposed_shift_id,
    current_assignment_snapshot, proposed_assignment_snapshot, competency_requirements,
    reason, effective_at, created_by_employee_id
  ) values (
    v_request.id, v_org, v_employee.id,
    nullif(p_payload ->> 'currentTaskId', '')::uuid,
    nullif(p_payload ->> 'proposedTaskId', '')::uuid,
    nullif(p_payload ->> 'currentWorkstationId', '')::uuid,
    nullif(p_payload ->> 'proposedWorkstationId', '')::uuid,
    nullif(p_payload ->> 'currentShiftId', '')::uuid,
    nullif(p_payload ->> 'proposedShiftId', '')::uuid,
    jsonb_build_object(
      'taskId', p_payload ->> 'currentTaskId',
      'workstationId', p_payload ->> 'currentWorkstationId',
      'shiftId', p_payload ->> 'currentShiftId'
    ),
    jsonb_build_object(
      'taskId', p_payload ->> 'proposedTaskId',
      'workstationId', p_payload ->> 'proposedWorkstationId',
      'shiftId', p_payload ->> 'proposedShiftId'
    ),
    p_payload ->> 'competencyRequirements',
    v_reason,
    v_effective,
    v_me
  );

  return jsonb_build_object('requestId', v_request.id, 'approverId', v_request.current_approver_id);
end;
$$;

-- Applying an approved reassignment is a side effect of the shared workflow.
create or replace function public.apply_approved_reassignment()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_detail public.reassignment_requests;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' and new.request_type = 'reassignment' then
    select * into v_detail from public.reassignment_requests where request_id = new.id for update;
    if v_detail.request_id is not null and v_detail.status <> 'applied' then
      if v_detail.proposed_task_id is not null then
        update public.tasks
        set assignee_employee_id = v_detail.employee_id,
            workstation_id = coalesce(v_detail.proposed_workstation_id, workstation_id)
        where id = v_detail.proposed_task_id;
      end if;
      if v_detail.current_task_id is not null and v_detail.current_task_id <> coalesce(v_detail.proposed_task_id, '00000000-0000-0000-0000-000000000000'::uuid) then
        update public.tasks
        set production_status = 'cancelled',
            status = 'cancelled',
            production_cancelled_at = now()
        where id = v_detail.current_task_id
          and production_status not in ('completed', 'cancelled');
      end if;
      if v_detail.proposed_shift_id is not null then
        update public.employee_shift_assignments set effective_to = (v_detail.effective_at::date - 1)
        where employee_id = v_detail.employee_id and effective_to is null and shift_id is distinct from v_detail.proposed_shift_id;
        insert into public.employee_shift_assignments (employee_id, shift_id, effective_from, status)
        values (v_detail.employee_id, v_detail.proposed_shift_id, v_detail.effective_at::date, 'planned')
        on conflict do nothing;
      end if;

      update public.reassignment_requests
      set status = 'applied',
          approved_by_employee_id = coalesce(approved_by_employee_id, public.current_employee_id()),
          decided_at = coalesce(decided_at, now()),
          applied_at = now()
      where request_id = new.id;

      perform public.create_notification(
        v_detail.organization_id,
        v_detail.employee_id,
        'Reassignment approved',
        'Your reassignment takes effect ' || to_char(v_detail.effective_at, 'DD Mon YYYY HH24:MI') || '.',
        'people',
        '/operator'
      );
      perform public.write_audit('reassignment.applied', 'reassignment_request', v_detail.request_id,
        'Reassignment applied for employee ' || v_detail.employee_id);
    end if;
  elsif new.status = 'rejected' and new.request_type = 'reassignment' then
    update public.reassignment_requests
    set status = 'rejected',
        approved_by_employee_id = public.current_employee_id(),
        decided_at = now(),
        decision_notes = new.decision_notes
    where request_id = new.id and status = 'submitted';
  end if;
  return new;
end;
$$;

drop trigger if exists requests_apply_reassignment on public.requests;
create trigger requests_apply_reassignment
after update of status on public.requests
for each row execute function public.apply_approved_reassignment();

-- ---------------------------------------------------------------------------
-- Shift completion and handover
-- ---------------------------------------------------------------------------
create or replace function public.submit_shift_report(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid := public.current_employee_id();
  v_org uuid := public.current_org_id();
  v_employee public.employees;
  v_id uuid;
  v_task uuid;
  v_total numeric := coalesce((p_payload ->> 'totalProduced')::numeric, 0);
  v_good numeric := coalesce((p_payload ->> 'goodPieces')::numeric, 0);
  v_rejected numeric := coalesce((p_payload ->> 'rejectedPieces')::numeric, 0);
begin
  if not public.has_permission('handover.submit') then
    raise exception 'You do not have permission to submit shift reports.' using errcode = '42501';
  end if;
  if v_total <> v_good + v_rejected then
    raise exception 'Shift totals must balance: total produced = good + rejected.' using errcode = '22023';
  end if;
  if coalesce(trim(p_payload ->> 'handoverNotes'), '') = '' then
    raise exception 'Handover notes are required.' using errcode = '22023';
  end if;

  select * into v_employee from public.employees where id = v_me;

  insert into public.shift_reports (
    organization_id, employee_id, shift_id, production_order_id, work_date, shift_code,
    tasks_completed, total_produced, good_pieces, rejected_pieces, machine_issue_count,
    tool_issue_count, material_shortage_count, remaining_work, handover_notes
  ) values (
    v_org, v_me,
    nullif(p_payload ->> 'shiftId', '')::uuid,
    nullif(p_payload ->> 'productionOrderId', '')::uuid,
    coalesce((p_payload ->> 'workDate')::date, current_date),
    p_payload ->> 'shiftCode',
    coalesce((p_payload ->> 'tasksCompleted')::integer, 0),
    v_total, v_good, v_rejected,
    coalesce((p_payload ->> 'machineIssueCount')::integer, 0),
    coalesce((p_payload ->> 'toolIssueCount')::integer, 0),
    coalesce((p_payload ->> 'materialShortageCount')::integer, 0),
    p_payload ->> 'remainingWork',
    trim(p_payload ->> 'handoverNotes')
  )
  returning id into v_id;

  for v_task in select (value #>> '{}')::uuid from jsonb_array_elements(coalesce(p_payload -> 'taskIds', '[]'::jsonb))
  loop
    insert into public.shift_report_tasks (report_id, task_id) values (v_id, v_task) on conflict do nothing;
  end loop;

  if v_employee.reporting_manager_id is not null then
    perform public.create_notification(
      v_org, v_employee.reporting_manager_id,
      'Shift report submitted',
      v_employee.full_name || ' submitted a handover for ' || to_char(current_date, 'DD Mon YYYY') || '.',
      'schedule', '/supervisor/handover'
    );
  end if;

  perform public.write_audit('shift.report', 'shift_report', v_id, 'Shift completion report submitted');
  return v_id;
end;
$$;

create or replace function public.acknowledge_shift_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_report public.shift_reports;
begin
  if not public.has_permission('handover.read') then
    raise exception 'You do not have permission to acknowledge handovers.' using errcode = '42501';
  end if;
  select * into v_report from public.shift_reports where id = p_report_id;
  if v_report.id is null then
    raise exception 'Shift report not found.' using errcode = 'P0002';
  end if;
  if v_report.employee_id = public.current_employee_id() then
    raise exception 'You cannot acknowledge your own handover.' using errcode = '42501';
  end if;
  update public.shift_reports
  set status = 'acknowledged', acknowledged_by_employee_id = public.current_employee_id(), acknowledged_at = now()
  where id = p_report_id;
  perform public.write_audit('shift.acknowledged', 'shift_report', p_report_id, 'Handover acknowledged');
end;
$$;

-- ---------------------------------------------------------------------------
-- Machine program revision control
-- ---------------------------------------------------------------------------
create or replace function public.register_program_version(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid := public.current_employee_id();
  v_org uuid := public.current_org_id();
  v_program public.machine_programs;
  v_version integer;
  v_id uuid;
begin
  if not public.has_permission('programs.manage') then
    raise exception 'You do not have permission to register machine programs.' using errcode = '42501';
  end if;

  select * into v_program from public.machine_programs
  where id = (p_payload ->> 'programId')::uuid and organization_id = v_org and deleted_at is null;
  if v_program.id is null then
    raise exception 'Machine program not found.' using errcode = 'P0002';
  end if;
  if coalesce(trim(p_payload ->> 'changeSummary'), '') = '' then
    raise exception 'A change summary is required for every program version.' using errcode = '22023';
  end if;

  -- Versions are monotonic per program. An approved version is never edited;
  -- the new row supersedes it once it is approved in turn.
  select coalesce(max(version), 0) + 1 into v_version
  from public.machine_program_versions where program_id = v_program.id;

  insert into public.machine_program_versions (
    organization_id, program_id, version, status, storage_path, file_name, mime_type,
    size_bytes, checksum, change_summary, revision_notes, production_order_id,
    created_by_employee_id, submitted_at
  ) values (
    v_org, v_program.id, v_version, 'draft',
    p_payload ->> 'storagePath', p_payload ->> 'fileName', p_payload ->> 'mimeType',
    nullif(p_payload ->> 'sizeBytes', '')::bigint, p_payload ->> 'checksum',
    trim(p_payload ->> 'changeSummary'), p_payload ->> 'revisionNotes',
    nullif(p_payload ->> 'productionOrderId', '')::uuid,
    v_me, now()
  )
  returning id into v_id;

  perform public.write_audit('program.version_registered', 'machine_program_version', v_id,
    'Registered version ' || v_version || ' of ' || v_program.name);
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create or replace function public.decide_program_version(
  p_version_id uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me uuid := public.current_employee_id();
  v_version public.machine_program_versions;
  v_program public.machine_programs;
  v_previous public.machine_program_versions;
begin
  if not public.has_permission('programs.approve') then
    raise exception 'You do not have permission to approve machine programs.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;

  select * into v_version from public.machine_program_versions where id = p_version_id for update;
  if v_version.id is null then
    raise exception 'Program version not found.' using errcode = 'P0002';
  end if;
  if v_version.organization_id <> public.current_org_id() then
    raise exception 'Program version belongs to another organization.' using errcode = '42501';
  end if;
  if v_version.status = 'approved' then
    raise exception 'This version is already approved and cannot be re-decided.' using errcode = '42501';
  end if;
  -- Independent review: a programmer cannot approve their own version.
  if v_version.created_by_employee_id = v_me then
    raise exception 'Segregation of duties: the author cannot approve their own program version.' using errcode = '42501';
  end if;

  select * into v_program from public.machine_programs where id = v_version.program_id;

  if p_decision = 'rejected' then
    update public.machine_program_versions
    set status = 'rejected', approved_by_employee_id = v_me, approved_at = now(), decision_notes = p_notes
    where id = p_version_id;
    perform public.write_audit('program.version_rejected', 'machine_program_version', p_version_id,
      'Rejected version ' || v_version.version || ' of ' || v_program.name);
    return jsonb_build_object('id', p_version_id, 'status', 'rejected');
  end if;

  select * into v_previous from public.machine_program_versions
  where program_id = v_program.id and status = 'approved'
  order by version desc limit 1;

  update public.machine_program_versions
  set status = 'approved', approved_by_employee_id = v_me, approved_at = now(), decision_notes = p_notes
  where id = p_version_id;

  if v_previous.id is not null then
    update public.machine_program_versions
    set status = 'superseded', superseded_by_version_id = p_version_id
    where id = v_previous.id;
  end if;

  update public.machine_programs
  set status = 'approved', current_version = v_version.version, approved_version_id = p_version_id
  where id = v_program.id;

  perform public.write_audit('program.version_approved', 'machine_program_version', p_version_id,
    'Approved version ' || v_version.version || ' of ' || v_program.name);

  return jsonb_build_object('id', p_version_id, 'status', 'approved', 'version', v_version.version);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: executable surface only. Tables stay behind RLS.
-- ---------------------------------------------------------------------------
grant execute on function public.production_task_transition(uuid, public.production_task_status, text) to authenticated;
grant execute on function public.start_production_task(uuid) to authenticated;
grant execute on function public.pause_production_task(uuid, text) to authenticated;
grant execute on function public.resume_production_task(uuid) to authenticated;
grant execute on function public.complete_production_task(uuid, text) to authenticated;
grant execute on function public.record_production_report(jsonb) to authenticated;
grant execute on function public.report_technical_issue(jsonb) to authenticated;
grant execute on function public.report_tool_damage(jsonb) to authenticated;
grant execute on function public.request_material(jsonb) to authenticated;
grant execute on function public.request_reassignment(jsonb) to authenticated;
grant execute on function public.submit_shift_report(jsonb) to authenticated;
grant execute on function public.acknowledge_shift_report(uuid) to authenticated;
grant execute on function public.register_program_version(jsonb) to authenticated;
grant execute on function public.decide_program_version(uuid, text, text) to authenticated;
grant execute on function public.refresh_production_totals(uuid) to authenticated;
