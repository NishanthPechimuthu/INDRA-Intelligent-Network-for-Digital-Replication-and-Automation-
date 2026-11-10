import React, { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useWorkspace } from '../data/WorkspaceProvider.jsx';
import { notificationsFor } from '../data/selectors.js';
import { markAllNotificationsRead, markNotificationRead } from '../data/actions.js';
import { navigate } from '../lib/router.js';
import Icon from '../components/Icon.jsx';
import { Badge, Button, Card, EmptyState, Segmented, formatDateTime, relativeTime } from '../components/Ui.jsx';
import { PageHeader } from '../components/Ui.jsx';
import { useToast } from '../components/ToastProvider.jsx';

const CATEGORY_ICON = {
  approval: 'BadgeCheck',
  schedule: 'CalendarClock',
  attendance: 'Fingerprint',
  people: 'Users',
  compliance: 'ShieldCheck',
  payroll: 'FileText',
  announcement: 'Bell',
};

export default function NotificationsPage() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const { notify } = useToast();
  const context = auth.context;
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const notifications = useMemo(
    () => (workspace.data && context ? notificationsFor(workspace.data, context) : []),
    [workspace.data, context],
  );

  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const visible = notifications.filter((item) => {
    if (filter === 'unread') return !item.readAt;
    if (filter === 'approvals') return item.category === 'approval';
    if (filter === 'schedule') return item.category === 'schedule' || item.category === 'attendance';
    return true;
  });

  async function handleOpen(notification) {
    if (!notification.readAt) {
      const result = await markNotificationRead(notification.id);
      if (result.error) notify(result.error.message, 'error');
      else await workspace.refresh();
    }
    if (notification.link) navigate(notification.link);
  }

  async function handleMarkAll() {
    setBusy(true);
    const result = await markAllNotificationsRead(context.employeeId);
    setBusy(false);
    if (result.error) notify(result.error.message, 'error');
    else {
      notify('All notifications marked as read.');
      await workspace.refresh();
    }
  }

  return (
    <div className="pt-page">
      <PageHeader
        breadcrumb={['Workspace', 'Notifications']}
        eyebrow="INBOX"
        title="Notifications"
        description={`${unreadCount} unread · ${notifications.length} total updates for your account.`}
        actions={<Button variant="secondary" icon="Check" onClick={handleMarkAll} disabled={!unreadCount || busy}>Mark all read</Button>}
      />

      <div className="pt-notifications-layout">
        <Card
          padded={false}
          title="Your updates"
          subtitle="Approvals, schedule changes, compliance and people operations"
          action={<Segmented label="Filter notifications" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: `Unread ${unreadCount}` }, { value: 'approvals', label: 'Approvals' }, { value: 'schedule', label: 'Schedule' }]} />}
        >
          <div className="pt-notification-list">
            {visible.length ? visible.map((notification) => (
              <button key={notification.id} type="button" className={`pt-notification-item ${!notification.readAt ? 'unread' : ''}`} onClick={() => handleOpen(notification)}>
                <span className={`pt-notif-icon pt-notif-${notification.category}`}><Icon name={CATEGORY_ICON[notification.category] || 'Bell'} size={16} /></span>
                <span className="pt-notification-copy">
                  <span className="pt-notification-title">
                    <strong>{notification.title}</strong>
                    {!notification.readAt && <i className="pt-unread-dot" />}
                  </span>
                  <p>{notification.body}</p>
                  <small>{notification.category.replaceAll('_', ' ')} · {relativeTime(notification.createdAt)} · {formatDateTime(notification.createdAt)}</small>
                </span>
                <span className="pt-notification-action">
                  {notification.link && <Icon name="ArrowUpRight" size={15} />}
                  {!notification.readAt && <Badge tone="lime">New</Badge>}
                </span>
              </button>
            )) : (
              <EmptyState icon="Inbox" title="Inbox zero" description={filter === 'unread' ? 'You have read every notification.' : 'No notifications match this filter.'} />
            )}
          </div>
        </Card>

        <div className="pt-notification-side">
          <Card title="Delivery" subtitle="Where INDRA reaches you">
            <div className="pt-channel-list">
              <div><Icon name="Bell" size={16} /><span><strong>In-app</strong><small>Enabled · real-time</small></span><Badge tone="green">On</Badge></div>
              <div><Icon name="Mail" size={16} /><span><strong>Email</strong><small>{context.profile.email}</small></span><Badge tone="green">On</Badge></div>
              <div><Icon name="Smartphone" size={16} /><span><strong>Push</strong><small>Mobile app planned</small></span><Badge tone="neutral">Off</Badge></div>
            </div>
            <p className="pt-muted pt-small">Notification delivery preferences are held per employee. Organization-wide announcements require <code className="pt-mono">notifications.manage</code>.</p>
          </Card>
          <Card title="Quiet hours" subtitle="Respectful defaults">
            <div className="pt-quiet-hours">
              <span><Icon name="Moon" size={16} /> 22:00 – 06:00</span>
              <small>Only critical approvals and safety alerts break quiet hours.</small>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
