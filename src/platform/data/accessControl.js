/**
 * Shared access-control catalogue for the INDRA platform.
 *
 * The same permission keys are seeded into Supabase (`supabase/seed.sql`) and
 * enforced by PostgreSQL RLS helper functions. The browser copy is used only to
 * render navigation and to fail fast. Every mutation still goes through RLS or
 * a protected RPC/Edge Function, so hiding a button is never the authorization.
 */

/** @typedef {{ key: string, module: string, action: string, description: string }} Permission */
/** @typedef {{ key: string, name: string, level: number, description: string, permissions: string[] }} RoleDefinition */

/** @type {Permission[]} */
export const PERMISSIONS = [
  { key: 'organization.read', module: 'organization', action: 'read', description: 'View organization profile and settings' },
  { key: 'organization.manage', module: 'organization', action: 'manage', description: 'Create and update organization records' },
  { key: 'plants.read', module: 'plants', action: 'read', description: 'View plants' },
  { key: 'plants.manage', module: 'plants', action: 'manage', description: 'Create and update plants' },
  { key: 'departments.read', module: 'departments', action: 'read', description: 'View departments' },
  { key: 'departments.manage', module: 'departments', action: 'manage', description: 'Create and update departments' },
  { key: 'production_lines.read', module: 'production_lines', action: 'read', description: 'View production lines' },
  { key: 'production_lines.manage', module: 'production_lines', action: 'manage', description: 'Create and update production lines' },
  { key: 'workstations.read', module: 'workstations', action: 'read', description: 'View workstations' },
  { key: 'workstations.manage', module: 'workstations', action: 'manage', description: 'Create and update workstations' },
  { key: 'machines.read', module: 'machines', action: 'read', description: 'View machines' },
  { key: 'machines.manage', module: 'machines', action: 'manage', description: 'Create and update machines' },
  { key: 'employees.read', module: 'employees', action: 'read', description: 'View employee directory and profiles' },
  { key: 'employees.read.all', module: 'employees', action: 'read.all', description: 'View employees beyond own plant/department' },
  { key: 'employees.manage', module: 'employees', action: 'manage', description: 'Invite and maintain employees' },
  { key: 'employees.medical.read', module: 'employees', action: 'medical.read', description: 'View restricted medical information' },
  { key: 'designations.read', module: 'designations', action: 'read', description: 'View designations' },
  { key: 'designations.manage', module: 'designations', action: 'manage', description: 'Maintain designations' },
  { key: 'job_categories.read', module: 'job_categories', action: 'read', description: 'View job categories' },
  { key: 'job_categories.manage', module: 'job_categories', action: 'manage', description: 'Maintain job categories' },
  { key: 'skills.read', module: 'skills', action: 'read', description: 'View skills matrix' },
  { key: 'skills.manage', module: 'skills', action: 'manage', description: 'Maintain skills and certifications' },
  { key: 'certifications.read', module: 'certifications', action: 'read', description: 'View certifications' },
  { key: 'certifications.manage', module: 'certifications', action: 'manage', description: 'Maintain certifications' },
  { key: 'roles.read', module: 'roles', action: 'read', description: 'View roles and permission matrix' },
  { key: 'roles.manage', module: 'roles', action: 'manage', description: 'Assign roles and maintain permissions' },
  { key: 'approval_authorities.manage', module: 'approval_authorities', action: 'manage', description: 'Configure approval authority thresholds' },
  { key: 'shifts.read', module: 'shifts', action: 'read', description: 'View shifts and schedules' },
  { key: 'shifts.manage', module: 'shifts', action: 'manage', description: 'Create and update shift definitions' },
  { key: 'shifts.assign', module: 'shifts', action: 'assign', description: 'Assign shifts to employees' },
  { key: 'attendance.read.self', module: 'attendance', action: 'read.self', description: 'View own attendance' },
  { key: 'attendance.read.all', module: 'attendance', action: 'read.all', description: 'View team or plant attendance' },
  { key: 'attendance.manage', module: 'attendance', action: 'manage', description: 'Correct attendance records' },
  { key: 'leave.read', module: 'leave', action: 'read', description: 'View leave records' },
  { key: 'leave.approve', module: 'leave', action: 'approve', description: 'Approve or reject leave' },
  { key: 'projects.read', module: 'projects', action: 'read', description: 'View projects' },
  { key: 'projects.manage', module: 'projects', action: 'manage', description: 'Create and update projects' },
  { key: 'tasks.read.self', module: 'tasks', action: 'read.self', description: 'View own tasks' },
  { key: 'tasks.read.all', module: 'tasks', action: 'read.all', description: 'View all tasks in scope' },
  { key: 'tasks.manage', module: 'tasks', action: 'manage', description: 'Create and reassign tasks' },
  { key: 'requests.create', module: 'requests', action: 'create', description: 'Raise requests' },
  { key: 'requests.read.self', module: 'requests', action: 'read.self', description: 'View own requests' },
  { key: 'requests.read.all', module: 'requests', action: 'read.all', description: 'View requests in scope' },
  { key: 'requests.approve', module: 'requests', action: 'approve', description: 'Approve requests' },
  { key: 'notifications.read', module: 'notifications', action: 'read', description: 'Read own notifications' },
  { key: 'notifications.manage', module: 'notifications', action: 'manage', description: 'Send organization notifications' },
  { key: 'audit.read', module: 'audit', action: 'read', description: 'Read audit and activity history' },
  { key: 'reports.read', module: 'reports', action: 'read', description: 'View operational reports' },
  { key: 'documents.read', module: 'documents', action: 'read', description: 'View documents and evidence' },
  { key: 'documents.upload', module: 'documents', action: 'upload', description: 'Upload documents and evidence' },
  { key: 'documents.delete', module: 'documents', action: 'delete', description: 'Delete documents and evidence' },
  { key: 'security.sessions.read', module: 'security', action: 'sessions.read', description: 'View own active sessions' },
  { key: 'production.orders.read', module: 'production', action: 'orders.read', description: 'View production orders' },
  { key: 'production.orders.manage', module: 'production', action: 'orders.manage', description: 'Plan and release production orders' },
  { key: 'production.reports.read', module: 'production', action: 'reports.read', description: 'View production reporting for the team or plant' },
  { key: 'production.reports.create', module: 'production', action: 'reports.create', description: 'Record production output and defects' },
  { key: 'production.reports.manage', module: 'production', action: 'reports.manage', description: 'Correct or remove production reports' },
  { key: 'production.issues.create', module: 'production', action: 'issues.create', description: 'Report technical, tool and material issues' },
  { key: 'production.issues.read', module: 'production', action: 'issues.read', description: 'View operational issues in scope' },
  { key: 'production.issues.manage', module: 'production', action: 'issues.manage', description: 'Resolve and close operational issues' },
  { key: 'materials.read', module: 'materials', action: 'read', description: 'View material master and stock' },
  { key: 'materials.manage', module: 'materials', action: 'manage', description: 'Maintain material master and stock levels' },
  { key: 'tools.read', module: 'tools', action: 'read', description: 'View the tooling register' },
  { key: 'tools.manage', module: 'tools', action: 'manage', description: 'Maintain the tooling register' },
  { key: 'handover.read', module: 'handover', action: 'read', description: 'Review shift completion and handover reports' },
  { key: 'handover.submit', module: 'handover', action: 'submit', description: 'Submit shift completion and handover reports' },
  { key: 'reassignment.create', module: 'reassignment', action: 'create', description: 'Propose employee reassignments' },
  { key: 'reassignment.approve', module: 'reassignment', action: 'approve', description: 'Approve or reject reassignment proposals' },
  { key: 'programs.read', module: 'programs', action: 'read', description: 'View machine programs and revision history' },
  { key: 'programs.manage', module: 'programs', action: 'manage', description: 'Register machine program versions and evidence' },
  { key: 'programs.approve', module: 'programs', action: 'approve', description: 'Approve machine program versions' },
  { key: 'safety.report', module: 'safety', action: 'report', description: 'Report safety incidents' },
  { key: 'safety.operational.read', module: 'safety', action: 'operational.read', description: 'View operational safety information for the team' },
  { key: 'safety.medical.read', module: 'safety', action: 'medical.read', description: 'View restricted occupational health detail' },
  { key: 'workforce.team.read', module: 'workforce', action: 'team.read', description: 'View assigned team, availability and workload' },
  { key: 'digital_twin.read', module: 'digital_twin', action: 'read', description: 'Open the digital twin studio' },
  { key: 'digital_twin.manage', module: 'digital_twin', action: 'manage', description: 'Edit and approve digital twin changes' },
];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key);

const READ_ONLY_BASE = [
  'organization.read',
  'plants.read',
  'departments.read',
  'production_lines.read',
  'workstations.read',
  'machines.read',
  'employees.read',
  'designations.read',
  'job_categories.read',
  'skills.read',
  'certifications.read',
  'shifts.read',
  'attendance.read.self',
  'leave.read',
  'projects.read',
  'tasks.read.self',
  'requests.create',
  'requests.read.self',
  'notifications.read',
  'documents.read',
  'security.sessions.read',
  'digital_twin.read',
];

const APPROVAL_BASE = [...READ_ONLY_BASE, 'requests.approve', 'requests.read.all', 'leave.approve', 'tasks.read.all'];

/** The sixteen initial INDRA roles. */
/** @type {RoleDefinition[]} */
export const ROLES = [
  {
    key: 'operator',
    name: 'Operator',
    level: 10,
    description: 'Runs assigned workstations and records production activity.',
    permissions: [...READ_ONLY_BASE, 'documents.upload', 'production.orders.read', 'production.reports.create',
      'production.reports.read', 'production.issues.create', 'materials.read', 'tools.read',
      'handover.submit', 'programs.read', 'safety.report'],
  },
  {
    key: 'supervisor',
    name: 'Supervisor',
    level: 30,
    description: 'Leads a shift, approves operational requests and manages attendance.',
    permissions: [...APPROVAL_BASE, 'attendance.read.all', 'shifts.assign', 'attendance.manage', 'documents.upload',
      'production.orders.read', 'production.orders.manage', 'production.reports.read', 'production.reports.create',
      'production.issues.create', 'production.issues.read', 'production.issues.manage', 'materials.read',
      'materials.manage', 'tools.read', 'handover.read', 'handover.submit', 'reassignment.create',
      'programs.read', 'safety.report', 'safety.operational.read', 'workforce.team.read'],
  },
  {
    key: 'programmer',
    name: 'Programmer',
    level: 25,
    description: 'Maintains machine programs and production configuration.',
    permissions: [...READ_ONLY_BASE, 'machines.manage', 'workstations.manage', 'digital_twin.manage', 'documents.upload',
      'production.orders.read', 'production.reports.read', 'production.issues.read', 'materials.read',
      'tools.read', 'programs.read', 'programs.manage', 'safety.report'],
  },
  {
    key: 'technical_assistant',
    name: 'Technical Assistant',
    level: 20,
    description: 'Supports engineering documentation, evidence and machine records.',
    permissions: [...READ_ONLY_BASE, 'documents.upload', 'tasks.manage'],
  },
  {
    key: 'technical_analyst',
    name: 'Technical Analyst',
    level: 30,
    description: 'Analyses technical performance and prepares evidence packs.',
    permissions: [...READ_ONLY_BASE, 'reports.read', 'documents.upload', 'tasks.read.all'],
  },
  {
    key: 'material_analyst',
    name: 'Material Analyst',
    level: 30,
    description: 'Tracks material flow, buffers and consumption variances.',
    permissions: [...READ_ONLY_BASE, 'reports.read', 'production_lines.manage', 'tasks.read.all'],
  },
  {
    key: 'hr_analyst',
    name: 'HR Analyst',
    level: 35,
    description: 'Maintains workforce records, invitations and attendance policy.',
    permissions: [
      ...READ_ONLY_BASE,
      'employees.read.all',
      'employees.manage',
      'attendance.read.all',
      'attendance.manage',
      'shifts.assign',
      'leave.approve',
      'reports.read',
      'documents.upload',
      'tasks.read.all',
      'requests.read.all',
      'employees.medical.read',
      'safety.medical.read',
      'reassignment.approve',
      'handover.read',
      'workforce.team.read',
    ],
  },
  {
    key: 'resource_analyst',
    name: 'Resource Analyst',
    level: 35,
    description: 'Plans people, machines and shift capacity across plants.',
    permissions: [...READ_ONLY_BASE, 'employees.read.all', 'shifts.assign', 'shifts.manage', 'reports.read', 'tasks.read.all', 'attendance.read.all'],
  },
  {
    key: 'hod',
    name: 'HOD',
    level: 50,
    description: 'Heads a department with department-scoped approvals and reporting.',
    permissions: [...APPROVAL_BASE, 'attendance.read.all', 'shifts.assign', 'reports.read', 'audit.read', 'tasks.manage', 'documents.upload', 'projects.manage', 'machines.manage',
      'production.orders.read', 'production.orders.manage', 'production.reports.read', 'production.reports.manage',
      'production.issues.read', 'production.issues.manage', 'materials.read', 'materials.manage', 'tools.read',
      'tools.manage', 'handover.read', 'reassignment.create', 'reassignment.approve', 'programs.read',
      'programs.approve', 'safety.report', 'safety.operational.read', 'workforce.team.read'],
  },
  {
    key: 'finance',
    name: 'Finance / Accounts',
    level: 40,
    description: 'Owns financial approvals, cost centres and expenditure requests.',
    permissions: [...APPROVAL_BASE, 'reports.read', 'audit.read', 'documents.upload', 'tasks.read.all'],
  },
  {
    key: 'plant_head',
    name: 'Plant Head',
    level: 70,
    description: 'Accountable for a plant: full plant-scoped operations and approvals.',
    permissions: [
      ...APPROVAL_BASE,
      'employees.read.all',
      'attendance.read.all',
      'shifts.assign',
      'shifts.manage',
      'reports.read',
      'audit.read',
      'tasks.manage',
      'documents.upload',
      'projects.manage',
      'machines.manage',
      'production_lines.manage',
      'workstations.manage',
      'departments.manage',
      'digital_twin.manage',
      'approval_authorities.manage',
      'production.orders.read', 'production.orders.manage', 'production.reports.read', 'production.reports.manage',
      'production.issues.read', 'production.issues.manage', 'materials.read', 'materials.manage', 'tools.read',
      'tools.manage', 'handover.read', 'reassignment.create', 'reassignment.approve', 'programs.read',
      'programs.approve', 'programs.manage', 'safety.report', 'safety.operational.read', 'safety.medical.read',
      'workforce.team.read',
    ],
  },
  {
    key: 'administrator',
    name: 'Administrator',
    level: 90,
    description: 'Platform administrator for the organization.',
    permissions: [...ALL_PERMISSION_KEYS],
  },
  {
    key: 'quality_engineer',
    name: 'Quality Engineer',
    level: 35,
    description: 'Owns inspection, quality evidence and rejection analysis.',
    permissions: [...READ_ONLY_BASE, 'reports.read', 'documents.upload', 'documents.delete', 'tasks.read.all', 'machines.manage',
      'production.orders.read', 'production.reports.read', 'production.issues.read', 'production.issues.manage',
      'materials.read', 'tools.read', 'handover.read', 'programs.read', 'workforce.team.read'],
  },
  {
    key: 'ehs_officer',
    name: 'EHS Officer',
    level: 35,
    description: 'Owns environment, health and safety controls and evidence.',
    permissions: [...READ_ONLY_BASE, 'employees.medical.read', 'reports.read', 'documents.upload', 'audit.read', 'tasks.read.all',
      'safety.report', 'safety.operational.read', 'safety.medical.read', 'production.issues.read',
      'production.issues.manage'],
  },
  {
    key: 'customer_approver',
    name: 'Customer Approver',
    level: 20,
    description: 'External customer reviewer with read-only access to assigned approvals.',
    permissions: ['organization.read', 'projects.read', 'tasks.read.self', 'requests.read.self', 'requests.approve', 'notifications.read', 'documents.read'],
  },
  {
    key: 'verification_engineer',
    name: 'Verification Engineer',
    level: 35,
    description: 'Independently verifies records, evidence and change approvals.',
    permissions: [...READ_ONLY_BASE, 'employees.read.all', 'reports.read', 'audit.read', 'documents.upload', 'tasks.read.all', 'requests.approve'],
  },
];

export const ROLE_BY_KEY = Object.fromEntries(ROLES.map((role) => [role.key, role]));
export const PERMISSION_BY_KEY = Object.fromEntries(PERMISSIONS.map((permission) => [permission.key, permission]));

/**
 * Expand a granted permission list. Wildcards are deliberately supported so a
 * role such as Administrator can be expressed as `*` while every concrete key
 * still exists in the catalogue.
 * @param {string[]} granted
 * @returns {Set<string>}
 */
export function expandPermissions(granted = []) {
  const expanded = new Set();
  for (const key of granted) {
    if (key === '*') {
      ALL_PERMISSION_KEYS.forEach((permission) => expanded.add(permission));
    } else if (key.endsWith('.*')) {
      const module = key.slice(0, -2);
      ALL_PERMISSION_KEYS.filter((permission) => permission.startsWith(`${module}.`)).forEach((permission) => expanded.add(permission));
    } else {
      expanded.add(key);
    }
  }
  return expanded;
}

/**
 * @param {Iterable<string>|undefined|null} granted
 * @param {string} required
 */
export function hasPermission(granted, required) {
  if (!required) return true;
  const set = granted instanceof Set ? granted : expandPermissions(granted || []);
  return set.has('*') || set.has(required) || set.has(`${required.split('.')[0]}.*`);
}

/** @param {Iterable<string>|undefined|null} granted @param {string[]} required */
export function hasAllPermissions(granted, required = []) {
  return required.every((permission) => hasPermission(granted, permission));
}

/**
 * Resolve the default landing page for an employee. Multiple roles are honoured:
 * the highest-level role wins, with role-specific work queues preferred over the
 * generic dashboard.
 * @param {{ key: string, level?: number }[]} roles
 */
export function resolveHome(roles = []) {
  const keys = roles.map((role) => (typeof role === 'string' ? role : role.key));
  if (keys.includes('administrator')) return '/admin/organization';
  if (keys.includes('plant_head')) return '/dashboard';
  if (keys.includes('operator')) return '/operator';
  if (keys.includes('supervisor')) return '/supervisor';
  if (keys.includes('programmer')) return '/programmer';
  if (keys.includes('hr_analyst')) return '/admin/employees';
  if (keys.includes('finance')) return '/approvals';
  if (keys.includes('hod') || keys.includes('supervisor')) return '/dashboard';
  if (keys.includes('customer_approver')) return '/approvals';
  return '/dashboard';
}

/**
 * Check whether a record is inside an employee's scoped plant/department.
 * Administrators and holders of `employees.read.all` bypass the scope.
 * @param {{ roleKeys?: string[], permissions?: string[], scope?: { plantId?: string|null, departmentId?: string|null } }} context
 * @param {{ plantId?: string|null, departmentId?: string|null }} record
 */
export function isWithinScope(context, record) {
  const permissions = context?.permissions || [];
  const roleKeys = context?.roleKeys || [];
  if (roleKeys.includes('administrator')) return true;
  if (hasPermission(permissions, 'employees.read.all') && !hasPermission(permissions, 'employees.read.self.only')) return true;
  if (!record) return false;
  const scope = context?.scope || {};
  if (scope.plantId && record.plantId && scope.plantId !== record.plantId) return false;
  if (scope.departmentId && record.departmentId && roleKeys.includes('hod') && scope.departmentId !== record.departmentId) return false;
  return true;
}

/**
 * A request can be decided only when the employee is the configured approver or
 * holds the approval permission and the request is in their scope. Segregation of
 * duties: nobody can approve their own request unless an explicit self-approval
 * policy is enabled.
 * @param {{ employeeId?: string|null, permissions?: string[], roleKeys?: string[], scope?: { plantId?: string|null, departmentId?: string|null } }} context
 * @param {{ employeeId?: string|null, plantId?: string|null, departmentId?: string|null, approverId?: string|null, status?: string, selfApprovalAllowed?: boolean }} request
 */
export function canApproveRequest(context, request) {
  if (!context || !request) return false;
  if (!['submitted', 'pending', 'in_review'].includes(request.status)) return false;
  // External customer approvers only ever see and decide evidence explicitly
  // shared with the customer portal, even if an internal request is assigned
  // to them by mistake. Mirrors the SQL RLS policy and decide_approval RPC.
  if (context.roleKeys?.includes('customer_approver') && !request.customerVisible) return false;
  const self = context.employeeId && request.employeeId === context.employeeId;
  if (self && !request.selfApprovalAllowed) return false;
  if (request.approverId && request.approverId === context.employeeId) return true;
  if (!hasPermission(context.permissions, 'requests.approve')) return false;
  if (context.roleKeys?.includes('administrator')) return true;
  if (context.scope?.plantId && request.plantId && context.scope.plantId !== request.plantId) return false;
  if (context.roleKeys?.includes('hod') && context.scope?.departmentId && request.departmentId) {
    return context.scope.departmentId === request.departmentId;
  }
  return true;
}

/** Return a short reason when a route is not permitted, for guard messaging. */
export function deniedReason(routePermission) {
  return routePermission
    ? `Your assigned roles do not include the “${routePermission}” permission.`
    : 'This area is restricted to authorized employees.';
}
