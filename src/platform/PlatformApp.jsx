import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx';
import { WorkspaceProvider } from './data/WorkspaceProvider.jsx';
import { ToastProvider } from './components/ToastProvider.jsx';
import AppShell from './layout/AppShell.jsx';
import AuthLayout, { AuthHeading } from './auth/AuthLayout.jsx';
import Icon from './components/Icon.jsx';
import { Button, Callout } from './components/Ui.jsx';
import { hasPermission, resolveHome } from './data/accessControl.js';
import {
  ROUTE_TITLES,
  currentPath,
  isProtectedRoute,
  isPublicRoute,
  normalizePath,
  navigate,
} from './lib/router.js';
import LoginPage from './auth/LoginPage.jsx';
import ForgotPasswordPage from './auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './auth/ResetPasswordPage.jsx';
import MfaPage from './auth/MfaPage.jsx';
import ActivatePage from './auth/ActivatePage.jsx';
import UnauthorizedPage from './auth/UnauthorizedPage.jsx';
import SuspendedPage from './auth/SuspendedPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SchedulePage from './pages/SchedulePage.jsx';
import AttendancePage from './pages/AttendancePage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import TasksPage from './pages/TasksPage.jsx';
import RequestsPage from './pages/RequestsPage.jsx';
import ApprovalsPage from './pages/ApprovalsPage.jsx';
import ActivityPage from './pages/ActivityPage.jsx';
import HelpPage from './pages/HelpPage.jsx';
import OrganizationPage from './pages/OrganizationPage.jsx';
import EmployeesPage from './pages/EmployeesPage.jsx';
import RolesPage from './pages/RolesPage.jsx';
import ShiftsPage from './pages/ShiftsPage.jsx';

const PUBLIC_PAGES = {
  '/login': LoginPage,
  '/forgot-password': ForgotPasswordPage,
  '/reset-password': ResetPasswordPage,
  '/mfa': MfaPage,
  '/activate': ActivatePage,
  '/unauthorized': UnauthorizedPage,
  '/suspended': SuspendedPage,
};

const PROTECTED_PAGES = {
  '/dashboard': DashboardPage,
  '/profile': ProfilePage,
  '/schedule': SchedulePage,
  '/attendance': AttendancePage,
  '/notifications': NotificationsPage,
  '/tasks': TasksPage,
  '/requests': RequestsPage,
  '/approvals': ApprovalsPage,
  '/activity': ActivityPage,
  '/help': HelpPage,
  '/admin/organization': OrganizationPage,
  '/admin/employees': EmployeesPage,
  '/admin/roles': RolesPage,
  '/admin/shifts': ShiftsPage,
};

/**
 * Route permissions are intentionally duplicated from the navigation model.
 * Navigation is a convenience; this guard prevents rendering, and PostgreSQL
 * RLS/RPCs remain the authoritative check for every record.
 */
export const ROUTE_PERMISSIONS = {
  '/dashboard': 'organization.read',
  '/profile': 'employees.read',
  '/schedule': 'shifts.read',
  '/attendance': 'attendance.read.self',
  '/notifications': 'notifications.read',
  '/tasks': 'tasks.read.self',
  '/requests': 'requests.read.self',
  '/approvals': 'requests.approve',
  '/activity': 'audit.read',
  '/help': null,
  '/admin/organization': 'departments.read',
  '/admin/employees': 'employees.read',
  '/admin/roles': 'roles.read',
  '/admin/shifts': 'shifts.read',
};

function usePathname() {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const update = () => setPath(currentPath());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return path;
}

function Splash({ label = 'Starting INDRA platform…' }) {
  return (
    <div className="pt-boot">
      <span className="pt-spinner" />
      <strong>{label}</strong>
      <small>Resolving identity, role scope and organization structure.</small>
    </div>
  );
}

function Redirect({ to, replace = true }) {
  useEffect(() => {
    navigate(to, { replace });
  }, [to, replace]);
  return <Splash label="Redirecting…" />;
}

function NoProfile() {
  const auth = useAuth();
  return (
    <AuthLayout tone="warn" compact>
      <AuthHeading
        icon="UserRound"
        eyebrow="PROFILE NOT LINKED"
        title="Your account has no employee profile"
        description="The signed-in identity exists in Supabase Auth, but no active employee record is linked to it. Platform data is withheld until an administrator completes the link."
      />
      <Callout tone="warn" title="What to do">
        Ask HR or your platform administrator to link your auth user to an employee record and assign at
        least one role. You can then sign in again with the same email address.
      </Callout>
      <div className="pt-denied-actions">
        <Button icon="LogOut" onClick={() => auth.signOut()}>Sign out</Button>
        <a className="pt-btn pt-btn-secondary" href="/">Return to 3D studio</a>
      </div>
    </AuthLayout>
  );
}

function NotFound({ path, signedIn }) {
  if (!signedIn) return <Redirect to={`/login?next=${encodeURIComponent(path)}`} />;
  return (
    <AppShell path={path}>
      <div className="pt-page">
        <div className="pt-card pt-card-padded pt-not-found">
          <span className="pt-empty-icon"><Icon name="CircleHelp" size={24} /></span>
          <h1>Page not found</h1>
          <p className="pt-muted">
            No platform route matches <code className="pt-mono">{path}</code>. The 3D studio and every
            Module 1 screen remain available from the navigation.
          </p>
          <div className="pt-link-row">
            <Button icon="LayoutDashboard" onClick={() => navigate('/dashboard')}>Go to dashboard</Button>
            <Button variant="secondary" icon="Box" onClick={() => { window.location.href = '/'; }}>Open 3D studio</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function PlatformRoutes() {
  const auth = useAuth();
  const path = usePathname();

  useEffect(() => {
    document.body.classList.add('platform-body');
    return () => document.body.classList.remove('platform-body');
  }, []);

  useEffect(() => {
    document.title = `${ROUTE_TITLES[path] || (path.startsWith('/admin/') ? 'Administration' : 'Platform')} · INDRA`;
  }, [path]);

  if (auth.loading) return <Splash />;

  if (path === '/suspended' || auth.suspended) {
    if (path !== '/suspended') return <Redirect to="/suspended" />;
    return <SuspendedPage />;
  }

  if (path === '/unauthorized') return <UnauthorizedPage />;

  if (isPublicRoute(path)) {
    const Page = PUBLIC_PAGES[path];
    if (!Page) return <Redirect to="/login" />;
    if (auth.isAuthenticated && path !== '/mfa' && path !== '/activate') {
      return <Redirect to={resolveHome(auth.context?.roles || [])} />;
    }
    if (path === '/mfa' && auth.isAuthenticated && !auth.requiresMfa) {
      return <Redirect to={resolveHome(auth.context?.roles || [])} />;
    }
    return <Page />;
  }

  if (isProtectedRoute(path)) {
    if (!auth.session) return <Redirect to={`/login?next=${encodeURIComponent(path)}`} />;
    if (auth.requiresMfa) return <Redirect to="/mfa" />;
    if (!auth.context) return <NoProfile />;
    const required = ROUTE_PERMISSIONS[path];
    if (required && !hasPermission(auth.context.permissions, required)) {
      return <Redirect to={`/unauthorized?next=${encodeURIComponent(path)}`} />;
    }
    const Page = PROTECTED_PAGES[path];
    if (!Page) return <NotFound path={path} signedIn />;
    return (
      <AppShell path={path}>
        <Page />
      </AppShell>
    );
  }

  return <NotFound path={normalizePath(path)} signedIn={Boolean(auth.session)} />;
}

export default function PlatformApp() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <ToastProvider>
          <PlatformRoutes />
        </ToastProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
