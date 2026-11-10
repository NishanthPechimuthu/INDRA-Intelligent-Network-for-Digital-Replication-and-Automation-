import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { dateKey, addDays } from '../lib/shift.js';
import { getDemoData } from './demoStore.js';

const WorkspaceContext = createContext(null);

function camelCase(key) {
  return key.replace(/_([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

function camelize(value) {
  if (Array.isArray(value)) return value.map(camelize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [camelCase(key), camelize(item)]));
}

const TABLES = [
  ['organizations', 1],
  ['plants', 200],
  ['departments', 500],
  ['production_lines', 500],
  ['workstations', 1000],
  ['machines', 1000],
  ['designations', 300],
  ['job_categories', 200],
  ['employees', 1000],
  ['roles', 100],
  ['permissions', 300],
  ['role_permissions', 1000],
  ['user_roles', 3000],
  ['skills', 500],
  ['certifications', 500],
  ['employee_skills', 5000],
  ['employee_certifications', 5000],
  ['projects', 500],
  ['shifts', 200],
  ['shift_breaks', 1000],
  ['employee_shift_assignments', 3000],
  ['holidays', 500],
  ['leave_records', 2000],
  ['notifications', 1000],
  ['tasks', 2000],
  ['requests', 2000],
  ['approvals', 5000],
  ['approval_authorities', 500],
  ['audit_logs', 300],
  ['invitations', 500],
  ['documents', 1000],
  ['employee_medical', 100],
  // Module 02 · workforce and production operations
  ['products', 500],
  ['materials', 1000],
  ['tools', 1000],
  ['production_orders', 2000],
  ['task_events', 5000],
  ['production_reports', 4000],
  ['production_report_materials', 8000],
  ['technical_issues', 2000],
  ['tool_damage_reports', 1000],
  ['safety_incidents', 1000],
  ['safety_incident_details', 500],
  ['shift_reports', 2000],
  ['shift_report_tasks', 4000],
  ['material_requests', 1000],
  ['reassignment_requests', 1000],
  ['machine_programs', 1000],
  ['machine_program_versions', 4000],
  ['employee_machine_authorizations', 2000],
];

function unwrap(settled, name) {
  if (settled.status === 'rejected') return { rows: [], error: `${name}: ${settled.reason?.message || 'unavailable'}` };
  const { data, error } = settled.value;
  if (error) return { rows: [], error: `${name}: ${error.message}` };
  return { rows: camelize(data || []), error: null };
}

async function fetchTable(name, limit) {
  let query = supabase.from(name).select('*').limit(limit);
  if (name === 'attendance_records') {
    query = query.gte('work_date', dateKey(addDays(new Date(), -90))).order('work_date', { ascending: false }).limit(4000);
  }
  if (name === 'audit_logs') query = query.order('created_at', { ascending: false });
  if (name === 'notifications') query = query.order('created_at', { ascending: false });
  if (name === 'tasks') query = query.order('due_at', { ascending: true });
  if (name === 'requests') query = query.order('submitted_at', { ascending: false });
  if (name === 'production_orders') query = query.order('planned_start_at', { ascending: true });
  if (name === 'production_reports') query = query.order('work_date', { ascending: false });
  if (name === 'task_events') query = query.order('created_at', { ascending: false });
  if (name === 'technical_issues') query = query.order('occurred_at', { ascending: false });
  if (name === 'safety_incidents') query = query.order('incident_at', { ascending: false });
  if (name === 'shift_reports') query = query.order('work_date', { ascending: false });
  if (name === 'machine_program_versions') query = query.order('version', { ascending: false });
  return query;
}

function buildWorkspace(rows, context) {
  const data = {
    organization: rows.organizations?.[0] || null,
    plants: rows.plants || [],
    departments: rows.departments || [],
    productionLines: rows.production_lines || [],
    workstations: rows.workstations || [],
    machines: rows.machines || [],
    designations: rows.designations || [],
    jobCategories: rows.job_categories || [],
    employees: rows.employees || [],
    roles: rows.roles || [],
    permissions: rows.permissions || [],
    rolePermissions: rows.role_permissions || [],
    userRoles: rows.user_roles || [],
    skills: rows.skills || [],
    certifications: rows.certifications || [],
    employeeSkills: rows.employee_skills || [],
    employeeCertifications: rows.employee_certifications || [],
    projects: rows.projects || [],
    shifts: rows.shifts || [],
    shiftBreaks: rows.shift_breaks || [],
    shiftAssignments: rows.employee_shift_assignments || [],
    attendanceRecords: rows.attendance_records || [],
    holidays: rows.holidays || [],
    leaveRecords: rows.leave_records || [],
    notifications: rows.notifications || [],
    tasks: rows.tasks || [],
    requests: rows.requests || [],
    approvals: rows.approvals || [],
    approvalAuthorities: rows.approval_authorities || [],
    auditLogs: rows.audit_logs || [],
    invitations: rows.invitations || [],
    documents: rows.documents || [],
    medicalRecords: rows.employee_medical || [],
    products: rows.products || [],
    materials: rows.materials || [],
    tools: rows.tools || [],
    productionOrders: rows.production_orders || [],
    taskEvents: rows.task_events || [],
    productionReports: rows.production_reports || [],
    reportMaterials: rows.production_report_materials || [],
    technicalIssues: rows.technical_issues || [],
    toolDamageReports: rows.tool_damage_reports || [],
    safetyIncidents: rows.safety_incidents || [],
    safetyIncidentDetails: rows.safety_incident_details || [],
    shiftReports: rows.shift_reports || [],
    shiftReportTasks: rows.shift_report_tasks || [],
    materialRequests: rows.material_requests || [],
    reassignmentRequests: rows.reassignment_requests || [],
    machinePrograms: rows.machine_programs || [],
    programVersions: rows.machine_program_versions || [],
    machineAuthorizations: rows.employee_machine_authorizations || [],
    sessions: [],
  };

  const plantsById = Object.fromEntries(data.plants.map((item) => [item.id, item]));
  const departmentsById = Object.fromEntries(data.departments.map((item) => [item.id, item]));
  const linesById = Object.fromEntries(data.productionLines.map((item) => [item.id, item]));
  const designationsById = Object.fromEntries(data.designations.map((item) => [item.id, item]));
  const categoriesById = Object.fromEntries(data.jobCategories.map((item) => [item.id, item]));
  const rolesById = Object.fromEntries(data.roles.map((item) => [item.id, item]));
  const skillsById = Object.fromEntries(data.skills.map((item) => [item.id, item]));
  const certsById = Object.fromEntries(data.certifications.map((item) => [item.id, item]));
  const permissionsById = Object.fromEntries(data.permissions.map((item) => [item.id, item]));

  data.roles = data.roles.map((role) => ({
    ...role,
    permissions: data.rolePermissions
      .filter((item) => item.roleId === role.id)
      .map((item) => permissionsById[item.permissionId]?.key)
      .filter(Boolean),
  }));

  data.shifts = data.shifts.map((shift) => ({
    ...shift,
    breaks: data.shiftBreaks.filter((item) => item.shiftId === shift.id),
  }));

  const managerMap = Object.fromEntries(data.employees.map((item) => [item.id, item]));
  data.employees = data.employees.map((employee) => {
    const manager = employee.reportingManagerId ? managerMap[employee.reportingManagerId] : null;
    const assignments = data.userRoles.filter((assignment) => assignment.employeeId === employee.id);
    return {
      ...employee,
      fullName: employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
      displayName: employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
      email: employee.workEmail || employee.email,
      designation: designationsById[employee.designationId]?.title || '—',
      department: departmentsById[employee.departmentId]?.name || '—',
      plant: plantsById[employee.plantId]?.name || '—',
      plantCode: plantsById[employee.plantId]?.code || '—',
      productionLine: linesById[employee.productionLineId]?.name || '—',
      jobCategory: categoriesById[employee.jobCategoryId]?.name || '—',
      reportingManagerName: manager ? manager.fullName : '—',
      roles: assignments.map((assignment) => {
        const role = rolesById[assignment.roleId];
        return { key: role?.key, name: role?.name || role?.key, level: role?.level || 0 };
      }),
      roleKeys: assignments.map((assignment) => rolesById[assignment.roleId]?.key).filter(Boolean),
      skills: data.employeeSkills
        .filter((item) => item.employeeId === employee.id)
        .map((item) => ({
          ...item,
          name: skillsById[item.skillId]?.name,
          category: skillsById[item.skillId]?.category,
        })),
      certifications: data.employeeCertifications
        .filter((item) => item.employeeId === employee.id)
        .map((item) => ({
          ...item,
          name: certsById[item.certificationId]?.name,
          issuingBody: certsById[item.certificationId]?.issuingBody,
        })),
      photoUrl: employee.photoUrl,
    };
  });

  data.employeesById = Object.fromEntries(data.employees.map((employee) => [employee.id, employee]));
  // Module 02 reads the same tasks table; production tasks are the subset that
  // carries a production order. Demo mode supplies `productionTasks` directly.
  data.productionTasks = (data.productionTasks?.length ? data.productionTasks : data.tasks).filter(
    (task) => task.productionOrderId || task.productionStatus,
  );
  data.productsById = Object.fromEntries(data.products.map((item) => [item.id, item]));
  data.materialsById = Object.fromEntries(data.materials.map((item) => [item.id, item]));
  data.toolsById = Object.fromEntries(data.tools.map((item) => [item.id, item]));
  data.productionOrdersById = Object.fromEntries(data.productionOrders.map((item) => [item.id, item]));
  data.machineProgramsById = Object.fromEntries(data.machinePrograms.map((item) => [item.id, item]));
  data.shiftAssignments = data.shiftAssignments.map((assignment) => ({
    ...assignment,
    status: assignment.status || 'active',
  }));
  data.holidays = data.holidays.map((holiday) => ({ ...holiday, date: holiday.holidayDate || holiday.date }));
  data.leaveRecords = data.leaveRecords.map((leave) => ({
    ...leave,
    startDate: leave.startDate || leave.fromDate,
    endDate: leave.endDate || leave.toDate,
  }));
  data.medicalRecords = data.medicalRecords.map((record) => ({ ...record, employeeId: record.employeeId }));
  data.organizations = rows.organizations || [];
  data.context = context;
  return data;
}

async function fetchSupabaseWorkspace(context) {
  const results = await Promise.allSettled(TABLES.map(([name, limit]) => fetchTable(name, limit)));
  const rows = {};
  const errors = [];
  results.forEach((settled, index) => {
    const [name] = TABLES[index];
    const { rows: tableRows, error } = unwrap(settled, name);
    rows[name] = tableRows;
    if (error && !['role_permissions', 'user_roles', 'audit_logs', 'invitations', 'documents', 'employee_medical', 'approval_authorities', 'permissions'].includes(name)) {
      errors.push(error);
    }
  });
  return { data: buildWorkspace(rows, context), errors };
}

export function WorkspaceProvider({ children }) {
  const { context, isDemo } = useAuth();
  const [state, setState] = useState({ loading: true, data: null, errors: [], lastUpdated: null });

  const load = useCallback(async () => {
    if (!context) {
      setState({ loading: false, data: null, errors: [], lastUpdated: null });
      return null;
    }
    setState((current) => ({ ...current, loading: !current.data }));
    if (isDemo) {
      const data = getDemoData();
      setState({ loading: false, data, errors: [], lastUpdated: new Date().toISOString() });
      return data;
    }
    try {
      const { data, errors } = await fetchSupabaseWorkspace(context);
      setState({ loading: false, data, errors, lastUpdated: new Date().toISOString() });
      return data;
    } catch (error) {
      setState({ loading: false, data: null, errors: [error.message], lastUpdated: null });
      return null;
    }
  }, [context, isDemo]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => load(), [load]);

  const value = useMemo(
    () => ({
      ...state,
      data: state.data,
      refresh,
      setData: (next) => setState((current) => ({ ...current, data: next, lastUpdated: new Date().toISOString() })),
    }),
    [state, refresh],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}

export { camelize, buildWorkspace, fetchSupabaseWorkspace };
