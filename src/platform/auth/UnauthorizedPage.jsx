import React from 'react';
import { useAuth } from './AuthProvider.jsx';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import Icon from '../components/Icon.jsx';
import { Badge, Callout } from '../components/Ui.jsx';
import { deniedReason, resolveHome } from '../data/accessControl.js';
import { queryParam, navigate } from '../lib/router.js';

export default function UnauthorizedPage() {
  const auth = useAuth();
  const next = queryParam('next') || '';
  const roleNames = (auth.context?.roles || []).map((role) => role.name);
  const home = resolveHome(auth.context?.roles || []);
  const requestAccess = auth.context?.employee
    ? `/requests?new=access&details=${encodeURIComponent(`Requesting access to ${next || 'a restricted INDRA area'}.`)}`
    : '/login';

  return (
    <AuthLayout tone="warn" compact>
      <AuthHeading
        icon="ShieldAlert"
        eyebrow="ACCESS DENIED · 403"
        title="This area is outside your scope"
        description="INDRA blocked this page using your assigned permissions and plant/department scope. The same policy is enforced by PostgreSQL Row Level Security."
      />

      <Callout tone="warn" title="Authorization is server-side">
        Hiding navigation is a convenience, not the control. The API request for this page was denied by
        the database policy for your role, not merely by the interface.
      </Callout>

      {next && (
        <div className="pt-denied-path">
          <span>Requested path</span>
          <code className="pt-mono">{next}</code>
        </div>
      )}

      <div className="pt-denied-roles">
        <span>Your assigned roles</span>
        <div>
          {roleNames.length ? roleNames.map((name) => <Badge key={name} tone="neutral">{name}</Badge>) : <Badge tone="red">No roles assigned</Badge>}
        </div>
      </div>

      <p className="pt-auth-small">{deniedReason('')} If you need this access for your work, raise an access request with your reporting manager or plant head.</p>

      <div className="pt-denied-actions">
        <button type="button" className="pt-btn pt-btn-primary pt-btn-lg" onClick={() => navigate(home)}>
          <Icon name="LayoutDashboard" size={15} /> Go to my dashboard
        </button>
        <button type="button" className="pt-btn pt-btn-secondary pt-btn-lg" onClick={() => navigate(requestAccess)}>
          <Icon name="Send" size={15} /> Request access
        </button>
      </div>

      <div className="pt-auth-links pt-auth-links-center">
        <button type="button" className="pt-text-link" onClick={() => auth.signOut()}>
          <Icon name="LogOut" size={13} /> Sign out
        </button>
      </div>
    </AuthLayout>
  );
}
