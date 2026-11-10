import { hasPermission } from './accessControl.js';
import {
  addDays,
  buildRoster,
  dateKey,
  formatMinutes,
  isWorkingDay,
  shiftMetrics,
  shiftWindow,
} from '../lib/shift.js';

const startOfToday = () => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
};

function assignmentsFor(data, employeeId) {
  return (data.shiftAssignments || [])
    .filter((assignment) => assignment.employeeId === employeeId)
    .sort((a, b) => String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)));
}

export function currentAssignmentFor(data, employeeId, date = new Date()) {
  const key = dateKey(date);
  return assignmentsFor(data, employeeId).find(
    (assignment) => assignment.effectiveFrom <= key && (!assignment.effectiveTo || assignment.effectiveTo >= key),
  );
}

export function shiftForEmployee(data, employeeId, date = new Date()) {
  const assignment = currentAssignmentFor(data, employeeId, date);
  if (!assignment) return { assignment: null, shift: null };
  const shift = (data.shifts || []).find((item) => item.id === assignment.shiftId) || null;
  return { assignment, shift };
}

export function upcomingAssignment(data, employeeId) {
  const key = dateKey(new Date());
  return assignmentsFor(data, employeeId).find((assignment) => assignment.effectiveFrom > key) || null;
}

function employeeById(data, employeeId) {
  return data.employeesById?.[employeeId] || (data.employees || []).find((employee) => employee.id === employeeId) || null;
}

function canSeeAllEmployees(context) {
  return context?.roleKeys?.includes('administrator') || hasPermission(context?.permissions, 'employees.read.all');
}

export function scopedEmployees(data, context) {
  if (!context) return [];
  if (canSeeAllEmployees(context)) return data.employees;
  const self = employeeById(data, context.employeeId);
  if (!self) return [];
  if (context.roleKeys?.includes('hod')) {
    return data.employees.filter((employee) => employee.departmentId === self.departmentId);
  }
  if (context.roleKeys?.includes('supervisor')) {
    return data.employees.filter(
      (employee) => employee.departmentId === self.departmentId && (employee.reportingManagerId === self.id || employee.id === self.id),
    );
  }
  return [self];
}

function attendanceSummary(records) {
  const summary = { present: 0, late: 0, absent: 0, onLeave: 0, earlyOut: 0, overtimeMinutes: 0, workedMinutes: 0, records: records.length };
  records.forEach((record) => {
    if (record.status === 'present') summary.present += 1;
    else if (record.status === 'late') { summary.present += 1; summary.late += 1; }
    else if (record.status === 'early_out') { summary.present += 1; summary.earlyOut += 1; }
    else if (record.status === 'absent') summary.absent += 1;
    else if (record.status === 'on_leave') summary.onLeave += 1;
    summary.overtimeMinutes += record.overtimeMinutes || 0;
    summary.workedMinutes += record.workedMinutes || 0;
  });
  return summary;
}

export function attendanceFor(data, context, employeeId = context?.employeeId, days = 30) {
  const from = dateKey(addDays(startOfToday(), -days));
  const employee = employeeById(data, employeeId);
  const records = (data.attendanceRecords || [])
    .filter((record) => record.employeeId === employeeId && record.workDate >= from)
    .sort((a, b) => b.workDate.localeCompare(a.workDate));
  return {
    employee,
    records,
    summary: attendanceSummary(records),
    monthSummary: attendanceSummary(records.filter((record) => record.workDate.slice(0, 7) === dateKey(new Date()).slice(0, 7))),
  };
}

export function scheduleFor(data, context, days = 14) {
  const employee = employeeById(data, context.employeeId);
  const { assignment, shift } = shiftForEmployee(data, context.employeeId);
  const from = startOfToday();
  const to = addDays(from, days - 1);
  const leave = (data.leaveRecords || [])
    .filter((item) => item.employeeId === context.employeeId && item.status === 'approved')
    .map((item) => ({ startDate: item.startDate, endDate: item.endDate }));
  const holidays = (data.holidays || [])
    .filter((item) => !item.plantId || !employee?.plantId || item.plantId === employee.plantId)
    .map((item) => ({ date: item.holidayDate, name: item.name, plantId: item.plantId }));
  const roster = assignment && shift
    ? buildRoster({ assignment, shift, employeeId: context.employeeId, from, to, holidays, leave })
    : [];
  const metrics = shift ? shiftMetrics(shift) : null;
  const upcoming = assignmentsFor(data, context.employeeId).filter((item) => item.effectiveFrom > dateKey(from));
  return {
    employee,
    assignment,
    shift,
    metrics,
    roster,
    upcoming,
    holidays: (data.holidays || []).filter((item) => dateKey(new Date(item.holidayDate)) >= dateKey(from)).slice(0, 8),
    leave: (data.leaveRecords || []).filter((item) => item.employeeId === context.employeeId),
    weeklyMinutes: shift ? metrics.netWorkingMinutes * shift.weeklyWorkingDays.length : 0,
  };
}

export function dashboardFor(data, context) {
  const employee = employeeById(data, context.employeeId);
  const schedule = scheduleFor(data, context, 7);
  const today = dateKey(new Date());
  const todayEntry = schedule.roster.find((entry) => entry.date === today);
  const todayRecord = (data.attendanceRecords || []).find(
    (record) => record.employeeId === context.employeeId && record.workDate === today,
  );
  const attendance = attendanceFor(data, context, context.employeeId, 30);
  const unread = (data.notifications || []).filter(
    (item) => item.recipientEmployeeId === context.employeeId && !item.readAt,
  );
  const tasks = (data.tasks || []).filter(
    (item) => item.assigneeEmployeeId === context.employeeId && item.status !== 'done' && item.status !== 'cancelled',
  );
  const approvals = approvalsFor(data, context);
  const team = scopedEmployees(data, context).filter((item) => item.id !== context.employeeId);
  const teamLeave = (data.leaveRecords || []).filter(
    (item) => item.status === 'approved' && item.startDate <= today && item.endDate >= today && team.some((member) => member.id === item.employeeId),
  );
  const announcements = (data.notifications || []).filter((item) => item.category === 'announcement');
  const activeLines = (data.productionLines || []).filter((line) => line.status === 'running').length;
  const headcount = canSeeAllEmployees(context) ? data.employees.length : team.length + 1;
  const departmentHeadcount = data.employees.filter((item) => item.departmentId === employee?.departmentId).length;
  return {
    employee,
    schedule,
    todayEntry,
    todayRecord,
    attendance,
    unread,
    tasks,
    approvals,
    teamLeave,
    announcements,
    activeLines,
    headcount,
    departmentHeadcount,
    recentActivity: activityFor(data, context).slice(0, 5),
    notifications: unread.slice(0, 4),
  };
}

export function profileFor(data, context, employeeId = context.employeeId) {
  const employee = employeeById(data, employeeId);
  if (!employee) return null;
  const schedule = employeeId === context.employeeId ? scheduleFor(data, context, 7) : null;
  const attendance = attendanceFor(data, context, employeeId, 30);
  const medical = (data.medicalRecords || []).find((item) => item.employeeId === employeeId) || null;
  const canSeeMedical = employeeId === context.employeeId || hasPermission(context.permissions, 'employees.medical.read');
  return {
    employee,
    schedule,
    attendance,
    manager: employee.reportingManagerId ? employeeById(data, employee.reportingManagerId) : null,
    directReports: data.employees.filter((item) => item.reportingManagerId === employeeId),
    medical: canSeeMedical ? medical : null,
    medicalRestricted: Boolean(medical) && !canSeeMedical,
    documents: (data.documents || []).filter((item) => item.ownerEmployeeId === employeeId),
    projects: (data.projects || []).filter((project) => project.managerEmployeeId === employeeId),
  };
}

export function notificationsFor(data, context) {
  return (data.notifications || [])
    .filter((item) => item.recipientEmployeeId === context.employeeId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function tasksFor(data, context) {
  const canSeeAll = hasPermission(context.permissions, 'tasks.read.all');
  return (data.tasks || [])
    .filter((task) => task.assigneeEmployeeId === context.employeeId || (canSeeAll && scopedEmployees(data, context).some((employee) => employee.id === task.assigneeEmployeeId)))
    .map((task) => ({
      ...task,
      assignee: employeeById(data, task.assigneeEmployeeId),
      creator: employeeById(data, task.createdByEmployeeId),
      project: (data.projects || []).find((project) => project.id === task.projectId) || null,
    }))
    .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
}

export function requestsFor(data, context) {
  const canSeeAll = hasPermission(context.permissions, 'requests.read.all');
  const includeCustomerVisible = context.roleKeys?.includes('customer_approver');
  const visibleEmployees = canSeeAll ? scopedEmployees(data, context) : [employeeById(data, context.employeeId)];
  const visibleIds = new Set(visibleEmployees.filter(Boolean).map((employee) => employee.id));
  return (data.requests || [])
    .filter(
      (request) =>
        request.employeeId === context.employeeId
        || visibleIds.has(request.employeeId)
        || (includeCustomerVisible && request.customerVisible),
    )
    .map((request) => ({
      ...request,
      employee: employeeById(data, request.employeeId),
      approver: employeeById(data, request.currentApproverId),
      approvals: (data.approvals || []).filter((step) => step.requestId === request.id),
    }))
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
}

/**
 * Pending approvals are resolved from explicit approver steps plus configured
 * approval authority. Approvers cannot decide their own request.
 */
export function approvalsFor(data, context) {
  const pending = (data.approvals || []).filter((step) => step.status === 'pending');
  const requests = data.requests || [];
  return pending
    .map((step) => {
      const request = requests.find((item) => item.id === step.requestId);
      const requester = request ? employeeById(data, request.employeeId) : null;
      return { ...step, request, requester };
    })
    .filter((step) => {
      if (!step.request || step.request.status !== 'submitted') return false;
      if (step.approverEmployeeId === context.employeeId) {
        return !(context.roleKeys?.includes('administrator') && step.request.employeeId === context.employeeId);
      }
      if (context.roleKeys?.includes('administrator')) return step.request.employeeId !== context.employeeId;
      return false;
    })
    .sort((a, b) => String(a.request.submittedAt).localeCompare(String(b.request.submittedAt)));
}

export function activityFor(data, context) {
  if (!hasPermission(context.permissions, 'audit.read')) return [];
  const logs = data.auditLogs || [];
  if (context.roleKeys?.includes('administrator') || context.roleKeys?.includes('plant_head')) return logs;
  if (context.roleKeys?.includes('hod')) {
    const departmentEmployeeIds = new Set(
      data.employees.filter((employee) => employee.departmentId === context.scope?.departmentId).map((employee) => employee.id),
    );
    return logs.filter((log) => departmentEmployeeIds.has(log.actorEmployeeId));
  }
  return logs.filter((log) => log.actorEmployeeId === context.employeeId);
}

export function organizationFor(data) {
  return {
    organization: data.organization,
    plants: data.plants,
    departments: data.departments,
    productionLines: data.productionLines,
    workstations: data.workstations,
    machines: data.machines,
    headcountByDepartment: Object.fromEntries(
      data.departments.map((department) => [
        department.id,
        data.employees.filter((employee) => employee.departmentId === department.id).length,
      ]),
    ),
  };
}

export function rolesFor(data, context) {
  return {
    roles: data.roles,
    permissions: data.permissions?.length ? data.permissions : [],
    userRoles: data.userRoles,
    employees: scopedEmployees(data, context).map((employee) => ({
      ...employee,
      assignments: data.userRoles.filter((assignment) => assignment.employeeId === employee.id),
    })),
    approvalAuthorities: data.approvalAuthorities || [],
  };
}

export function shiftsFor(data) {
  return {
    shifts: data.shifts.map((shift) => ({ ...shift, metrics: shiftMetrics(shift) })),
    assignments: data.shiftAssignments.map((assignment) => ({
      ...assignment,
      employee: employeeById(data, assignment.employeeId),
      shift: data.shifts.find((shift) => shift.id === assignment.shiftId),
    })),
    holidays: data.holidays,
    employees: data.employees,
  };
}

export function employeesFor(data, context) {
  return scopedEmployees(data, context).map((employee) => ({
    ...employee,
    manager: employee.reportingManagerId ? employeeById(data, employee.reportingManagerId) : null,
    reports: data.employees.filter((item) => item.reportingManagerId === employee.id).length,
    currentShift: shiftForEmployee(data, employee.id).shift,
  }));
}

export function todayShiftSummary(data, employeeId) {
  const { shift, assignment } = shiftForEmployee(data, employeeId);
  if (!shift) return null;
  const window = shiftWindow(shift, new Date());
  return {
    shift,
    assignment,
    window,
    label: `${shift.startTime} – ${shift.endTime}`,
    duration: formatMinutes(shiftMetrics(shift).netWorkingMinutes),
    working: isWorkingDay(new Date(), shift.weeklyWorkingDays),
  };
}

export { attendanceSummary };
