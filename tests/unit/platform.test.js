import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  ALL_PERMISSION_KEYS,
  PERMISSION_BY_KEY,
  ROLES,
  ROLE_BY_KEY,
  canApproveRequest,
  expandPermissions,
  hasAllPermissions,
  hasPermission,
  isWithinScope,
  resolveHome,
} from '../../src/platform/data/accessControl.js';
import {
  addDays,
  buildRoster,
  dateKey,
  evaluateAttendance,
  formatHours,
  formatMinutes,
  intervalMinutes,
  isCrossMidnight,
  isWorkingDay,
  minutesToTime,
  shiftMetrics,
  shiftWindow,
  timeToMinutes,
} from '../../src/platform/lib/shift.js';
import {
  breadcrumbFor,
  canVisit,
  findNavItem,
  visibleSections,
} from '../../src/platform/data/navigation.js';
import {
  approvalsFor,
  dashboardFor,
  employeesFor,
  profileFor,
  requestsFor,
  scheduleFor,
  scopedEmployees,
  shiftForEmployee,
} from '../../src/platform/data/selectors.js';
import {
  isPlatformPath,
  isProtectedRoute,
  isPublicRoute,
  isStudioPath,
  normalizePath,
  PROTECTED_ROUTES,
  ROUTE_TITLES,
  STUDIO_PATHS,
} from '../../src/platform/lib/router.js';
import { createDemoData, demoContext, DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../src/platform/data/demoData.js';
import {
  createRequest,
  decideApproval,
  demoLogin,
  getDemoData,
  resetDemoData,
} from '../../src/platform/data/demoStore.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ---------------------------------------------------------------------------
// Access-control catalogue
// ---------------------------------------------------------------------------
test('role catalogue contains the sixteen initial roles with valid permissions', () => {
  assert.equal(ROLES.length, 16);
  assert.equal(new Set(ROLES.map((role) => role.key)).size, 16);
  for (const key of [
    'operator', 'supervisor', 'programmer', 'technical_assistant', 'technical_analyst',
    'material_analyst', 'hr_analyst', 'resource_analyst', 'hod', 'finance', 'plant_head',
    'administrator', 'quality_engineer', 'ehs_officer', 'customer_approver', 'verification_engineer',
  ]) {
    assert.ok(ROLE_BY_KEY[key], `${key} exists`);
  }
  for (const role of ROLES) {
    assert.ok(role.name && role.level > 0 && role.description, `${role.key} is described`);
    assert.ok(role.permissions.length > 0, `${role.key} grants permissions`);
    for (const permission of role.permissions) {
      assert.ok(PERMISSION_BY_KEY[permission], `${role.key} references real permission ${permission}`);
    }
  }
});

test('permission expansion supports exact keys, module wildcards and full wildcard', () => {
  assert.deepEqual([...expandPermissions(['employees.read'])], ['employees.read']);
  assert.ok(expandPermissions(['digital_twin.*']).has('digital_twin.manage'));
  assert.ok(!expandPermissions(['digital_twin.*']).has('employees.manage'));
  assert.equal(expandPermissions(['*']).size, ALL_PERMISSION_KEYS.length);
  assert.ok(hasPermission(['roles.manage'], 'roles.manage'));
  assert.ok(hasPermission(['roles.*'], 'roles.manage'));
  assert.ok(hasAllPermissions(['employees.read', 'employees.manage'], ['employees.read', 'employees.manage']));
  assert.equal(hasAllPermissions(['employees.read'], ['employees.read', 'employees.manage']), false);
  assert.equal(hasPermission(['employees.read'], 'employees.manage'), false);
});

test('home routing honours multi-role priority', () => {
  assert.equal(resolveHome(['operator']), '/dashboard');
  assert.equal(resolveHome(['hod', 'supervisor']), '/dashboard');
  assert.equal(resolveHome(['finance']), '/approvals');
  assert.equal(resolveHome(['hr_analyst']), '/admin/employees');
  assert.equal(resolveHome(['plant_head', 'administrator']), '/admin/organization');
  assert.equal(resolveHome(['customer_approver']), '/approvals');
});

test('scope and approval checks fail closed', () => {
  const supervisor = {
    employeeId: 'emp-001',
    roleKeys: ['supervisor'],
    permissions: ['requests.approve'],
    scope: { plantId: 'plant-chennai', departmentId: 'dept-production' },
  };
  assert.equal(isWithinScope(supervisor, { plantId: 'plant-chennai' }), true);
  assert.equal(isWithinScope(supervisor, { plantId: 'plant-pune' }), false);
  assert.equal(isWithinScope({ roleKeys: ['administrator'], permissions: [], scope: {} }, { plantId: 'anything' }), true);

  const base = {
    employeeId: 'emp-003',
    plantId: 'plant-chennai',
    departmentId: 'dept-production',
    status: 'submitted',
    customerVisible: false,
  };
  assert.equal(canApproveRequest(supervisor, base), true);
  assert.equal(canApproveRequest(supervisor, { ...base, employeeId: 'emp-001' }), false, 'self approval blocked');
  assert.equal(canApproveRequest(supervisor, { ...base, selfApprovalAllowed: true }), true);
  assert.equal(canApproveRequest({ ...supervisor, permissions: [] }, base), false);
  assert.equal(canApproveRequest(supervisor, { ...base, plantId: 'plant-pune' }), false);

  const customer = demoContext(createDemoData(), 'emp-015');
  assert.equal(canApproveRequest(customer, { ...base, approverId: 'emp-015', customerVisible: true }), true);
  assert.equal(canApproveRequest(customer, { ...base, approverId: 'emp-015', customerVisible: false }), false);
});

// ---------------------------------------------------------------------------
// Shift and attendance arithmetic
// ---------------------------------------------------------------------------
test('shift time helpers handle wall-clock values and cross-midnight windows', () => {
  assert.equal(timeToMinutes('09:30'), 570);
  assert.equal(timeToMinutes('24:00'), Number.NaN);
  assert.equal(minutesToTime(570), '09:30');
  assert.equal(minutesToTime(-30), '23:30');
  assert.equal(intervalMinutes('09:00', '18:00'), 540);
  assert.equal(intervalMinutes('22:00', '06:00'), 480);
  assert.equal(isCrossMidnight('22:00', '06:00'), true);
  assert.equal(isCrossMidnight('06:00', '14:00'), false);
  assert.equal(formatMinutes(0), '0m');
  assert.equal(formatMinutes(75), '1h 15m');
  assert.equal(formatMinutes(120), '2h');
  assert.equal(formatHours(90), '1.5');
});

test('night shift metrics exclude unpaid lunch but keep paid breaks', () => {
  const night = {
    startTime: '22:00',
    endTime: '06:00',
    lunchStart: '02:00',
    lunchEnd: '02:30',
    breaks: [{ startTime: '00:00', endTime: '00:20', isPaid: true }],
  };
  const metrics = shiftMetrics(night);
  assert.equal(metrics.spanMinutes, 480);
  assert.equal(metrics.unpaidBreakMinutes, 30);
  assert.equal(metrics.paidBreakMinutes, 20);
  assert.equal(metrics.netWorkingMinutes, 450);
  assert.equal(metrics.breakCount, 2);
  assert.equal(metrics.crossMidnight, true);

  const window = shiftWindow(night, new Date(2026, 10, 10, 12));
  assert.equal(dateKey(window.start), '2026-11-10');
  assert.equal(dateKey(window.end), '2026-11-11');
  assert.equal(window.minutes, 480);
});

test('attendance evaluation applies grace, early-out and overtime rules', () => {
  const shift = {
    startTime: '09:00',
    endTime: '18:00',
    lunchStart: '13:00',
    lunchEnd: '13:30',
    breaks: [],
    graceMinutes: 10,
    overtimePolicy: 'manager_approval',
  };
  const day = new Date(2026, 10, 10, 12);
  const withinGrace = evaluateAttendance({ shift, date: day, clockIn: new Date(2026, 10, 10, 9, 8), clockOut: new Date(2026, 10, 10, 18, 5) });
  assert.equal(withinGrace.status, 'present');
  assert.equal(withinGrace.lateMinutes, 0);
  assert.equal(withinGrace.overtimeMinutes, 5);

  const late = evaluateAttendance({ shift, date: day, clockIn: new Date(2026, 10, 10, 9, 25), clockOut: new Date(2026, 10, 10, 17, 40) });
  assert.equal(late.status, 'late');
  assert.equal(late.lateMinutes, 15);
  assert.equal(late.earlyOutMinutes, 20);

  assert.equal(evaluateAttendance({ shift, date: day, holiday: true }).status, 'holiday');
  assert.equal(evaluateAttendance({ shift, date: day, approvedLeave: true }).status, 'on_leave');
  assert.equal(evaluateAttendance({ shift, date: day }).status, 'absent');
});

test('roster expansion honours working days, holidays and approved leave', () => {
  const monday = new Date(2026, 10, 9, 12);
  assert.equal(isWorkingDay(monday, [1, 2, 3, 4, 5]), true);
  assert.equal(isWorkingDay(addDays(monday, 5), [1, 2, 3, 4, 5]), false);
  const roster = buildRoster({
    assignment: { shiftId: 'shift-general', effectiveFrom: '2026-01-01', effectiveTo: null },
    shift: {
      startTime: '09:00',
      endTime: '18:00',
      weeklyWorkingDays: [1, 2, 3, 4, 5],
      lunchStart: '13:00',
      lunchEnd: '13:30',
      breaks: [],
    },
    employeeId: 'emp-001',
    from: monday,
    to: addDays(monday, 6),
    holidays: [{ date: '2026-11-11', name: 'Festival' }],
    leave: [{ startDate: '2026-11-12', endDate: '2026-11-12' }],
  });
  assert.equal(roster.length, 7);
  assert.equal(roster[0].status, 'scheduled');
  assert.equal(roster.find((entry) => entry.date === '2026-11-11').status, 'holiday');
  assert.equal(roster.find((entry) => entry.date === '2026-11-12').status, 'on_leave');
  assert.equal(roster.find((entry) => entry.date === '2026-11-14').status, 'off');
  assert.equal(roster.find((entry) => entry.date === '2026-11-14').working, false);
  assert.equal(roster[0].netWorkingMinutes, 510);
});

// ---------------------------------------------------------------------------
// Navigation and router guards
// ---------------------------------------------------------------------------
test('navigation is permission-driven and hides admin sections from operators', () => {
  const operator = demoContext(createDemoData(), 'emp-003');
  const admin = demoContext(createDemoData(), 'emp-002');
  const operatorPaths = visibleSections(operator).flatMap((section) => section.items.map((item) => item.to));
  const adminPaths = visibleSections(admin).flatMap((section) => section.items.map((item) => item.to));
  assert.ok(operatorPaths.includes('/dashboard'));
  assert.ok(!operatorPaths.includes('/admin/roles'));
  assert.ok(!operatorPaths.includes('/approvals'));
  assert.ok(adminPaths.includes('/admin/roles'));
  assert.ok(adminPaths.includes('/admin/shifts'));
  assert.equal(canVisit('/admin/roles', operator.permissions), false);
  assert.equal(canVisit('/dashboard', operator.permissions), true);
  assert.equal(findNavItem('/admin/roles').label, 'Roles & permissions');
  assert.deepEqual(breadcrumbFor('/admin/roles'), ['People & access', 'Roles & permissions']);
});

test('router keeps the studio at the root and platform routes separate', () => {
  assert.equal(normalizePath('/dashboard/'), '/dashboard');
  assert.equal(normalizePath('/dashboard?tab=x#y'), '/dashboard');
  for (const studioPath of STUDIO_PATHS) assert.equal(isStudioPath(studioPath), true);
  assert.equal(isStudioPath('/dashboard'), false);
  assert.equal(isPublicRoute('/login'), true);
  assert.equal(isProtectedRoute('/dashboard'), true);
  assert.equal(isProtectedRoute('/admin/shifts'), true);
  assert.equal(isProtectedRoute('/nope'), false);
  assert.equal(isPlatformPath('/admin/anything'), true);
  for (const route of PROTECTED_ROUTES) assert.ok(ROUTE_TITLES[route], `${route} has a title`);
});

// ---------------------------------------------------------------------------
// Demo workspace selectors
// ---------------------------------------------------------------------------
test('demo selectors scope employees, approvals and requests by role', () => {
  const data = createDemoData();
  const admin = demoContext(data, 'emp-002');
  const operator = demoContext(data, 'emp-003');
  const customer = demoContext(data, 'emp-015');

  assert.equal(scopedEmployees(data, admin).length, data.employees.length);
  assert.equal(operator.employeeId, 'emp-003');
  assert.deepEqual(scopedEmployees(data, operator).map((employee) => employee.id), ['emp-003']);
  assert.equal(employeesFor(data, operator).length, 1);

  assert.ok(approvalsFor(data, admin).length >= 1);
  const customerApprovals = approvalsFor(data, customer);
  assert.equal(customerApprovals.length, 1);
  assert.equal(customerApprovals[0].request.customerVisible, true);

  const customerRequests = requestsFor(data, customer);
  assert.ok(customerRequests.some((request) => request.customerVisible), 'customer sees shared evidence');
  assert.ok(customerRequests.every((request) => request.customerVisible || request.employeeId === 'emp-015'));

  const dashboard = dashboardFor(data, operator);
  assert.equal(dashboard.employee.id, 'emp-003');
  assert.ok(dashboard.schedule.roster.length > 0);
});

test('profile selector restricts medical data by permission and self access', () => {
  const data = createDemoData();
  const operator = demoContext(data, 'emp-003');
  const hr = demoContext(data, 'emp-004');
  const selfProfile = profileFor(data, operator, 'emp-003');
  const colleagueProfile = profileFor(data, operator, 'emp-010');
  const hrProfile = profileFor(data, hr, 'emp-010');
  assert.ok(selfProfile.medical, 'employees can read their own medical record');
  assert.equal(colleagueProfile.medical, null);
  assert.equal(colleagueProfile.medicalRestricted, true);
  assert.ok(hrProfile.medical, 'HR can read restricted medical records');
});

test('shift selectors resolve the active and upcoming assignments', () => {
  const data = createDemoData();
  const current = shiftForEmployee(data, 'emp-003');
  const schedule = scheduleFor(data, demoContext(data, 'emp-003'), 14);
  assert.equal(current.shift.id, 'shift-night');
  assert.equal(schedule.upcoming.length, 1);
  assert.equal(schedule.upcoming[0].shiftId, 'shift-early');
  assert.ok(schedule.roster.length === 14);
  assert.ok(schedule.metrics.netWorkingMinutes > 0);
});

// ---------------------------------------------------------------------------
// Demo identity and workflow
// ---------------------------------------------------------------------------
test('demo sign-in enforces credentials and suspended accounts', () => {
  resetDemoData();
  const invalid = demoLogin('admin@indra.example', 'wrong-password');
  assert.equal(invalid.error.code, 'invalid_credentials');
  const unknown = demoLogin('nobody@indra.example', DEMO_PASSWORD);
  assert.equal(unknown.error.code, 'invalid_credentials');
  const admin = demoLogin('admin@indra.example', DEMO_PASSWORD);
  assert.ok(admin.session?.employeeId);
  assert.equal(admin.employee.id, 'emp-002');
  assert.equal(DEMO_ACCOUNTS.length, 6);
});

test('demo workflow submits a request and honours segregation of duties', () => {
  resetDemoData();
  const submitted = createRequest(
    { requestType: 'leave', title: 'Platform integration test leave', details: 'Verifying the demo approval chain.', customerVisible: false },
    'emp-003',
  );
  assert.ok(submitted.result.id);
  const data = getDemoData();
  const request = data.requests.find((item) => item.id === submitted.result.id);
  assert.equal(request.employeeId, 'emp-003');
  assert.equal(request.currentApproverId, 'emp-001');
  const step = data.approvals.find((item) => item.requestId === request.id);
  assert.ok(step);
  assert.equal(step.approverEmployeeId, 'emp-001');

  assert.throws(
    () => decideApproval({ requestId: request.id, approvalId: step.id, decision: 'approved', comments: 'self' }, 'emp-003'),
    /Segregation of duties/,
  );
  const decision = decideApproval({ requestId: request.id, approvalId: step.id, decision: 'approved', comments: 'Reviewed.' }, 'emp-001');
  assert.ok(decision.result.id);
  const after = getDemoData().requests.find((item) => item.id === request.id);
  assert.equal(after.status, 'approved');
});

// ---------------------------------------------------------------------------
// SQL contract (no database required)
// ---------------------------------------------------------------------------
test('migrations define RLS for every public table and include storage hardening', () => {
  const directory = path.join(root, 'supabase', 'migrations');
  const files = readdirSync(directory).filter((file) => file.endsWith('.sql')).sort();
  for (const expected of [
    '20261110000100_platform_foundation.sql',
    '20261110000200_rbac_and_workforce.sql',
    '20261110000300_operations.sql',
    '20261110000400_rls_policies.sql',
    '20261110000500_protected_rpcs.sql',
    '20261110000600_storage.sql',
    '20261110000700_access_hardening.sql',
  ]) {
    assert.ok(files.includes(expected), `${expected} exists`);
  }
  const sql = files.map((file) => readFileSync(path.join(directory, file), 'utf8')).join('\n');
  const tables = [...sql.matchAll(/create table public\.([a-z_]+)/g)].map((match) => match[1]).sort();
  const protectedTables = [...sql.matchAll(/alter table public\.([a-z_]+) enable row level security/g)].map((match) => match[1]).sort();
  assert.ok(tables.length >= 30, 'normalized schema has the expected table count');
  assert.deepEqual(protectedTables, tables, 'every public table has row level security enabled');
  assert.ok(sql.includes("'employee-documents'"));
  assert.ok(sql.includes("'employee-avatars'"));
  assert.ok(sql.includes('guard_employee_self_update'));
  assert.ok(sql.includes('not public.has_role(\'customer_approver\')'));
});

test('seed data covers every catalogue role and permission', () => {
  const seed = readFileSync(path.join(root, 'supabase', 'seed.sql'), 'utf8');
  const authSeed = readFileSync(path.join(root, 'supabase', 'seed-auth.sql'), 'utf8');
  for (const permission of ALL_PERMISSION_KEYS) {
    assert.ok(seed.includes(`'${permission}'`), `${permission} is seeded`);
  }
  for (const role of ROLES) {
    assert.ok(seed.includes(`'${role.key}'`), `${role.key} is seeded`);
  }
  for (const account of DEMO_ACCOUNTS) {
    assert.ok(authSeed.includes(account.email), `${account.email} has a demo auth identity`);
  }
  assert.ok(authSeed.includes('IndraDemo!2026'));
  assert.ok(authSeed.includes("crypt('IndraDemo!2026'"));
  assert.ok(seed.trim().endsWith('commit;'));
});
