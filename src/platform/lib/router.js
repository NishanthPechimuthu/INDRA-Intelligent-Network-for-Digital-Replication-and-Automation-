/**
 * A deliberately small history router. The existing 3D studio owns `/`; every
 * platform screen lives below a named path. No extra routing dependency is
 * needed and the nginx/Vite SPA fallback already serves these paths.
 */

export const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/mfa',
  '/activate',
  '/unauthorized',
  '/suspended',
];

export const PROTECTED_ROUTES = [
  '/dashboard',
  '/profile',
  '/schedule',
  '/attendance',
  '/notifications',
  '/tasks',
  '/requests',
  '/approvals',
  '/activity',
  '/help',
  '/admin/organization',
  '/admin/employees',
  '/admin/roles',
  '/admin/shifts',
  '/operator',
  '/supervisor',
  '/programmer',
  '/workforce/employees',
  '/workforce/schedule',
  '/workforce/attendance',
  '/production/tasks',
  '/production/orders',
  '/production/reports',
  '/operations/issues',
  '/operations/reassignment',
  '/operations/handover',
  '/work-history',
];

export const ROUTE_TITLES = {
  '/login': 'Sign in',
  '/forgot-password': 'Forgot password',
  '/reset-password': 'Reset password',
  '/mfa': 'Verify your identity',
  '/activate': 'Activate account',
  '/unauthorized': 'Unauthorized',
  '/suspended': 'Account suspended',
  '/dashboard': 'Dashboard',
  '/profile': 'My profile',
  '/schedule': 'My schedule',
  '/attendance': 'Attendance',
  '/notifications': 'Notifications',
  '/tasks': 'My tasks',
  '/requests': 'My requests',
  '/approvals': 'My approvals',
  '/activity': 'Activity history',
  '/help': 'Help & support',
  '/admin/organization': 'Organization',
  '/admin/employees': 'Employees',
  '/admin/roles': 'Roles & permissions',
  '/admin/shifts': 'Shift management',
  '/operator': 'Operator dashboard',
  '/supervisor': 'Supervisor dashboard',
  '/programmer': 'Programmer dashboard',
  '/workforce/employees': 'Employee directory',
  '/workforce/schedule': 'Shift schedule',
  '/workforce/attendance': 'Attendance register',
  '/production/tasks': 'Task board',
  '/production/orders': 'Production orders',
  '/production/reports': 'Production reporting',
  '/operations/issues': 'Issue reporting',
  '/operations/reassignment': 'Reassignment requests',
  '/operations/handover': 'Shift handover',
  '/work-history': 'Work history',
};

/** The studio is public and owns the root path so existing deep links keep working. */
export const STUDIO_PATHS = ['/', '/studio', '/index.html'];

export function normalizePath(pathname) {
  const raw = pathname || '/';
  const clean = raw.split('?')[0].split('#')[0];
  if (clean.length > 1) return clean.replace(/\/+$/, '');
  return clean;
}

export function isStudioPath(pathname) {
  return STUDIO_PATHS.includes(normalizePath(pathname));
}

export function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.includes(normalizePath(pathname));
}

export function isProtectedRoute(pathname) {
  const path = normalizePath(pathname);
  return PROTECTED_ROUTES.includes(path) || PROTECTED_ROUTES.some((route) => path.startsWith(`${route}/`));
}

export function isPlatformPath(pathname) {
  const path = normalizePath(pathname);
  return isPublicRoute(path) || isProtectedRoute(path) || path.startsWith('/admin/');
}

export function navigate(to, { replace = false, state = null } = {}) {
  if (typeof window === 'undefined') return;
  const target = normalizePath(to);
  if (normalizePath(window.location.pathname) === target && !state) return;
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method](state, '', target);
  window.dispatchEvent(new PopStateEvent('popstate', { state }));
  window.scrollTo?.({ top: 0, behavior: 'instant' });
}

export function replaceQuery(params) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  });
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export function queryParam(name) {
  if (typeof window === 'undefined') return null;
  return new URL(window.location.href).searchParams.get(name);
}

export function currentPath() {
  return typeof window === 'undefined' ? '/' : normalizePath(window.location.pathname);
}
