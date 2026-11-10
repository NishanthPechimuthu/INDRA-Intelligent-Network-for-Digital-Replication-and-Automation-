import React from 'react';
import { useAuth } from './AuthProvider.jsx';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import Icon from '../components/Icon.jsx';
import { Callout } from '../components/Ui.jsx';

export default function SuspendedPage() {
  const auth = useAuth();
  const email = auth.session?.email || auth.session?.user?.email || 'your organization account';
  return (
    <AuthLayout tone="danger" compact>
      <AuthHeading
        icon="Ban"
        eyebrow="ACCOUNT SUSPENDED · 423"
        title="Access is temporarily unavailable"
        description="Your employee record is suspended or has ended. INDRA has closed the workspace session and will not issue application data until an administrator restores access."
      />

      <Callout tone="danger" title="What happens now">
        Your account <strong>{email}</strong> cannot sign in to the platform. Existing audit records are
        retained. No employee data is shown while the account is suspended.
      </Callout>

      <div className="pt-suspended-steps">
        <div>
          <span>01</span>
          <div>
            <strong>Contact HR or your plant head</strong>
            <p>Ask them to verify your employment status and restore the account if appropriate.</p>
          </div>
        </div>
        <div>
          <span>02</span>
          <div>
            <strong>Review any pending requests</strong>
            <p>Approvals are reassigned by the configured approval authority, not lost.</p>
          </div>
        </div>
        <div>
          <span>03</span>
          <div>
            <strong>Sign in again after restoration</strong>
            <p>Use the same work email. Your roles and plant scope are restored from the employee record.</p>
          </div>
        </div>
      </div>

      <a href="mailto:support@indra.example?subject=INDRA%20account%20suspended" className="pt-btn pt-btn-primary pt-btn-lg pt-auth-submit">
        <Icon name="Mail" size={15} /> Contact support
      </a>
      <div className="pt-auth-links pt-auth-links-center">
        <button type="button" className="pt-text-link" onClick={() => auth.signOut()}>
          <Icon name="LogOut" size={13} /> Sign out
        </button>
        <a href="/" className="pt-text-link">Return to twin studio</a>
      </div>
    </AuthLayout>
  );
}
