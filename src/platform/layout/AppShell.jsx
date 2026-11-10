import React, { useEffect, useMemo, useRef, useState } from 'react';
import logoUrl from '../../../assets/logos/logo-64.png';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { approvalsFor } from '../data/selectors.js';
import { breadcrumbFor, visibleSections } from '../data/navigation.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { Avatar, Badge } from '../components/Ui.jsx';

function NavLink({ item, active, count, onNavigate }) {
  return (
    <a
      href={item.to}
      className={`pt-nav-link ${active ? 'on' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(item.to);
      }}
    >
      <span className="pt-nav-icon"><Icon name={item.icon} size={17} /></span>
      <span className="pt-nav-label">{item.label}</span>
      {count > 0 && <span className="pt-nav-count">{count > 99 ? '99+' : count}</span>}
    </a>
  );
}

function GlobalSearch({ open, onClose }) {
  const { data, loading } = useWorkspace();
  const { context } = useAuth();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const sections = useMemo(() => visibleSections(context), [context]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const employees = useMemo(() => {
    if (!data?.employees || !query.trim()) return [];
    const needle = query.toLowerCase();
    return data.employees
      .filter((employee) => `${employee.fullName} ${employee.employeeCode} ${employee.email} ${employee.department} ${employee.designation}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [data, query]);

  const pages = useMemo(() => {
    const needle = query.toLowerCase();
    return sections.flatMap((section) => section.items).filter((item) => item.label.toLowerCase().includes(needle)).slice(0, 6);
  }, [sections, query]);

  if (!open) return null;

  return (
    <div className="pt-search-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="pt-search-modal" role="dialog" aria-label="Search INDRA">
        <div className="pt-search-input">
          <Icon name="Search" size={18} />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people, pages, employee IDs…" aria-label="Search" />
          <kbd>ESC</kbd>
        </div>
        <div className="pt-search-results">
          {!query && <p className="pt-search-hint">Search the employee directory, navigation and operational records. Results respect your plant and department scope.</p>}
          {pages.length > 0 && (
            <div className="pt-search-group">
              <span>Navigate</span>
              {pages.map((item) => (
                <button key={item.to} type="button" onClick={() => { navigate(item.to); onClose(); }}>
                  <Icon name={item.icon} size={16} />
                  <span>{item.label}</span>
                  <small>{item.to}</small>
                </button>
              ))}
            </div>
          )}
          {employees.length > 0 && (
            <div className="pt-search-group">
              <span>Employees</span>
              {employees.map((employee) => (
                <button key={employee.id} type="button" onClick={() => { navigate(`/admin/employees?employee=${employee.id}`); onClose(); }}>
                  <Avatar name={employee.fullName} size="xs" />
                  <span>{employee.fullName}<small>{employee.designation} · {employee.department}</small></span>
                  <small className="pt-mono">{employee.employeeCode}</small>
                </button>
              ))}
            </div>
          )}
          {query && !pages.length && !employees.length && (
            <p className="pt-search-hint">No accessible records match “{query}”. Records outside your scope never appear here.</p>
          )}
          {loading && <p className="pt-search-hint">Loading directory…</p>}
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ path, children }) {
  const auth = useAuth();
  const workspace = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const context = auth.context;
  const sections = useMemo(() => visibleSections(context), [context]);
  const unread = useMemo(
    () => (workspace.data?.notifications || []).filter((item) => item.recipientEmployeeId === context?.employeeId && !item.readAt).length,
    [workspace.data, context],
  );
  const pendingApprovals = useMemo(() => {
    if (!workspace.data || !context) return 0;
    try {
      return approvalsFor(workspace.data, context).length;
    } catch {
      return 0;
    }
  }, [workspace.data, context]);
  const breadcrumb = breadcrumbFor(path);
  const today = new Date();

  useEffect(() => {
    setMobileOpen(false);
    setUserMenu(false);
  }, [path]);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setUserMenu(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = (to) => {
    navigate(to);
    setMobileOpen(false);
  };

  return (
    <div className="pt-shell">
      {mobileOpen && <div className="pt-sidebar-scrim" onClick={() => setMobileOpen(false)} />}
      <aside className={`pt-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="pt-sidebar-brand">
          <a href="/dashboard" className="pt-brand" onClick={(event) => { event.preventDefault(); go('/dashboard'); }}>
            <img src={logoUrl} alt="" />
            <span>
              <b>INDRA</b>
              <small>OPERATIONS PLATFORM</small>
            </span>
          </a>
          <button type="button" className="pt-sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="pt-org-switcher">
          <span className="pt-org-mark">{context?.organization?.name?.split(' ').slice(0, 2).map((word) => word[0]).join('') || 'IN'}</span>
          <span>
            <strong>{context?.organization?.name || 'INDRA Industrial'}</strong>
            <small>{context?.employee?.plant || 'Organization'} · {context?.employee?.plantCode || 'ALL'}</small>
          </span>
          <Icon name="ChevronDown" size={14} />
        </div>

        <nav className="pt-nav" aria-label="Platform navigation">
          {sections.map((section) => (
            <div className="pt-nav-section" key={section.id}>
              <p>{section.label}</p>
              {section.items.map((item) => {
                const active = path === item.to || path.startsWith(`${item.to}/`);
                const count = item.badge === 'notifications' ? unread : item.badge === 'approvals' ? pendingApprovals : 0;
                return <NavLink key={item.to} item={item} active={active} count={count} onNavigate={go} />;
              })}
            </div>
          ))}
        </nav>

        <div className="pt-sidebar-bottom">
          <a href="/" className="pt-studio-link">
            <span><Icon name="Box" size={17} /></span>
            <div>
              <strong>3D Twin Studio</strong>
              <small>Factory design & simulation</small>
            </div>
            <Icon name="ArrowUpRight" size={14} />
          </a>
          <div className="pt-user-card">
            <Avatar name={context?.profile?.fullName || 'INDRA user'} src={context?.profile?.photoUrl} size="sm" status="active" />
            <span>
              <strong>{context?.profile?.fullName || 'INDRA user'}</strong>
              <small>{context?.roles?.map((role) => role.name).join(' · ') || 'No role'}</small>
            </span>
            <button type="button" onClick={() => auth.signOut()} aria-label="Sign out" title="Sign out">
              <Icon name="LogOut" size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="pt-main-wrap">
        <header className="pt-topbar">
          <div className="pt-topbar-left">
            <button type="button" className="pt-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Icon name="Menu" size={19} />
            </button>
            <div className="pt-topbar-title">
              <div className="pt-crumb">{breadcrumb.map((item, index) => <span key={item}>{index > 0 && <Icon name="ChevronRight" size={11} />}{item}</span>)}</div>
              <h1>{breadcrumb[1] || 'Workspace'}</h1>
            </div>
          </div>

          <div className="pt-topbar-right">
            <button type="button" className="pt-search-trigger" onClick={() => setSearchOpen(true)}>
              <Icon name="Search" size={15} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <div className="pt-topbar-date">
              <span>{today.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
              <small>{context?.employee?.plantCode || 'ORG'}</small>
            </div>
            <a href="/notifications" className="pt-topbar-icon" onClick={(event) => { event.preventDefault(); go('/notifications'); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
              <Icon name="Bell" size={18} />
              {unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
            </a>
            <div className="pt-user-menu">
              <button type="button" className="pt-user-trigger" onClick={() => setUserMenu((current) => !current)} aria-expanded={userMenu}>
                <Avatar name={context?.profile?.fullName || 'INDRA user'} src={context?.profile?.photoUrl} size="sm" />
                <span>
                  <strong>{context?.profile?.fullName?.split(' ')[0] || 'INDRA'}</strong>
                  <small>{context?.roles?.[0]?.name || 'Employee'}</small>
                </span>
                <Icon name="ChevronDown" size={13} />
              </button>
              {userMenu && (
                <div className="pt-user-dropdown">
                  <div className="pt-user-dropdown-head">
                    <strong>{context?.profile?.fullName}</strong>
                    <small>{context?.profile?.email}</small>
                    <div>{context?.roles?.map((role) => <Badge key={role.key} tone="lime">{role.name}</Badge>)}</div>
                  </div>
                  <button type="button" onClick={() => go('/profile')}><Icon name="UserRound" size={15} /> My profile <span>⌘P</span></button>
                  <button type="button" onClick={() => go('/profile?tab=security')}><Icon name="ShieldCheck" size={15} /> Security & sessions</button>
                  <button type="button" onClick={() => go('/schedule')}><Icon name="CalendarClock" size={15} /> My schedule</button>
                  <button type="button" onClick={() => go('/help')}><Icon name="LifeBuoy" size={15} /> Help & support</button>
                  <div className="pt-user-dropdown-foot">
                    <a href="/"><Icon name="Box" size={14} /> Open 3D studio</a>
                    <button type="button" onClick={() => auth.signOut()}><Icon name="LogOut" size={14} /> Sign out</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {workspace.errors?.length > 0 && (
          <div className="pt-workspace-warning">
            <Icon name="AlertTriangle" size={14} />
            Some scoped records could not be loaded: {workspace.errors.slice(0, 2).join(' · ')}
          </div>
        )}
        {workspace.loading && <div className="pt-loading-bar" />}

        <main className="pt-content">{children}</main>

        <footer className="pt-footer">
          <span>© 2026 INDRA Industrial Systems · Module 01 Platform Foundation</span>
          <span className="pt-footer-meta">
            <span><i className="pt-live-dot" /> {auth.isDemo ? 'Demo identity provider' : 'Supabase connected'}</span>
            <span>Data scoped by RLS</span>
            <a href="/">3D Twin Studio</a>
          </span>
        </footer>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
