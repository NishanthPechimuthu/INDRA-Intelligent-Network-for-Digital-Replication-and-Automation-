import React, { useMemo, useState } from 'react';
import { useAuth } from './AuthProvider.jsx';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import Icon from '../components/Icon.jsx';
import { Callout, Field, InfoRow, DefinitionGrid, TextInput } from '../components/Ui.jsx';
import { getDemoData } from '../data/demoStore.js';
import { navigate, queryParam } from '../lib/router.js';

function findInvitation(invitationId, email) {
  const data = getDemoData();
  return (
    data.invitations.find(
      (item) => (invitationId && (item.id === invitationId || item.token === invitationId)) ||
        (email && item.email.toLowerCase() === email.toLowerCase()),
    ) || null
  );
}

export default function ActivatePage() {
  const auth = useAuth();
  const invitationId = queryParam('invitation') || queryParam('invitation_id') || queryParam('token');
  const invitedEmail = queryParam('email') || auth.session?.user?.email || '';
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const invitation = useMemo(() => (auth.isDemo ? findInvitation(invitationId, invitedEmail) : null), [auth.isDemo, invitationId, invitedEmail]);
  const invalid = auth.isDemo && !invitation;
  const roleLabel = invitation?.roleKey?.replaceAll('_', ' ') || 'Assigned role';
  const validPassword = password.length >= 12;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!validPassword) {
      setError('Create a password of at least 12 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const result = await auth.activateAccount({
        invitationId: invitation?.id || invitationId,
        email: invitation?.email || email || invitedEmail,
        password,
      });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setDone(true);
      if (!auth.isDemo && auth.isAuthenticated) setTimeout(() => navigate('/dashboard', { replace: true }), 1000);
    } finally {
      setBusy(false);
    }
  }

  if (invalid) {
    return (
      <AuthLayout compact>
        <AuthHeading icon="Mail" eyebrow="ACCOUNT INVITATION" title="Invitation not found" description="This link is invalid, expired or already used." />
        <Callout tone="warn" title="Ask for a new invitation">
          Organization invitations expire after seven days. Ask your HR administrator or plant head to
          resend the invitation from the Employee administration page.
        </Callout>
        <a href="/login" className="pt-btn pt-btn-primary pt-btn-lg pt-auth-submit">
          Back to sign in <Icon name="ArrowRight" size={15} />
        </a>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout compact>
      <AuthHeading
        icon="UserPlus"
        eyebrow="ACCOUNT INVITATION"
        title={done ? 'Account activated' : 'Activate your INDRA account'}
        description={done ? 'Your identity is ready. Sign in to open your role-specific workspace.' : 'Set a password to activate the account your organization created for you.'}
      />

      {!done && invitation && (
        <div className="pt-invite-summary">
          <div className="pt-invite-badge"><Icon name="BadgeCheck" size={18} /></div>
          <DefinitionGrid columns={2}>
            <InfoRow label="Invited email" value={invitation.email} />
            <InfoRow label="Role" value={roleLabel} />
            <InfoRow label="Plant" value={getDemoData().plants.find((plant) => plant.id === invitation.plantId)?.name || 'Organization-wide'} />
            <InfoRow label="Expires" value={new Date(invitation.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
            <InfoRow label="Department" value={getDemoData().departments.find((department) => department.id === invitation.departmentId)?.name || '—'} />
          </DefinitionGrid>
        </div>
      )}

      {!done && !invitation && !auth.isDemo && (
        <Callout tone="info" title="Securely invited">
          You opened an INDRA invitation link. Choose a password to complete activation. If the link has
          expired, ask your administrator to resend it.
        </Callout>
      )}

      {done ? (
        <div className="pt-auth-success">
          <div className="pt-success-mark"><Icon name="Check" size={26} /></div>
          <h3>Welcome to INDRA</h3>
          <p>Your account is active. Continue to sign in with your new password.</p>
          <a href="/login" className="pt-btn pt-btn-primary pt-btn-lg">
            Sign in <Icon name="ArrowRight" size={15} />
          </a>
        </div>
      ) : (
        <form className="pt-auth-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="pt-form-error" role="alert"><Icon name="AlertTriangle" size={15} /> {error}</div>}
          {!invitedEmail && (
            <Field label="Work email" htmlFor="activate-email" required>
              <div className="pt-input-with-icon">
                <Icon name="Mail" size={15} />
                <TextInput id="activate-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </Field>
          )}
          <Field label="Create password" htmlFor="activate-password" required hint="Minimum 12 characters. Use a unique password you do not use elsewhere.">
            <div className="pt-input-with-icon">
              <Icon name="KeyRound" size={15} />
              <TextInput
                id="activate-password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button type="button" className="pt-input-action" onClick={() => setShow((current) => !current)} aria-label={show ? 'Hide password' : 'Show password'}>
                <Icon name={show ? 'EyeOff' : 'Eye'} size={15} />
              </button>
            </div>
          </Field>
          <Field label="Confirm password" htmlFor="activate-confirm" required>
            <div className="pt-input-with-icon">
              <Icon name="KeyRound" size={15} />
              <TextInput
                id="activate-confirm"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>
          </Field>
          <button type="submit" className="pt-btn pt-btn-primary pt-btn-lg pt-auth-submit" disabled={busy}>
            {busy ? <span className="pt-spinner" /> : <Icon name="UserCheck" size={15} />}
            {busy ? 'Activating account…' : 'Activate account'}
          </button>
          <p className="pt-auth-small">
            By activating you confirm the invitation was intended for you and accept the organization&apos;s
            information security policy.
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
