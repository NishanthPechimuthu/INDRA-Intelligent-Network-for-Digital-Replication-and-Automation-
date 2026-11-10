import { hasAllPermissions, hasPermission } from './accessControl.js';

/**
 * Navigation is data-driven. Each item declares the permission required by the
 * protected route; the same check is repeated by the router and by PostgreSQL.
 */
export const NAV_SECTIONS = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', permission: 'organization.read' },
      { to: '/tasks', label: 'My tasks', icon: 'ListChecks', permission: 'tasks.read.self' },
      { to: '/requests', label: 'My requests', icon: 'FileText', permission: 'requests.read.self' },
      { to: '/approvals', label: 'My approvals', icon: 'BadgeCheck', permission: 'requests.approve', badge: 'approvals' },
      { to: '/schedule', label: 'My schedule', icon: 'CalendarClock', permission: 'shifts.read' },
      { to: '/attendance', label: 'Attendance', icon: 'Fingerprint', permission: 'attendance.read.self' },
      { to: '/notifications', label: 'Notifications', icon: 'Bell', permission: 'notifications.read', badge: 'notifications' },
    ],
  },
  {
    id: 'people',
    label: 'People & access',
    items: [
      { to: '/admin/organization', label: 'Organization', icon: 'Network', permission: 'departments.read' },
      { to: '/admin/employees', label: 'Employees', icon: 'Users', permission: 'employees.read' },
      { to: '/admin/roles', label: 'Roles & permissions', icon: 'ShieldCheck', permission: 'roles.read' },
      { to: '/admin/shifts', label: 'Shift management', icon: 'CalendarDays', permission: 'shifts.read' },
    ],
  },
  {
    id: 'personal',
    label: 'Personal',
    items: [
      { to: '/profile', label: 'My profile', icon: 'UserRound', permission: 'employees.read' },
      { to: '/activity', label: 'Activity history', icon: 'History', permission: 'audit.read' },
      { to: '/help', label: 'Help & support', icon: 'LifeBuoy', permission: null },
    ],
  },
];

/**
 * @param {{ permissions?: string[]|Set<string> }} context
 */
export function visibleSections(context) {
  const permissions = context?.permissions || [];
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasAllPermissions(permissions, item.permission ? [item.permission] : [])),
  })).filter((section) => section.items.length > 0);
}

/**
 * @param {string} path
 * @param {string[]|Set<string>} permissions
 */
export function canVisit(path, permissions) {
  if (!path) return false;
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((candidate) => path === candidate.to || path.startsWith(`${candidate.to}/`));
    if (item) return !item.permission || hasPermission(permissions, item.permission);
  }
  // Routes not present in the navigation still require a signed-in employee.
  return true;
}

export function findNavItem(path) {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((candidate) => path === candidate.to || path.startsWith(`${candidate.to}/`));
    if (item) return { ...item, section: section.label };
  }
  return null;
}

export function breadcrumbFor(path) {
  const item = findNavItem(path);
  if (!item) return ['INDRA', 'Platform'];
  return [item.section, item.label];
}
