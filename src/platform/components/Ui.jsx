import React from 'react';
import Icon from './Icon.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';

export function PageHeader({ eyebrow, title, description, actions, breadcrumb }) {
  return (
    <header className="pt-page-header">
      <div>
        {breadcrumb && (
          <nav className="pt-breadcrumb" aria-label="Breadcrumb">
            {breadcrumb.map((item, index) => (
              <React.Fragment key={`${item}-${index}`}>
                {index > 0 && <Icon name="ChevronRight" size={12} />}
                <span>{item}</span>
              </React.Fragment>
            ))}
          </nav>
        )}
        {eyebrow && <p className="pt-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="pt-page-description">{description}</p>}
      </div>
      {actions && <div className="pt-page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, subtitle, action, children, className = '', padded = true, as: Tag = 'section' }) {
  return (
    <Tag className={`pt-card ${padded ? 'pt-card-padded' : ''} ${className}`}>
      {(title || action) && (
        <div className="pt-card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action && <div className="pt-card-action">{action}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function StatCard({ label, value, unit, icon, tone = 'default', footnote, trend }) {
  return (
    <div className={`pt-stat pt-stat-${tone}`}>
      <div className="pt-stat-top">
        <span>{label}</span>
        {icon && (
          <span className="pt-stat-icon">
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <div className="pt-stat-value">
        <strong>{value}</strong>
        {unit && <em>{unit}</em>}
      </div>
      <div className="pt-stat-foot">
        {trend && <span className={`pt-trend pt-trend-${trend.tone || 'up'}`}>{trend.label}</span>}
        {footnote && <span>{footnote}</span>}
      </div>
    </div>
  );
}

const BADGE_TONES = {
  neutral: 'neutral',
  lime: 'lime',
  green: 'green',
  amber: 'amber',
  red: 'red',
  blue: 'blue',
  violet: 'violet',
};

export function Badge({ children, tone = 'neutral', dot = false, className = '' }) {
  return (
    <span className={`pt-badge pt-badge-${BADGE_TONES[tone] || 'neutral'} ${className}`}>
      {dot && <i />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    active: ['green', 'Active'],
    invited: ['amber', 'Invited'],
    suspended: ['red', 'Suspended'],
    terminated: ['red', 'Terminated'],
    on_leave: ['blue', 'On leave'],
    present: ['green', 'Present'],
    late: ['amber', 'Late'],
    absent: ['red', 'Absent'],
    early_out: ['amber', 'Early out'],
    holiday: ['violet', 'Holiday'],
    scheduled: ['lime', 'Scheduled'],
    off: ['neutral', 'Off'],
    approved: ['green', 'Approved'],
    rejected: ['red', 'Rejected'],
    submitted: ['amber', 'Submitted'],
    pending: ['amber', 'Pending'],
    waiting: ['neutral', 'Waiting'],
    draft: ['neutral', 'Draft'],
    cancelled: ['neutral', 'Cancelled'],
    accepted: ['green', 'Accepted'],
    revoked: ['red', 'Revoked'],
    expired: ['red', 'Expired'],
    todo: ['neutral', 'To do'],
    in_progress: ['blue', 'In progress'],
    done: ['green', 'Done'],
    blocked: ['red', 'Blocked'],
    verified: ['green', 'Verified'],
    running: ['green', 'Running'],
    idle: ['neutral', 'Idle'],
    at_risk: ['amber', 'At risk'],
    pending_activation: ['amber', 'Pending activation'],
  };
  const [tone, label] = map[status] || ['neutral', String(status || '—').replaceAll('_', ' ')];
  return <Badge tone={tone} dot>{label}</Badge>;
}

export function Avatar({ name = '', src, size = 'md', status, className = '' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span className={`pt-avatar pt-avatar-${size} ${className}`}>
      {src ? <img src={src} alt={name} /> : <span>{initials || 'IN'}</span>}
      {status && <i className={`pt-avatar-status pt-avatar-status-${status}`} />}
    </span>
  );
}

export function EmptyState({ icon = 'Inbox', title, description, action }) {
  return (
    <div className="pt-empty">
      <span className="pt-empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Progress({ value = 0, tone = 'lime', label }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="pt-progress-wrap">
      {label && (
        <div className="pt-progress-label">
          <span>{label}</span>
          <strong>{safe}%</strong>
        </div>
      )}
      <div className="pt-progress" role="progressbar" aria-valuenow={safe} aria-valuemin={0} aria-valuemax={100}>
        <span className={`pt-progress-fill pt-progress-${tone}`} style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

export function DataTable({ columns, rows, empty, rowKey = 'id', onRowClick, className = '', dense = false }) {
  if (!rows?.length) {
    return <div className="pt-table-empty">{empty || <EmptyState title="Nothing to show" description="Records will appear here when available." />}</div>;
  }
  return (
    <div className={`pt-table-wrap ${className}`}>
      <table className={`pt-table ${dense ? 'pt-table-dense' : ''}`}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} style={column.width ? { width: column.width } : undefined} className={column.align ? `pt-align-${column.align}` : ''}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={typeof rowKey === 'function' ? rowKey(row) : row[rowKey] ?? index}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'pt-row-clickable' : ''}
            >
              {columns.map((column) => (
                <td key={column.key} className={column.align ? `pt-align-${column.align}` : ''}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InfoRow({ label, value, mono = false, icon }) {
  return (
    <div className="pt-info-row">
      <dt>
        {icon && <Icon name={icon} size={14} />}
        {label}
      </dt>
      <dd className={mono ? 'pt-mono' : ''}>{value ?? '—'}</dd>
    </div>
  );
}

export function DefinitionGrid({ children, columns = 2 }) {
  return <dl className={`pt-definition-grid pt-definition-${columns}`}>{children}</dl>;
}

export function Button({ children, variant = 'primary', size = 'md', icon, iconAfter, className = '', ...rest }) {
  return (
    <button type="button" className={`pt-btn pt-btn-${variant} pt-btn-${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 15} />}
      {children}
      {iconAfter && <Icon name={iconAfter} size={size === 'sm' ? 13 : 15} />}
    </button>
  );
}

export function IconButton({ icon, label, className = '', ...rest }) {
  return (
    <button type="button" className={`pt-icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={16} />
    </button>
  );
}

export function Field({ label, hint, error, required, children, htmlFor, className = '' }) {
  return (
    <label className={`pt-field ${className}`} htmlFor={htmlFor}>
      <span className="pt-field-label">
        {label} {required && <em>*</em>}
      </span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <small className="pt-field-error">{error}</small>}
    </label>
  );
}

export function TextInput({ className = '', ...rest }) {
  return <input className={`pt-input ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }) {
  return (
    <span className="pt-select-wrap">
      <select className={`pt-select ${className}`} {...rest}>
        {children}
      </select>
      <Icon name="ChevronDown" size={15} />
    </span>
  );
}

export function Textarea({ className = '', ...rest }) {
  return <textarea className={`pt-textarea ${className}`} {...rest} />;
}

export function Checkbox({ label, description, ...rest }) {
  return (
    <label className="pt-checkbox">
      <input type="checkbox" {...rest} />
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}

export function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`pt-tabs ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={active === tab.id ? 'on' : ''}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <Icon name={tab.icon} size={14} />}
          {tab.label}
          {tab.count != null && <span className="pt-tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="pt-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" className={value === option.value ? 'on' : ''} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  if (!open) return null;
  return (
    <div className="pt-modal-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div className={`pt-modal pt-modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <IconButton icon="X" label="Close" onClick={onClose} />
        </header>
        <div className="pt-modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export function LoadingBlock({ rows = 3, label = 'Loading records' }) {
  return (
    <div className="pt-loading-block" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <span key={index} style={{ animationDelay: `${index * 90}ms` }} />
      ))}
    </div>
  );
}

export function Callout({ tone = 'info', title, children, icon }) {
  return (
    <div className={`pt-callout pt-callout-${tone}`}>
      <Icon name={icon || (tone === 'warn' ? 'AlertTriangle' : tone === 'danger' ? 'ShieldAlert' : 'CircleHelp')} size={18} />
      <div>
        {title && <strong>{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function PermissionGate({ permission, children, fallback = null }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return fallback;
  return children;
}

export function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...options }).format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function relativeTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (Math.abs(minutes) < 1) return 'just now';
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return `${days}d ago`;
  return formatDate(value);
}

export function currency(value, currencyCode = 'INR') {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(Number(value));
}
