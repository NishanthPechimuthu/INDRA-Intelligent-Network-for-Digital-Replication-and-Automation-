import { createDemoData, DEMO_ACCOUNTS, DEMO_PASSWORD } from './demoData.js';

const DATA_KEY = 'indra.platform.demo.data.v3';
const SESSION_KEY = 'indra.platform.demo.session.v3';
const ACCOUNTS_KEY = 'indra.platform.demo.accounts.v3';

let cache = null;

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function getDemoData() {
  if (cache) return cache;
  if (canUseStorage()) {
    const stored = safeParse(window.localStorage.getItem(DATA_KEY), null);
    if (stored?.employees?.length) {
      cache = stored;
      return cache;
    }
  }
  cache = createDemoData();
  persistData(cache);
  return cache;
}

function persistData(data) {
  cache = data;
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
    } catch {
      // Storage quotas must never break the demo session.
    }
  }
}

export function resetDemoData() {
  cache = createDemoData();
  persistData(cache);
  if (canUseStorage()) {
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(ACCOUNTS_KEY);
  }
  return cache;
}

/**
 * Apply a mutation to a cloned dataset, persist it and return the new snapshot.
 * @template T
 * @param {(data: ReturnType<typeof createDemoData>) => T} mutator
 * @returns {{ data: ReturnType<typeof createDemoData>, result: T }}
 */
export function mutateDemoData(mutator) {
  const current = getDemoData();
  const snapshot = typeof structuredClone === 'function' ? structuredClone(current) : JSON.parse(JSON.stringify(current));
  const result = mutator(snapshot);
  persistData(snapshot);
  return { data: snapshot, result };
}

export function demoAccounts() {
  const dynamic = canUseStorage() ? safeParse(window.localStorage.getItem(ACCOUNTS_KEY), []) : [];
  const overridden = new Set(dynamic.map((account) => account.email.toLowerCase()));
  return [...dynamic, ...DEMO_ACCOUNTS.filter((account) => !overridden.has(account.email.toLowerCase()))];
}

export function resetDemoPassword(email, password) {
  if (!password || password.length < 12) return { error: { code: 'weak_password', message: 'Use at least 12 characters for your password.' } };
  const account = findDemoAccount(email);
  if (!account) return { error: { code: 'account_not_found', message: 'No demo account matches that email address.' } };
  const dynamic = canUseStorage() ? safeParse(window.localStorage.getItem(ACCOUNTS_KEY), []) : [];
  const next = dynamic.filter((item) => item.email.toLowerCase() !== email.toLowerCase());
  next.push({ ...account, password, label: account.label || 'Demo account' });
  if (canUseStorage()) window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
  return { message: 'Demo password updated. Sign in with your new password.' };
}

export function findDemoAccount(email) {
  return demoAccounts().find((account) => account.email.toLowerCase() === String(email || '').trim().toLowerCase()) || null;
}

export function demoLogin(email, password) {
  const account = findDemoAccount(email);
  if (!account) return { error: { code: 'invalid_credentials', message: 'No INDRA account matches that email address.' } };
  if (account.password !== password) return { error: { code: 'invalid_credentials', message: 'Incorrect password. Check the demo password and try again.' } };
  const data = getDemoData();
  const employee = data.employeesById[account.employeeId];
  if (!employee) return { error: { code: 'profile_missing', message: 'The employee profile is missing for this account.' } };
  if (employee.employmentStatus === 'suspended' || employee.employmentStatus === 'terminated') {
    return { error: { code: 'suspended', message: `Account is ${employee.employmentStatus}. Contact your HR administrator.` } };
  }
  const session = {
    employeeId: account.employeeId,
    email: account.email,
    sessionId: `session-${Date.now()}`,
    startedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Demo browser',
  };
  if (canUseStorage()) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { session, employee };
}

export function getDemoSession() {
  if (!canUseStorage()) return null;
  const session = safeParse(window.localStorage.getItem(SESSION_KEY), null);
  if (!session?.employeeId) return null;
  const employee = getDemoData().employeesById[session.employeeId];
  if (!employee) return null;
  if (employee.employmentStatus === 'suspended' || employee.employmentStatus === 'terminated') return { ...session, suspended: true };
  return session;
}

export function clearDemoSession() {
  if (canUseStorage()) window.localStorage.removeItem(SESSION_KEY);
}

export function markNotificationRead(notificationId, read = true) {
  return mutateDemoData((data) => {
    const item = data.notifications.find((notification) => notification.id === notificationId);
    if (item) item.readAt = read ? new Date().toISOString() : null;
    return item;
  });
}

export function markAllNotificationsRead(employeeId) {
  return mutateDemoData((data) => {
    data.notifications
      .filter((notification) => notification.recipientEmployeeId === employeeId && !notification.readAt)
      .forEach((notification) => {
        notification.readAt = new Date().toISOString();
      });
    return true;
  });
}

export function updateTaskStatus(taskId, status, actorEmployeeId) {
  return mutateDemoData((data) => {
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error('Task not found');
    task.status = status;
    task.updatedAt = new Date().toISOString();
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: task.organizationId,
      actorEmployeeId,
      action: 'task.status_changed',
      entityType: 'task',
      entityId: task.id,
      summary: `Task “${task.title}” moved to ${status.replaceAll('_', ' ')}`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return task;
  });
}

export function createRequest(payload, actorEmployeeId) {
  return mutateDemoData((data) => {
    const employee = data.employeesById[actorEmployeeId];
    const id = `req-${Date.now()}`;
    const request = {
      id,
      organizationId: employee.organizationId,
      employeeId: actorEmployeeId,
      requestType: payload.requestType,
      title: payload.title,
      details: payload.details,
      amount: payload.amount ? Number(payload.amount) : null,
      status: 'submitted',
      currentApproverId: employee.reportingManagerId || data.employees.find((item) => item.id === employee.reportingManagerId)?.id || null,
      departmentId: employee.departmentId,
      plantId: employee.plantId,
      customerVisible: Boolean(payload.customerVisible),
      submittedAt: new Date().toISOString(),
      decidedAt: null,
      decisionNotes: null,
    };
    data.requests.unshift(request);
    if (request.currentApproverId) {
      data.approvals.unshift({
        id: `appr-${Date.now()}`,
        requestId: id,
        step: 1,
        approverEmployeeId: request.currentApproverId,
        status: 'pending',
        decidedAt: null,
        comments: null,
      });
      data.notifications.unshift({
        id: `notif-${Date.now()}`,
        recipientEmployeeId: request.currentApproverId,
        title: 'New approval request',
        body: `${employee.fullName} submitted “${payload.title}”.`,
        category: 'approval',
        link: '/approvals',
        readAt: null,
        createdAt: new Date().toISOString(),
      });
    }
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: employee.organizationId,
      actorEmployeeId,
      action: 'request.submitted',
      entityType: 'request',
      entityId: id,
      summary: `Submitted ${payload.requestType} request: ${payload.title}`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return request;
  });
}

export function decideApproval({ requestId, approvalId, decision, comments }, actorEmployeeId) {
  if (!['approved', 'rejected'].includes(decision)) throw new Error('Decision must be approved or rejected');
  return mutateDemoData((data) => {
    const request = data.requests.find((item) => item.id === requestId);
    if (!request) throw new Error('Request not found');
    if (request.employeeId === actorEmployeeId) throw new Error('Segregation of duties: you cannot approve your own request.');
    if (request.status !== 'submitted') throw new Error('This request has already been decided.');
    const step = data.approvals.find((item) => item.id === approvalId && item.requestId === requestId);
    if (!step) throw new Error('Approval step not found');
    if (step.approverEmployeeId !== actorEmployeeId) throw new Error('You are not the configured approver for this step.');
    step.status = decision;
    step.comments = comments || null;
    step.decidedAt = new Date().toISOString();
    const next = data.approvals
      .filter((item) => item.requestId === requestId && item.status === 'waiting')
      .sort((a, b) => a.step - b.step)[0];
    if (decision === 'rejected') {
      request.status = 'rejected';
      request.decidedAt = step.decidedAt;
      request.decisionNotes = comments || 'Rejected';
      request.currentApproverId = null;
    } else if (next) {
      next.status = 'pending';
      request.currentApproverId = next.approverEmployeeId;
      data.notifications.unshift({
        id: `notif-${Date.now()}`,
        recipientEmployeeId: next.approverEmployeeId,
        title: 'Approval passed to you',
        body: `“${request.title}” was approved at step ${step.step}.`,
        category: 'approval',
        link: '/approvals',
        readAt: null,
        createdAt: new Date().toISOString(),
      });
    } else {
      request.status = 'approved';
      request.decidedAt = step.decidedAt;
      request.decisionNotes = comments || 'Approved';
      request.currentApproverId = null;
      if (request.requestType === 'leave' && request.employeeId) {
        const leave = data.leaveRecords.find((item) => item.employeeId === request.employeeId && item.status === 'submitted');
        if (leave) {
          leave.status = 'approved';
          leave.approvedBy = actorEmployeeId;
          leave.approvedAt = step.decidedAt;
        }
      }
    }
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: request.organizationId,
      actorEmployeeId,
      action: `request.${decision}`,
      entityType: 'request',
      entityId: requestId,
      summary: `${decision === 'approved' ? 'Approved' : 'Rejected'} request: ${request.title}`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    data.notifications.unshift({
      id: `notif-${Date.now() + 1}`,
      recipientEmployeeId: request.employeeId,
      title: `Request ${decision}`,
      body: `“${request.title}” was ${decision}${comments ? `: ${comments}` : '.'}`,
      category: 'approval',
      link: '/requests',
      readAt: null,
      createdAt: new Date().toISOString(),
    });
    return request;
  });
}

export function updateEmployee(employeeId, patch, actorEmployeeId) {
  return mutateDemoData((data) => {
    const employee = data.employeesById[employeeId];
    if (!employee) throw new Error('Employee not found');
    Object.assign(employee, patch);
    employee.updatedAt = new Date().toISOString();
    data.employees = data.employees.map((item) => (item.id === employeeId ? employee : item));
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: employee.organizationId,
      actorEmployeeId,
      action: 'employee.updated',
      entityType: 'employee',
      entityId: employeeId,
      summary: `Updated profile for ${employee.fullName}`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return employee;
  });
}

export function assignRole(employeeId, roleKey, actorEmployeeId) {
  return mutateDemoData((data) => {
    const employee = data.employeesById[employeeId];
    if (!employee) throw new Error('Employee not found');
    if (!employee.roleKeys.includes(roleKey)) {
      employee.roleKeys.push(roleKey);
      employee.roles.push({ key: roleKey, name: roleKey, level: 0 });
      data.userRoles.push({
        id: `user-role-${employeeId}-${roleKey}`,
        employeeId,
        roleId: `role-${roleKey}`,
        roleKey,
        roleName: roleKey,
        assignedAt: new Date().toISOString(),
      });
      data.auditLogs.unshift({
        id: `audit-${Date.now()}`,
        organizationId: employee.organizationId,
        actorEmployeeId,
        action: 'role.assigned',
        entityType: 'user_role',
        entityId: `user-role-${employeeId}-${roleKey}`,
        summary: `Assigned ${roleKey} role to ${employee.fullName}`,
        ipAddress: 'demo',
        createdAt: new Date().toISOString(),
      });
    }
    return employee;
  });
}

export function removeRole(employeeId, roleKey, actorEmployeeId) {
  return mutateDemoData((data) => {
    const employee = data.employeesById[employeeId];
    if (!employee) throw new Error('Employee not found');
    employee.roleKeys = employee.roleKeys.filter((key) => key !== roleKey);
    employee.roles = employee.roles.filter((role) => role.key !== roleKey);
    data.userRoles = data.userRoles.filter((assignment) => !(assignment.employeeId === employeeId && assignment.roleKey === roleKey));
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: employee.organizationId,
      actorEmployeeId,
      action: 'role.removed',
      entityType: 'user_role',
      entityId: `user-role-${employeeId}-${roleKey}`,
      summary: `Removed ${roleKey} role from ${employee.fullName}`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return employee;
  });
}

export function createShift(payload, actorEmployeeId) {
  return mutateDemoData((data) => {
    const id = `shift-${Date.now()}`;
    const shift = {
      id,
      organizationId: data.organization.id,
      plantId: payload.plantId || null,
      departmentId: payload.departmentId || null,
      code: payload.code,
      name: payload.name,
      startTime: payload.startTime,
      endTime: payload.endTime,
      timezone: payload.timezone || 'Asia/Kolkata',
      lunchStart: payload.lunchStart || null,
      lunchEnd: payload.lunchEnd || null,
      graceMinutes: Number(payload.graceMinutes) || 0,
      overtimePolicy: payload.overtimePolicy || 'none',
      overtimeMultiplier: Number(payload.overtimeMultiplier) || 1,
      weeklyWorkingDays: payload.weeklyWorkingDays?.length ? payload.weeklyWorkingDays : [1, 2, 3, 4, 5],
      effectiveFrom: payload.effectiveFrom || new Date().toISOString().slice(0, 10),
      effectiveTo: payload.effectiveTo || null,
      isActive: true,
      color: payload.color || '#cdf22b',
      breaks: (payload.breaks || []).map((item, index) => ({ ...item, id: `${id}-break-${index + 1}` })),
    };
    data.shifts.push(shift);
    shift.breaks.forEach((item) => data.shiftBreaks.push({ ...item, shiftId: id }));
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: data.organization.id,
      actorEmployeeId,
      action: 'shift.created',
      entityType: 'shift',
      entityId: id,
      summary: `Created shift ${shift.name} (${shift.code})`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return shift;
  });
}

export function updateShift(shiftId, patch, actorEmployeeId) {
  return mutateDemoData((data) => {
    const shift = data.shifts.find((item) => item.id === shiftId);
    if (!shift) throw new Error('Shift not found');
    Object.assign(shift, patch);
    shift.updatedAt = new Date().toISOString();
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: shift.organizationId,
      actorEmployeeId,
      action: 'shift.updated',
      entityType: 'shift',
      entityId: shiftId,
      summary: `Updated shift ${shift.name}`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return shift;
  });
}

export function assignShift(employeeId, shiftId, effectiveFrom, actorEmployeeId) {
  return mutateDemoData((data) => {
    const employee = data.employeesById[employeeId];
    const shift = data.shifts.find((item) => item.id === shiftId);
    if (!employee || !shift) throw new Error('Employee or shift not found');
    const active = data.shiftAssignments.find(
      (item) => item.employeeId === employeeId && !item.effectiveTo,
    );
    if (active) active.effectiveTo = dateBefore(effectiveFrom);
    data.shiftAssignments.push({
      id: `assignment-${Date.now()}`,
      organizationId: data.organization.id,
      employeeId,
      shiftId,
      effectiveFrom,
      effectiveTo: null,
      status: 'planned',
      assignedBy: actorEmployeeId,
      notes: null,
      createdAt: new Date().toISOString(),
    });
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: data.organization.id,
      actorEmployeeId,
      action: 'shift.assigned',
      entityType: 'employee_shift_assignment',
      entityId: `assignment-${Date.now()}`,
      summary: `Assigned ${shift.name} to ${employee.fullName} from ${effectiveFrom}`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return true;
  });
}

function dateBefore(dateString) {
  const value = new Date(`${dateString}T00:00:00`);
  value.setDate(value.getDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function inviteEmployee(payload, actorEmployeeId) {
  return mutateDemoData((data) => {
    const invitation = {
      id: `inv-${Date.now()}`,
      organizationId: data.organization.id,
      email: payload.email,
      employeeId: payload.employeeId || null,
      roleKey: payload.roleKey || 'operator',
      departmentId: payload.departmentId || null,
      plantId: payload.plantId || null,
      status: 'pending',
      invitedBy: actorEmployeeId,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      token: `demo-${Math.random().toString(36).slice(2, 10)}`,
    };
    data.invitations.unshift(invitation);
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: data.organization.id,
      actorEmployeeId,
      action: 'invitation.sent',
      entityType: 'invitation',
      entityId: invitation.id,
      summary: `Invited ${payload.email} as ${payload.roleKey}`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return invitation;
  });
}

export function revokeInvitation(invitationId, actorEmployeeId) {
  return mutateDemoData((data) => {
    const invitation = data.invitations.find((item) => item.id === invitationId);
    if (!invitation) throw new Error('Invitation not found');
    invitation.status = 'revoked';
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: data.organization.id,
      actorEmployeeId,
      action: 'invitation.revoked',
      entityType: 'invitation',
      entityId: invitationId,
      summary: `Revoked invitation for ${invitation.email}`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return invitation;
  });
}

export function activateInvitation({ invitationId, email, password }) {
  const data = getDemoData();
  const invitation = data.invitations.find(
    (item) => (invitationId && item.id === invitationId) || item.email.toLowerCase() === String(email).toLowerCase(),
  );
  if (!invitation) return { error: { code: 'invitation_not_found', message: 'This invitation link is invalid or has expired.' } };
  if (invitation.status === 'accepted') return { error: { code: 'already_accepted', message: 'This invitation has already been activated.' } };
  if (invitation.status === 'revoked') return { error: { code: 'revoked', message: 'This invitation was revoked. Ask your administrator for a new one.' } };
  if (new Date(invitation.expiresAt) < new Date()) return { error: { code: 'expired', message: 'This invitation has expired. Ask your administrator for a new one.' } };
  if (!password || password.length < 12) return { error: { code: 'weak_password', message: 'Use at least 12 characters for your password.' } };

  const { data: nextData } = mutateDemoData((snapshot) => {
    const target = snapshot.invitations.find((item) => item.id === invitation.id);
    target.status = 'accepted';
    let employeeId = target.employeeId;
    if (employeeId && snapshot.employeesById[employeeId]) {
      const employee = snapshot.employeesById[employeeId];
      employee.employmentStatus = 'active';
      employee.updatedAt = new Date().toISOString();
    } else {
      employeeId = `emp-${Date.now()}`;
      const roleName = invitation.roleKey.replaceAll('_', ' ');
      const employee = {
        id: employeeId,
        organizationId: snapshot.organization.id,
        employeeCode: `IND-${String(snapshot.employees.length + 1).padStart(4, '0')}`,
        firstName: email.split('@')[0],
        lastName: '',
        fullName: email.split('@')[0],
        email,
        workEmail: email,
        phone: '',
        designationId: 'des-operator',
        designation: 'Invited employee',
        departmentId: invitation.departmentId,
        department: snapshot.departments.find((item) => item.id === invitation.departmentId)?.name || '—',
        plantId: invitation.plantId,
        plant: snapshot.plants.find((item) => item.id === invitation.plantId)?.name || '—',
        productionLineId: null,
        productionLine: '—',
        jobCategoryId: 'jc-skilled',
        jobCategory: 'Skilled trade',
        reportingManagerId: null,
        reportingManagerName: '—',
        employmentStatus: 'active',
        joinedOn: new Date().toISOString().slice(0, 10),
        shiftId: 'shift-general',
        location: '—',
        roleKeys: [invitation.roleKey],
        roles: [{ key: invitation.roleKey, name: roleName, level: 0 }],
        skills: [],
        certifications: [],
      };
      snapshot.employees.push(employee);
      snapshot.employeesById[employeeId] = employee;
      snapshot.userRoles.push({
        id: `user-role-${employeeId}-${invitation.roleKey}`,
        employeeId,
        roleId: `role-${invitation.roleKey}`,
        roleKey: invitation.roleKey,
        roleName,
        assignedAt: new Date().toISOString(),
      });
    }
    return employeeId;
  });

  const accounts = canUseStorage() ? safeParse(window.localStorage.getItem(ACCOUNTS_KEY), []) : [];
  const account = {
    employeeId: nextData.employees.find((employee) => employee.email.toLowerCase() === email.toLowerCase())?.id || invitation.employeeId,
    email,
    label: 'Activated invitation',
    roles: [invitation.roleKey],
    password,
  };
  if (canUseStorage()) {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts.filter((item) => item.email !== email), account]));
  }
  return { employeeId: account.employeeId, email };
}

export function updateApprovalAuthority(authorityId, patch, actorEmployeeId) {
  return mutateDemoData((data) => {
    const authority = data.approvalAuthorities.find((item) => item.id === authorityId);
    if (!authority) throw new Error('Approval authority not found');
    Object.assign(authority, patch);
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: authority.organizationId,
      actorEmployeeId,
      action: 'approval_authority.updated',
      entityType: 'approval_authority',
      entityId: authorityId,
      summary: `Updated approval authority for ${authority.requestType}`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return authority;
  });
}

export function createDepartment(payload, actorEmployeeId) {
  return mutateDemoData((data) => {
    const department = {
      id: `dept-${Date.now()}`,
      organizationId: data.organization.id,
      plantId: payload.plantId,
      name: payload.name,
      code: payload.code,
      costCenter: payload.costCenter || null,
      managerEmployeeId: payload.managerEmployeeId || null,
    };
    data.departments.push(department);
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: data.organization.id,
      actorEmployeeId,
      action: 'department.created',
      entityType: 'department',
      entityId: department.id,
      summary: `Created department ${department.name} (${department.code})`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return department;
  });
}

export function updateDepartment(departmentId, patch, actorEmployeeId) {
  return mutateDemoData((data) => {
    const department = data.departments.find((item) => item.id === departmentId);
    if (!department) throw new Error('Department not found');
    Object.assign(department, patch);
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: data.organization.id,
      actorEmployeeId,
      action: 'department.updated',
      entityType: 'department',
      entityId: departmentId,
      summary: `Updated department ${department.name}`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return department;
  });
}

export function updateRolePermissions(roleKey, permissions, actorEmployeeId) {
  return mutateDemoData((data) => {
    const role = data.roles.find((item) => item.key === roleKey);
    if (!role) throw new Error('Role not found');
    role.permissions = [...new Set(permissions)];
    role.updatedAt = new Date().toISOString();
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: data.organization.id,
      actorEmployeeId,
      action: 'role.permissions_updated',
      entityType: 'role',
      entityId: role.id || roleKey,
      summary: `Updated ${role.name} permissions (${role.permissions.length} granted)`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return role;
  });
}

export function updateOrganization(patch, actorEmployeeId) {
  return mutateDemoData((data) => {
    Object.assign(data.organization, patch, { updatedAt: new Date().toISOString() });
    data.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      organizationId: data.organization.id,
      actorEmployeeId,
      action: 'organization.updated',
      entityType: 'organization',
      entityId: data.organization.id,
      summary: `Updated organization profile for ${data.organization.name}`,
      ipAddress: 'demo',
      createdAt: new Date().toISOString(),
    });
    return data.organization;
  });
}

export function getDemoSessions() {
  const data = getDemoData();
  const session = getDemoSession();
  if (!session) return data.sessions.map((item) => ({ ...item, current: false }));
  // Prefer the signed-in session id; seeded demo data has no matching record,
  // in which case the most recent (first) entry represents this browser.
  const activeId = session.sessionId;
  const hasMatch = data.sessions.some((item) => item.id === activeId);
  return data.sessions.map((item, index) => ({
    ...item,
    current: hasMatch ? item.id === activeId : index === 0,
  }));
}

export function signOutOtherSessions() {
  return mutateDemoData((data) => {
    data.sessions = data.sessions.filter((item) => item.id === 'session-current');
    return true;
  });
}

export { DEMO_PASSWORD };
