/**
 * Derived views for Module 02.
 *
 * Every selector works with both the Supabase-shaped workspace (camelised rows)
 * and the demo dataset, and none of them decide authorization: they only shape
 * rows that RLS already returned. `canX` helpers mirror the SQL policies so the
 * interface can explain a restriction, never replace it.
 */

import { hasPermission } from './accessControl.js';
import { dateKey } from '../lib/shift.js';

const byId = (rows = []) => Object.fromEntries(rows.map((row) => [row.id, row]));

export function productionTaskRows(data) {
  if (!data) return [];
  if (data.productionTasks?.length) return data.productionTasks;
  return (data.tasks || []).filter((task) => task.productionOrderId || task.productionStatus);
}

export function productionOrderRows(data) {
  return data?.productionOrders || [];
}

export function orderFor(data, task) {
  if (!data || !task) return null;
  return byId(productionOrderRows(data))[task.productionOrderId] || null;
}

export function productFor(data, order) {
  if (!data || !order) return null;
  return (data.products || []).find((product) => product.id === order.productId) || null;
}

export function machineFor(data, machineId) {
  if (!data || !machineId) return null;
  return (data.machines || []).find((machine) => machine.id === machineId) || null;
}

export function workstationFor(data, workstationId) {
  if (!data || !workstationId) return null;
  return (data.workstations || []).find((station) => station.id === workstationId) || null;
}

export function productionLineFor(data, lineId) {
  if (!data || !lineId) return null;
  return (data.productionLines || []).find((line) => line.id === lineId) || null;
}

/** Production tasks visible to the signed-in employee. */
export function tasksForEmployee(data, employeeId) {
  return productionTaskRows(data).filter((task) => task.assigneeEmployeeId === employeeId);
}

/** Tasks the employee supervises (their team, not their own work). */
export function supervisedTasks(data, employeeId) {
  return productionTaskRows(data).filter(
    (task) => task.supervisorEmployeeId === employeeId && task.assigneeEmployeeId !== employeeId,
  );
}

export function openTasks(tasks = []) {
  return tasks.filter((task) => !['completed', 'cancelled'].includes(task.productionStatus || task.status));
}

export function remainingTarget(task) {
  const target = Number(task.targetQuantity || 0);
  const done = Number(task.completedQuantity || 0);
  return Math.max(target - done, 0);
}

export function progressPercent(task) {
  const target = Number(task.targetQuantity || 0);
  if (!target) return 0;
  return Math.min(Math.round((Number(task.completedQuantity || 0) / target) * 100), 100);
}

export function reportsForEmployee(data, employeeId, workDate) {
  return (data?.productionReports || [])
    .filter((report) => report.reportedByEmployeeId === employeeId)
    .filter((report) => !workDate || report.workDate === workDate);
}

export function reportsForOrder(data, orderId) {
  return (data?.productionReports || []).filter((report) => report.productionOrderId === orderId);
}

export function teamReports(data, employeeIds = []) {
  const set = new Set(employeeIds);
  return (data?.productionReports || []).filter((report) => set.has(report.reportedByEmployeeId));
}

export function reportsForScope(data, context) {
  if (!data || !context) return [];
  if (hasPermission(context.permissions, 'production.reports.read') || hasPermission(context.permissions, 'production.reports.manage')) {
    return data.productionReports || [];
  }
  return (data.productionReports || []).filter((report) => report.reportedByEmployeeId === context.employeeId);
}

/** Aggregate pieces for a set of reports, with rework kept inside rejects. */
export function summariseReports(reports = []) {
  return reports.reduce(
    (total, report) => ({
      entries: total.entries + 1,
      produced: total.produced + Number(report.totalProduced || 0),
      good: total.good + Number(report.goodPieces || 0),
      rejected: total.rejected + Number(report.rejectedPieces || 0),
      rework: total.rework + Number(report.reworkPieces || 0),
      downtime: total.downtime + Number(report.downtimeMinutes || 0),
    }),
    { entries: 0, produced: 0, good: 0, rejected: 0, rework: 0, downtime: 0 },
  );
}

/** Shift-wise and daily summaries for the reporting page. */
export function reportingSummary(data, reports) {
  const shifts = new Map();
  const days = new Map();
  for (const report of reports) {
    const shiftKey = `${report.workDate}|${report.shiftCode || 'unspecified'}`;
    shifts.set(shiftKey, [...(shifts.get(shiftKey) || []), report]);
    days.set(report.workDate, [...(days.get(report.workDate) || []), report]);
  }
  return {
    shifts: [...shifts.entries()]
      .map(([key, rows]) => ({
        key,
        date: rows[0].workDate,
        shiftCode: rows[0].shiftCode || 'Unspecified',
        ...summariseReports(rows),
      }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.shiftCode.localeCompare(b.shiftCode))),
    days: [...days.entries()]
      .map(([date, rows]) => ({ date, ...summariseReports(rows) }))
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
}

export function defectsByReason(reports = []) {
  const map = new Map();
  for (const report of reports) {
    if (Number(report.rejectedPieces || 0) <= 0) continue;
    const key = report.downtimeReason || 'Unclassified';
    map.set(key, (map.get(key) || 0) + Number(report.rejectedPieces));
  }
  return [...map.entries()].map(([reason, pieces]) => ({ reason, pieces })).sort((a, b) => b.pieces - a.pieces);
}

/** Team roster with today's shift and attendance, used by the supervisor view. */
export function teamAvailability(data, context) {
  if (!data || !context) return [];
  const today = dateKey(new Date());
  return (data.employees || [])
    .filter((employee) => employee.id !== context.employeeId)
    .filter((employee) => employee.departmentId === context.scope?.departmentId || employee.plantId === context.scope?.plantId)
    .map((employee) => {
      const assignment = (data.shiftAssignments || []).find(
        (item) => item.employeeId === employee.id && item.effectiveFrom <= today && (!item.effectiveTo || item.effectiveTo >= today),
      );
      const shift = (data.shifts || []).find((item) => item.id === assignment?.shiftId) || null;
      const attendance = (data.attendanceRecords || []).find(
        (item) => item.employeeId === employee.id && item.workDate === today,
      );
      const tasks = tasksForEmployee(data, employee.id);
      return {
        employee,
        shift,
        attendanceStatus: attendance?.status || (employee.employmentStatus === 'on_leave' ? 'on_leave' : 'not_marked'),
        openTasks: openTasks(tasks).length,
        activeTask: openTasks(tasks).find((task) => task.productionStatus === 'in_progress') || null,
      };
    });
}

export function issuesFor(data, context) {
  if (!data || !context) return [];
  const canReadAll = hasPermission(context.permissions, 'production.issues.read');
  return (data.technicalIssues || []).filter(
    (issue) => canReadAll || issue.reportedByEmployeeId === context.employeeId,
  );
}

export function toolDamageFor(data, context) {
  const canReadAll = hasPermission(context?.permissions, 'production.issues.read');
  return (data?.toolDamageReports || []).filter(
    (report) => canReadAll || report.reportedByEmployeeId === context?.employeeId,
  );
}

export function materialRequestsFor(data) {
  return (data?.materialRequests || []).map((detail) => ({
    ...detail,
    request: (data.requests || []).find((request) => request.id === detail.requestId) || null,
    material: (data.materials || []).find((material) => material.id === detail.materialId) || null,
  }));
}

/**
 * Safety visibility. Operational facts are available to supervisors; the
 * clinical detail only renders when the workspace actually returned it, which
 * requires `safety.medical.read` in PostgreSQL.
 */
export function safetyIncidentsFor(data, context) {
  if (!data || !context) return [];
  const canOperational = hasPermission(context.permissions, 'safety.operational.read');
  const canMedical = hasPermission(context.permissions, 'safety.medical.read');
  return (data.safetyIncidents || [])
    .filter((incident) => canOperational || canMedical
      || incident.reportedByEmployeeId === context.employeeId
      || incident.affectedEmployeeId === context.employeeId)
    .map((incident) => {
      const detail = canMedical
        ? (data.safetyIncidentDetails || []).find((row) => row.incidentId === incident.id) || null
        : null;
      return { ...incident, detail, detailAvailable: canMedical };
    });
}

export function shiftReportsFor(data, context) {
  if (!data || !context) return [];
  const canReview = hasPermission(context.permissions, 'handover.read');
  return (data.shiftReports || [])
    .filter((report) => canReview || report.employeeId === context.employeeId)
    .map((report) => ({
      ...report,
      employee: (data.employees || []).find((employee) => employee.id === report.employeeId) || null,
      tasks: (data.shiftReportTasks || [])
        .filter((row) => row.reportId === report.id)
        .map((row) => productionTaskRows(data).find((task) => task.id === row.taskId))
        .filter(Boolean),
    }));
}

export function reassignmentProposals(data, context) {
  if (!data || !context) return [];
  const canApprove = hasPermission(context.permissions, 'reassignment.approve');
  return (data.reassignmentRequests || [])
    .map((detail) => ({
      ...detail,
      request: (data.requests || []).find((item) => item.id === detail.requestId) || null,
      employee: (data.employees || []).find((item) => item.id === detail.employeeId) || null,
      currentTask: productionTaskRows(data).find((task) => task.id === detail.currentTaskId) || null,
      proposedTask: productionTaskRows(data).find((task) => task.id === detail.proposedTaskId) || null,
      currentShift: (data.shifts || []).find((shift) => shift.id === detail.currentShiftId) || null,
      proposedShift: (data.shifts || []).find((shift) => shift.id === detail.proposedShiftId) || null,
      approval: (data.approvals || []).find((step) => step.requestId === detail.requestId && step.status === 'pending') || null,
    }))
    .filter((proposal) => canApprove || proposal.employeeId === context.employeeId || proposal.createdByEmployeeId === context.employeeId);
}

export function programsFor(data, context) {
  if (!data || !context) return [];
  if (!hasPermission(context.permissions, 'programs.read')) return [];
  return (data.machinePrograms || []).map((program) => ({
    ...program,
    machine: (data.machines || []).find((machine) => machine.id === program.machineId) || null,
    versions: (data.programVersions || [])
      .filter((version) => version.programId === program.id)
      .sort((a, b) => b.version - a.version)
      .map((version) => ({
        ...version,
        author: (data.employees || []).find((employee) => employee.id === version.createdByEmployeeId) || null,
        approver: (data.employees || []).find((employee) => employee.id === version.approvedByEmployeeId) || null,
      })),
  }));
}

export function workHistoryFor(data, context, employeeId) {
  if (!data) return [];
  const target = employeeId || context?.employeeId;
  const tasks = productionTaskRows(data).filter(
    (task) => task.assigneeEmployeeId === target && ['completed', 'cancelled'].includes(task.productionStatus),
  );
  const reports = (data.productionReports || []).filter((report) => report.reportedByEmployeeId === target);
  const events = (data.taskEvents || []).filter((event) => event.employeeId === target);
  return { tasks, reports, events };
}

/** Attendance register for a given day, scoped to the viewer. */
export function attendanceRegister(data, context, workDate = dateKey(new Date())) {
  if (!data || !context) return [];
  const canSeeAll = hasPermission(context.permissions, 'attendance.read.all');
  return (data.employees || [])
    .filter((employee) => canSeeAll || employee.id === context.employeeId)
    .filter((employee) => canSeeAll || employee.departmentId === context.scope?.departmentId || employee.plantId === context.scope?.plantId)
    .map((employee) => {
      const record = (data.attendanceRecords || []).find(
        (item) => item.employeeId === employee.id && item.workDate === workDate,
      );
      const assignment = (data.shiftAssignments || []).find(
        (item) => item.employeeId === employee.id && item.effectiveFrom <= workDate && (!item.effectiveTo || item.effectiveTo >= workDate),
      );
      return {
        employee,
        record,
        shift: (data.shifts || []).find((shift) => shift.id === assignment?.shiftId) || null,
        status: record?.status || 'not_marked',
      };
    });
}
