import React, { useMemo, useState } from 'react';
import { useAuth } from './AuthProvider.jsx';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import Icon from '../components/Icon.jsx';
import { Callout, Field, TextInput } from '../components/Ui.jsx';
import { navigate, queryParam } from '../lib/router.js';

function scorePassword(value) {
  const checks = [
    value.length >= 12,
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ];
  return checks.filter(Boolean).length;
}

export default function ResetPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState(queryParam('email') || auth.session?.user?.email || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const strength = useMemo(() => scorePassword(password), [password]);
  const canReset = auth.isDemo || auth.recovery || Boolean(auth.session);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (password.length < 12) {
      setError('Use at least 12 characters for your new password.');
      return;
    }
    if (strength < 4) {
      setError('Include upper and lower case, a number and a symbol.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (auth.isDemo && !auth.session) {
        if (!email.trim()) {
          setError('Enter the demo account email you want to update.');
          return;
        }
        const { resetDemoPassword } = await import('../data/demoStore.js');
        const result = resetDemoPassword(email.trim(), password);
        if (result.error) setError(result.error.message);
        else setDone(result.message);
        return;
      }
      const result = await auth.completePasswordReset(password);
      if (result.error) setError(result.error.message);
      else {
        setDone(result.message);
        if (auth.isAuthenticated) setTimeout(() => navigate('/dashboard', { replace: true }), 900);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!canReset) {
    return (
      <AuthLayout compact>
        <AuthHeading icon="LockKeyhole" eyebrow="RESET LINK" title="This reset link is invalid" description="Reset links are single-use and expire. Request a new link to continue securely." />
        <Callout tone="warn" title="No recovery session">
          Open the link from your most recent password reset email, or start again from the sign-in page.
        </Callout>
        <a href="/forgot-password" className="pt-btn pt-btn-primary pt-btn-lg pt-auth-submit">
          Request a new link <Icon name="ArrowRight" size={15} />
        </a>
        <div className="pt-auth-links pt-auth-links-center">
          <a href="/login" className="pt-text-link"><Icon name="ArrowLeft" size={13} /> Back to sign in</a>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout compact>
      <AuthHeading
        icon="LockKeyhole"
        eyebrow="SECURE RESET"
        title={done ? 'Password updated' : 'Choose a new password'}
        description={done ? 'Your INDRA account is ready.' : 'Use a unique password of at least 12 characters. It will be checked against your organization password policy.'}
      />

      {done ? (
        <div className="pt-auth-success">
          <div className="pt-success-mark"><Icon name="Check" size={26} /></div>
          <h3>You&apos;re all set</h3>
          <p>{done}</p>
          <a href="/login" className="pt-btn pt-btn-primary pt-btn-lg">
            Sign in <Icon name="ArrowRight" size={15} />
          </a>
        </div>
      ) : (
        <form className="pt-auth-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="pt-form-error" role="alert"><Icon name="AlertTriangle" size={15} /> {error}</div>
          )}
          {auth.isDemo && !auth.session && (
            <Field label="Demo account email" htmlFor="reset-email" required>
              <div className="pt-input-with-icon">
                <Icon name="Mail" size={15} />
                <TextInput id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" />
              </div>
            </Field>
          )}
          <Field label="New password" htmlFor="reset-password" required>
            <div className="pt-input-with-icon">
              <Icon name="KeyRound" size={15} />
              <TextInput
                id="reset-password"
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
          <div className={`pt-strength pt-strength-${strength}`}>
            <span /><span /><span /><span /><span />
            <small>{password ? ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'][strength] : 'Password strength'}</small>
          </div>
          <Field label="Confirm password" htmlFor="reset-confirm" required>
            <div className="pt-input-with-icon">
              <Icon name="KeyRound" size={15} />
              <TextInput
                id="reset-confirm"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
              {confirm && <span className="pt-input-valid">{password === confirm ? <Icon name="CheckCircle2" size={15} /> : <Icon name="AlertTriangle" size={15} />}</span>}
            </div>
          </Field>
          <button type="submit" className="pt-btn pt-btn-primary pt-btn-lg pt-auth-submit" disabled={busy}>
            {busy ? <span className="pt-spinner" /> : <Icon name="ShieldCheck" size={15} />}
            {busy ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      )}

      <div className="pt-auth-help">
        <Icon name="ShieldCheck" size={15} />
        <span>Passwords are never stored in INDRA application tables. Supabase Auth owns credentials and session tokens.</span>
      </div>
    </AuthLayout>
  );
}
