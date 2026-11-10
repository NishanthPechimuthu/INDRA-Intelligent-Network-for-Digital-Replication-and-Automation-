-- INDRA Platform Foundation · Module 02 seed
-- Workforce and production operations: permissions, role grants, approval
-- routing, master data and a working demo of an operator shift.
--
-- Run after seed.sql (and seed-auth.sql when the demo logins are wanted).

-- ---------------------------------------------------------------------------
-- Permissions introduced by Module 02
-- ---------------------------------------------------------------------------
insert into public.permissions (key, module, action, description) values
  ('production.orders.read', 'production', 'orders.read', 'View production orders'),
  ('production.orders.manage', 'production', 'orders.manage', 'Plan and release production orders'),
  ('production.reports.read', 'production', 'reports.read', 'View production reporting for the team or plant'),
  ('production.reports.create', 'production', 'reports.create', 'Record production output and defects'),
  ('production.reports.manage', 'production', 'reports.manage', 'Correct or remove production reports'),
  ('production.issues.create', 'production', 'issues.create', 'Report technical, tool and material issues'),
  ('production.issues.read', 'production', 'issues.read', 'View operational issues in scope'),
  ('production.issues.manage', 'production', 'issues.manage', 'Resolve and close operational issues'),
  ('materials.read', 'materials', 'read', 'View material master and stock'),
  ('materials.manage', 'materials', 'manage', 'Maintain material master and stock levels'),
  ('tools.read', 'tools', 'read', 'View tooling register'),
  ('tools.manage', 'tools', 'manage', 'Maintain tooling register'),
  ('handover.read', 'handover', 'read', 'Review shift completion and handover reports'),
  ('handover.submit', 'handover', 'submit', 'Submit shift completion and handover reports'),
  ('reassignment.create', 'reassignment', 'create', 'Propose employee reassignments'),
  ('reassignment.approve', 'reassignment', 'approve', 'Approve or reject reassignment proposals'),
  ('programs.read', 'programs', 'read', 'View machine programs and revision history'),
  ('programs.manage', 'programs', 'manage', 'Register machine program versions and evidence'),
  ('programs.approve', 'programs', 'approve', 'Approve machine program versions'),
  ('safety.report', 'safety', 'report', 'Report safety incidents'),
  ('safety.operational.read', 'safety', 'operational.read', 'View operational safety information for the team'),
  ('safety.medical.read', 'safety', 'medical.read', 'View restricted occupational health detail'),
  ('workforce.team.read', 'workforce', 'team.read', 'View assigned team, availability and workload')
on conflict (key) do update set module = excluded.module, action = excluded.action, description = excluded.description;

-- ---------------------------------------------------------------------------
-- Role grants
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'operator'
  and p.key in ('production.orders.read', 'production.reports.create', 'production.reports.read',
                'production.issues.create', 'materials.read', 'tools.read', 'handover.submit',
                'programs.read', 'safety.report')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'supervisor'
  and p.key in ('production.orders.read', 'production.orders.manage', 'production.reports.read',
                'production.reports.create', 'production.issues.create', 'production.issues.read',
                'production.issues.manage', 'materials.read', 'materials.manage', 'tools.read',
                'handover.read', 'handover.submit', 'reassignment.create', 'programs.read',
                'safety.report', 'safety.operational.read', 'workforce.team.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'programmer'
  and p.key in ('production.orders.read', 'production.reports.read', 'production.issues.read',
                'materials.read', 'tools.read', 'programs.read', 'programs.manage', 'safety.report')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'hod'
  and p.key in ('production.orders.read', 'production.orders.manage', 'production.reports.read',
                'production.reports.manage', 'production.issues.read', 'production.issues.manage',
                'materials.read', 'materials.manage', 'tools.read', 'tools.manage',
                'handover.read', 'reassignment.create', 'reassignment.approve',
                'programs.read', 'programs.approve', 'safety.report', 'safety.operational.read',
                'workforce.team.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'plant_head'
  and p.key in ('production.orders.read', 'production.orders.manage', 'production.reports.read',
                'production.reports.manage', 'production.issues.read', 'production.issues.manage',
                'materials.read', 'materials.manage', 'tools.read', 'tools.manage',
                'handover.read', 'reassignment.create', 'reassignment.approve',
                'programs.read', 'programs.approve', 'programs.manage',
                'safety.report', 'safety.operational.read', 'safety.medical.read',
                'workforce.team.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key in ('quality_engineer', 'technical_analyst', 'material_analyst', 'verification_engineer', 'technical_assistant', 'resource_analyst', 'hr_analyst', 'ehs_officer')
  and p.key in ('production.orders.read', 'production.reports.read', 'production.issues.read',
                'materials.read', 'tools.read', 'handover.read', 'programs.read', 'workforce.team.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'quality_engineer'
  and p.key in ('production.issues.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'ehs_officer'
  and p.key in ('safety.report', 'safety.operational.read', 'safety.medical.read', 'production.issues.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'hr_analyst'
  and p.key in ('safety.medical.read', 'reassignment.approve', 'handover.read')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.organization_id = '11111111-1111-1111-1111-111111111111' and r.key = 'administrator'
  and p.module in ('production', 'materials', 'tools', 'handover', 'reassignment', 'programs', 'safety', 'workforce')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Approval routing for the new request types
-- ---------------------------------------------------------------------------
insert into public.approval_authorities (id, organization_id, scope_type, scope_id, request_type, role_id, level, threshold_amount, self_approval_allowed, can_delegate)
values
  ('f5555555-5555-5555-5555-555555555561', '11111111-1111-1111-1111-111111111111', 'department', '11111111-1111-1111-1111-111111111401', 'reassignment', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'hod'), 1, null, false, true),
  ('f5555555-5555-5555-5555-555555555562', '11111111-1111-1111-1111-111111111111', 'department', '11111111-1111-1111-1111-111111111401', 'material_requirement', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'hod'), 1, null, false, true),
  ('f5555555-5555-5555-5555-555555555563', '11111111-1111-1111-1111-111111111111', 'department', '11111111-1111-1111-1111-111111111401', 'tool_request', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'hod'), 1, null, false, true),
  ('f5555555-5555-5555-5555-555555555564', '11111111-1111-1111-1111-111111111111', 'department', '11111111-1111-1111-1111-111111111401', 'manpower_request', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'hod'), 1, null, false, true),
  ('f5555555-5555-5555-5555-555555555565', '11111111-1111-1111-1111-111111111111', 'plant', '11111111-1111-1111-1111-111111111101', 'technical_repair', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'plant_head'), 1, null, false, true),
  ('f5555555-5555-5555-5555-555555555566', '11111111-1111-1111-1111-111111111111', 'plant', '11111111-1111-1111-1111-111111111101', 'equipment_request', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'plant_head'), 1, null, false, true),
  ('f5555555-5555-5555-5555-555555555567', '11111111-1111-1111-1111-111111111111', 'plant', '11111111-1111-1111-1111-111111111101', 'program_modification', (select id from public.roles where organization_id = '11111111-1111-1111-1111-111111111111' and key = 'plant_head'), 1, null, false, true)
on conflict (id) do update set request_type = excluded.request_type, role_id = excluded.role_id;

-- ---------------------------------------------------------------------------
-- Master data
-- ---------------------------------------------------------------------------
insert into public.products (id, organization_id, code, name, description, unit, specification, standard_cycle_seconds)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', '11111111-1111-1111-1111-111111111111', 'PRD-AXLE-01', 'Front axle housing', 'Machined axle housing for medium commercial vehicle.', 'pcs', 'IS 210 / Grade FG260', 240),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02', '11111111-1111-1111-1111-111111111111', 'PRD-BRKT-02', 'Weldment bracket', 'Robot welded mounting bracket.', 'pcs', 'EN 10025 S355', 96),
  ('cccccccc-cccc-cccc-cccc-cccccccccc03', '11111111-1111-1111-1111-111111111111', 'PRD-SHAFT-03', 'Drive shaft', 'Turned and ground drive shaft.', 'pcs', '42CrMo4', 310)
on conflict (id) do update set name = excluded.name, specification = excluded.specification, standard_cycle_seconds = excluded.standard_cycle_seconds;

insert into public.materials (id, organization_id, code, name, specification, unit, category, stock_quantity, reorder_level, unit_cost)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccd01', '11111111-1111-1111-1111-111111111111', 'MAT-ALB-01', 'Aluminium bar 80mm', '6061-T6 extruded bar', 'kg', 'raw', 1420.000, 400.000, 312.50),
  ('cccccccc-cccc-cccc-cccc-cccccccccd02', '11111111-1111-1111-1111-111111111111', 'MAT-CLT-02', 'Cutting coolant', 'Water soluble semi-synthetic', 'l', 'consumable', 380.000, 120.000, 148.00),
  ('cccccccc-cccc-cccc-cccc-cccccccccd03', '11111111-1111-1111-1111-111111111111', 'MAT-BLT-03', 'M8 flange bolt', 'Zinc plated, 30mm', 'pcs', 'consumable', 12400.000, 3000.000, 3.20),
  ('cccccccc-cccc-cccc-cccc-cccccccccd04', '11111111-1111-1111-1111-111111111111', 'MAT-WIR-04', 'Welding wire 1.2mm', 'Copper coated G3Si1', 'kg', 'consumable', 240.000, 80.000, 210.00)
on conflict (id) do update set stock_quantity = excluded.stock_quantity, reorder_level = excluded.reorder_level, unit_cost = excluded.unit_cost;

insert into public.tools (id, organization_id, plant_id, code, name, tool_type, unit, quantity_in_service, status, machine_id)
values
  ('cccccccc-cccc-cccc-cccc-ccccccccce01', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'TL-CBN-01', 'Carbide boring bar', 'cutting', 'pcs', 6, 'in_service', '11111111-1111-1111-1111-111111111701'),
  ('cccccccc-cccc-cccc-cccc-ccccccccce02', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'TL-TOR-02', 'Torque wrench 200Nm', 'assembly', 'pcs', 2, 'in_service', '11111111-1111-1111-1111-111111111702')
on conflict (id) do update set quantity_in_service = excluded.quantity_in_service, status = excluded.status;

insert into public.employee_machine_authorizations (id, organization_id, employee_id, machine_id, authorized_on, expires_on, authorized_by_employee_id)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc80', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', '11111111-1111-1111-1111-111111111701', current_date - 120, current_date + 245, '11111111-1111-1111-1111-111111111801'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc81', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', '11111111-1111-1111-1111-111111111702', current_date - 120, current_date + 245, '11111111-1111-1111-1111-111111111801'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc82', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', '11111111-1111-1111-1111-111111111704', current_date - 60, null, '11111111-1111-1111-1111-111111111801')
on conflict (employee_id, machine_id) do update set expires_on = excluded.expires_on;

-- ---------------------------------------------------------------------------
-- Production orders and assigned work
-- ---------------------------------------------------------------------------
insert into public.production_orders (id, organization_id, plant_id, department_id, production_line_id, project_id, product_id, order_no, batch_no, quantity_planned, quantity_completed, quantity_rejected, priority, status, planned_start_at, planned_end_at, released_at, notes, created_by_employee_id)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccf01', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111502', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'cccccccc-cccc-cccc-cccc-cccccccccc01', 'PO-2026-0141', 'B-2026-0141-A', 500, 46, 3, 'high', 'in_progress', date_trunc('day', now()) + interval '6 hours', date_trunc('day', now()) + interval '14 hours', now() - interval '2 days', 'Axle housing batch for the OEE recovery programme.', '11111111-1111-1111-1111-111111111801'),
  ('cccccccc-cccc-cccc-cccc-cccccccccf02', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111501', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'cccccccc-cccc-cccc-cccc-cccccccccc02', 'PO-2026-0142', 'B-2026-0142-A', 300, 22, 1, 'medium', 'paused', date_trunc('day', now()) + interval '6 hours', date_trunc('day', now()) + interval '22 hours', now() - interval '1 days', 'Bracket weldment for the assembly twin build.', '11111111-1111-1111-1111-111111111801'),
  ('cccccccc-cccc-cccc-cccc-cccccccccf03', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111502', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'cccccccc-cccc-cccc-cccc-cccccccccc03', 'PO-2026-0139', 'B-2026-0139-B', 120, 40, 2, 'low', 'completed', date_trunc('day', now()) - interval '2 days', date_trunc('day', now()) - interval '1 days', now() - interval '3 days', 'Drive shaft pilot batch, closed.', '11111111-1111-1111-1111-111111111801')
on conflict (id) do update set status = excluded.status, quantity_completed = excluded.quantity_completed,
  quantity_rejected = excluded.quantity_rejected, notes = excluded.notes;

insert into public.tasks (
  id, organization_id, assignee_employee_id, created_by_employee_id, supervisor_employee_id,
  project_id, production_order_id, workstation_id, machine_id, title, description, status,
  priority, due_at, work_instructions, production_status, target_quantity, completed_quantity,
  rejected_quantity, planned_start_at, planned_end_at, started_at, accepted_at
)
values
  ('cccccccc-cccc-cccc-cccc-ccccccccca01', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111801', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'cccccccc-cccc-cccc-cccc-cccccccccf01', '11111111-1111-1111-1111-111111111604', '11111111-1111-1111-1111-111111111701', 'Turn axle housing batch A', 'Rough and finish turn 120 axle housings on CNC Lathe 01.','in_progress', 'high', date_trunc('day', now()) + interval '14 hours', '1. Load bar stock per setup sheet CNC-01.\n2. Verify first-off against drawing AX-114 rev C.\n3. Record every rejected piece with the defect code.', 'in_progress', 120, 46, 3, date_trunc('day', now()) + interval '6 hours', date_trunc('day', now()) + interval '14 hours', now() - interval '3 hours', now() - interval '4 hours'),
  ('cccccccc-cccc-cccc-cccc-ccccccccca02', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111801', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'cccccccc-cccc-cccc-cccc-cccccccccf02', '11111111-1111-1111-1111-111111111602', '11111111-1111-1111-1111-111111111702', 'Weld bracket lot 0142', 'Robot weld 80 brackets after the fixture change.','todo', 'medium', date_trunc('day', now()) + interval '22 hours', 'Check robot program O2201 rev 2 is loaded before starting.', 'assigned', 80, 0, 0, date_trunc('day', now()) + interval '14 hours', date_trunc('day', now()) + interval '22 hours', null, null),
  ('cccccccc-cccc-cccc-cccc-ccccccccca03', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111801', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'cccccccc-cccc-cccc-cccc-cccccccccf01', '11111111-1111-1111-1111-111111111605', '11111111-1111-1111-1111-111111111701', 'Grind bearing journal', 'Grind journals for the axle batch.','blocked', 'high', date_trunc('day', now()) + interval '18 hours', 'Dress the wheel before the first pass.', 'paused', 60, 22, 1, date_trunc('day', now()) + interval '10 hours', date_trunc('day', now()) + interval '18 hours', now() - interval '6 hours', now() - interval '7 hours'),
  ('cccccccc-cccc-cccc-cccc-ccccccccca04', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111801', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'cccccccc-cccc-cccc-cccc-cccccccccf03', '11111111-1111-1111-1111-111111111603', '11111111-1111-1111-1111-111111111704', 'Inspect drive shaft pilot batch', 'CMM inspection of the 40 piece pilot batch.','done', 'low', date_trunc('day', now()) - interval '1 days', 'Record roundness and runout for each piece.', 'completed', 40, 40, 2, date_trunc('day', now()) - interval '2 days', date_trunc('day', now()) - interval '1 days', date_trunc('day', now()) - interval '2 days', date_trunc('day', now()) - interval '2 days')
on conflict (id) do update set production_status = excluded.production_status, status = excluded.status,
  completed_quantity = excluded.completed_quantity, rejected_quantity = excluded.rejected_quantity,
  work_instructions = excluded.work_instructions, machine_id = excluded.machine_id;

insert into public.task_events (id, organization_id, task_id, employee_id, event, reason, created_at)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccb90', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-ccccccccca01', '11111111-1111-1111-1111-111111111803', 'accepted', null, now() - interval '4 hours'),
  ('cccccccc-cccc-cccc-cccc-cccccccccb91', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-ccccccccca01', '11111111-1111-1111-1111-111111111803', 'in_progress', null, now() - interval '3 hours'),
  ('cccccccc-cccc-cccc-cccc-cccccccccb92', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-ccccccccca03', '11111111-1111-1111-1111-111111111803', 'paused', 'Awaiting M8 flange bolts from stores.', now() - interval '5 hours')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Production reporting
-- ---------------------------------------------------------------------------
insert into public.production_reports (id, organization_id, production_order_id, task_id, product_id, workstation_id, machine_id, shift_id, reported_by_employee_id, work_date, shift_code, batch_no, started_at, ended_at, total_produced, good_pieces, rejected_pieces, rework_pieces, downtime_minutes, downtime_reason, remarks)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccb01', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccf01', 'cccccccc-cccc-cccc-cccc-ccccccccca01', 'cccccccc-cccc-cccc-cccc-cccccccccc01', '11111111-1111-1111-1111-111111111604', '11111111-1111-1111-1111-111111111701', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '11111111-1111-1111-1111-111111111803', current_date, 'EARLY', 'B-2026-0141-A', date_trunc('day', now()) + interval '6 hours', date_trunc('day', now()) + interval '10 hours', 32, 30, 2, 1, 12, 'Coolant pressure drop', 'First half of the shift.'),
  ('cccccccc-cccc-cccc-cccc-cccccccccb02', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccf01', 'cccccccc-cccc-cccc-cccc-ccccccccca01', 'cccccccc-cccc-cccc-cccc-cccccccccc01', '11111111-1111-1111-1111-111111111604', '11111111-1111-1111-1111-111111111701', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '11111111-1111-1111-1111-111111111803', current_date, 'EARLY', 'B-2026-0141-A', date_trunc('day', now()) + interval '10 hours', date_trunc('day', now()) + interval '14 hours', 17, 16, 1, 0, 0, null, 'Second entry after lunch.'),
  ('cccccccc-cccc-cccc-cccc-cccccccccb03', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccf03', 'cccccccc-cccc-cccc-cccc-ccccccccca04', 'cccccccc-cccc-cccc-cccc-cccccccccc03', '11111111-1111-1111-1111-111111111603', '11111111-1111-1111-1111-111111111704', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '11111111-1111-1111-1111-111111111803', current_date - 1, 'EARLY', 'B-2026-0139-B', date_trunc('day', now()) - interval '1 days' + interval '6 hours', date_trunc('day', now()) - interval '1 days' + interval '14 hours', 42, 40, 2, 0, 20, 'CMM probe calibration', 'Pilot batch closed with two rejects for runout.')
on conflict (id) do update set total_produced = excluded.total_produced, good_pieces = excluded.good_pieces,
  rejected_pieces = excluded.rejected_pieces, rework_pieces = excluded.rework_pieces;

insert into public.production_report_materials (id, organization_id, report_id, material_id, quantity, unit)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccb20', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccb01', 'cccccccc-cccc-cccc-cccc-cccccccccd01', 96.000, 'kg'),
  ('cccccccc-cccc-cccc-cccc-cccccccccb21', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccb01', 'cccccccc-cccc-cccc-cccc-cccccccccd02', 3.500, 'l'),
  ('cccccccc-cccc-cccc-cccc-cccccccccb22', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccb02', 'cccccccc-cccc-cccc-cccc-cccccccccd01', 51.000, 'kg'),
  ('cccccccc-cccc-cccc-cccc-cccccccccb23', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccb03', 'cccccccc-cccc-cccc-cccc-cccccccccd03', 160.000, 'pcs')
on conflict (id) do update set quantity = excluded.quantity;

-- ---------------------------------------------------------------------------
-- Issues, safety and handover
-- ---------------------------------------------------------------------------
insert into public.technical_issues (id, organization_id, plant_id, department_id, production_line_id, workstation_id, machine_id, production_order_id, task_id, reported_by_employee_id, category, description, occurred_at, severity, machine_state, downtime_minutes, production_impact, status, assigned_to_employee_id)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc10', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111502', '11111111-1111-1111-1111-111111111604', '11111111-1111-1111-1111-111111111701', 'cccccccc-cccc-cccc-cccc-cccccccccf01', 'cccccccc-cccc-cccc-cccc-ccccccccca01', '11111111-1111-1111-1111-111111111803', 'Hydraulic pressure', 'Coolant pressure dropped below 2 bar during roughing; spindle stopped at 41% feed.', now() - interval '5 hours', 'high', 'down', 45, 'Half shift of axle housings deferred.', 'open', '11111111-1111-1111-1111-111111111808'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc11', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111502', '11111111-1111-1111-1111-111111111605', '11111111-1111-1111-1111-111111111701', 'cccccccc-cccc-cccc-cccc-cccccccccf01', 'cccccccc-cccc-cccc-cccc-ccccccccca03', '11111111-1111-1111-1111-111111111803', 'Spindle vibration', 'Audible vibration above 4000 rpm on the grinding spindle.', now() - interval '30 hours', 'medium', 'idle', 25, 'Grinding task paused pending inspection.', 'acknowledged', null)
on conflict (id) do update set status = excluded.status, assigned_to_employee_id = excluded.assigned_to_employee_id;

insert into public.tool_damage_reports (id, organization_id, tool_id, tool_name, machine_id, workstation_id, production_order_id, damaged_quantity, unit, damage_category, description, production_impact, reported_by_employee_id, status)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc20', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-ccccccccce01', 'Carbide boring bar', '11111111-1111-1111-1111-111111111701', '11111111-1111-1111-1111-111111111604', 'cccccccc-cccc-cccc-cccc-cccccccccf01', 2, 'pcs', 'Chipping', 'Insert edge chipped on interrupted cut; two bars scrapped.', 'Replacement bars pulled from stores; no line stoppage.', '11111111-1111-1111-1111-111111111803', 'open')
on conflict (id) do update set status = excluded.status;

insert into public.safety_incidents (id, organization_id, plant_id, department_id, workstation_id, affected_employee_id, reported_by_employee_id, incident_at, category, severity, operational_summary, immediate_action, lost_time_hours, work_stopped, status)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc30', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111604', '11111111-1111-1111-1111-111111111803', '11111111-1111-1111-1111-111111111803', now() - interval '1 days', 'near_miss', 'medium', 'Coolant hose detached while the guard was open; no contact with the operator. Area made safe.', 'Machine isolated, hose clamp replaced, toolbox talk delivered.', 0.5, true, 'under_review')
on conflict (id) do update set operational_summary = excluded.operational_summary, status = excluded.status;

insert into public.safety_incident_details (incident_id, organization_id, medical_narrative, injury_type, body_part, treatment_given, hospital_referral, diagnosis, fit_to_work, restrictions, physician_notes)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc30', '11111111-1111-1111-1111-111111111111', 'Operator reported no pain at the time; first aid reviewed 30 minutes later as a precaution.', 'None (near miss)', 'Right forearm', 'Precautionary assessment only, no treatment required.', false, 'No injury recorded', 'Fit for full duties', 'None', 'Reviewed by plant physician; no follow-up required.')
on conflict (incident_id) do update set medical_narrative = excluded.medical_narrative, fit_to_work = excluded.fit_to_work;

insert into public.shift_reports (id, organization_id, employee_id, shift_id, production_order_id, work_date, shift_code, tasks_completed, total_produced, good_pieces, rejected_pieces, machine_issue_count, tool_issue_count, material_shortage_count, remaining_work, handover_notes, status, submitted_at, acknowledged_by_employee_id, acknowledged_at)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc40', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'cccccccc-cccc-cccc-cccc-cccccccccf01', current_date, 'EARLY', 1, 49, 46, 3, 1, 1, 0, 'Grinding task still paused pending spindle inspection.', 'Axle batch continues on the next shift. Coolant line repaired but monitor pressure for the first hour.', 'submitted', now() - interval '1 hours', null, null),
  ('cccccccc-cccc-cccc-cccc-cccccccccc41', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111808', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'cccccccc-cccc-cccc-cccc-cccccccccf02', current_date - 1, 'EARLY', 2, 22, 21, 1, 0, 0, 1, 'Bracket lot awaiting M8 bolts.', 'Stores to deliver bolts before the next shift; fixture change verified.', 'acknowledged', now() - interval '1 days', '11111111-1111-1111-1111-111111111801', now() - interval '20 hours')
on conflict (id) do update set status = excluded.status, handover_notes = excluded.handover_notes;

insert into public.shift_report_tasks (report_id, task_id) values
  ('cccccccc-cccc-cccc-cccc-cccccccccc40', 'cccccccc-cccc-cccc-cccc-ccccccccca01'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc40', 'cccccccc-cccc-cccc-cccc-ccccccccca03'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc41', 'cccccccc-cccc-cccc-cccc-ccccccccca02')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Machine programs and revision history
-- ---------------------------------------------------------------------------
insert into public.machine_programs (id, organization_id, machine_id, program_number, name, description, controller_type, current_version, status, owner_employee_id)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc50', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111701', 'O1001', 'Axle housing roughing', 'Turning cycle for front axle housings.', 'Mazatrol SmoothG', 2, 'approved', '11111111-1111-1111-1111-111111111809'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc51', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111702', 'O2201', 'Bracket weld path', 'Robot weld path for bracket lot.', 'FANUC R-30iB', 1, 'approved', '11111111-1111-1111-1111-111111111809')
on conflict (id) do update set current_version = excluded.current_version, status = excluded.status;

insert into public.machine_program_versions (id, organization_id, program_id, version, status, storage_path, file_name, mime_type, size_bytes, checksum, change_summary, revision_notes, production_order_id, created_by_employee_id, submitted_at, approved_by_employee_id, approved_at, decision_notes)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc60', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccc50', 1, 'superseded', '11111111-1111-1111-1111-111111111111/11111111-1111-1111-1111-111111111701/cccccccc-cccc-cccc-cccc-cccccccccc50/v1.nc', 'O1001_v1.nc', 'text/plain', 18432, 'sha256:2f1c9a', 'Initial release for the QT-250.', 'Baseline cycle verified on first-off.', 'cccccccc-cccc-cccc-cccc-cccccccccf01', '11111111-1111-1111-1111-111111111809', now() - interval '30 days', '11111111-1111-1111-1111-111111111801', now() - interval '29 days', 'Approved after first-off inspection.'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc61', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccc50', 2, 'approved', '11111111-1111-1111-1111-111111111111/11111111-1111-1111-1111-111111111701/cccccccc-cccc-cccc-cccc-cccccccccc50/v2.nc', 'O1001_v2.nc', 'text/plain', 19011, 'sha256:7b4e10', 'Raised feed by 8% and added coolant pressure check.', 'Cycle time reduced from 240s to 226s.', 'cccccccc-cccc-cccc-cccc-cccccccccf01', '11111111-1111-1111-1111-111111111809', now() - interval '9 days', '11111111-1111-1111-1111-111111111801', now() - interval '8 days', 'Verified on three pieces; approved.'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc62', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccc50', 3, 'in_review', '11111111-1111-1111-1111-111111111111/11111111-1111-1111-1111-111111111701/cccccccc-cccc-cccc-cccc-cccccccccc50/v3.nc', 'O1001_v3.nc', 'text/plain', 19240, 'sha256:c93aa1', 'Tool-life improvement: reduced depth of cut on the interrupted pass.', 'Awaiting technical review; test evidence attached.', 'cccccccc-cccc-cccc-cccc-cccccccccf01', '11111111-1111-1111-1111-111111111809', now() - interval '1 days', null, null, null),
  ('cccccccc-cccc-cccc-cccc-cccccccccc63', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccc51', 1, 'approved', '11111111-1111-1111-1111-111111111111/11111111-1111-1111-1111-111111111702/cccccccc-cccc-cccc-cccc-cccccccccc51/v1.ls', 'O2201_v1.ls', 'text/plain', 9216, 'sha256:11ab77', 'Initial robot weld path.', 'Fixture change incorporated.', 'cccccccc-cccc-cccc-cccc-cccccccccf02', '11111111-1111-1111-1111-111111111809', now() - interval '21 days', '11111111-1111-1111-1111-111111111801', now() - interval '20 days', 'Approved after weld coupon test.')
on conflict (id) do update set status = excluded.status, change_summary = excluded.change_summary;

update public.machine_programs set approved_version_id = 'cccccccc-cccc-cccc-cccc-cccccccccc61' where id = 'cccccccc-cccc-cccc-cccc-cccccccccc50';
update public.machine_programs set approved_version_id = 'cccccccc-cccc-cccc-cccc-cccccccccc63' where id = 'cccccccc-cccc-cccc-cccc-cccccccccc51';
update public.machine_program_versions set superseded_by_version_id = 'cccccccc-cccc-cccc-cccc-cccccccccc61' where id = 'cccccccc-cccc-cccc-cccc-cccccccccc60';

-- ---------------------------------------------------------------------------
-- A pending reassignment proposal raised by a supervisor
-- ---------------------------------------------------------------------------
insert into public.requests (id, organization_id, employee_id, request_type, title, details, amount, status, current_approver_id, department_id, plant_id, customer_visible, submitted_at)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc70', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111808', 'reassignment', 'Reassignment · Arjun Mehta to welding', 'Move Arjun from paused grinding to the weld cell for the bracket lot.', null, 'submitted', '11111111-1111-1111-1111-111111111801', '11111111-1111-1111-1111-111111111401', '11111111-1111-1111-1111-111111111101', false, now() - interval '4 hours')
on conflict (id) do update set status = excluded.status, current_approver_id = excluded.current_approver_id;

insert into public.approvals (id, organization_id, request_id, step, approver_employee_id, status)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc71', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccc70', 1, '11111111-1111-1111-1111-111111111801', 'pending')
on conflict (id) do update set status = excluded.status;

insert into public.reassignment_requests (request_id, organization_id, employee_id, current_task_id, proposed_task_id, current_workstation_id, proposed_workstation_id, current_shift_id, proposed_shift_id, current_assignment_snapshot, proposed_assignment_snapshot, competency_requirements, reason, effective_at, status, created_by_employee_id)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc70', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803',
   'cccccccc-cccc-cccc-cccc-ccccccccca03', 'cccccccc-cccc-cccc-cccc-ccccccccca02',
   '11111111-1111-1111-1111-111111111605', '11111111-1111-1111-1111-111111111602',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
   jsonb_build_object('taskId', 'cccccccc-cccc-cccc-cccc-ccccccccca03', 'workstationId', '11111111-1111-1111-1111-111111111605', 'shiftId', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'),
   jsonb_build_object('taskId', 'cccccccc-cccc-cccc-cccc-ccccccccca02', 'workstationId', '11111111-1111-1111-1111-111111111602', 'shiftId', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'),
   'Robot welding authorization and current machine authorization for CHN-ROB-002.',
   'Grinding is blocked on spindle inspection; the weld cell needs a second operator for lot 0142.',
   date_trunc('day', now()) + interval '1 days' + interval '6 hours', 'submitted',
   '11111111-1111-1111-1111-111111111808')
on conflict (request_id) do update set status = excluded.status, reason = excluded.reason;

insert into public.notifications (id, organization_id, recipient_employee_id, title, body, category, link, read_at, created_at)
values
  ('cccccccc-cccc-cccc-cccc-cccccccccc90', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111801', 'Reassignment approval required', 'Karthik Subramanian proposed moving Arjun Mehta to the weld cell for lot 0142.', 'approval', '/approvals', null, now() - interval '4 hours'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc91', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111803', 'Task paused: Grind bearing journal', 'Awaiting M8 flange bolts from stores.', 'general', '/operator', now() - interval '5 hours', now() - interval '5 hours')
on conflict (id) do update set read_at = excluded.read_at;
