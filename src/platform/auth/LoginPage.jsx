import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider.jsx';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import Icon from '../components/Icon.jsx';
import { Callout, Field, TextInput } from '../components/Ui.jsx';
import { useToast } from '../components/ToastProvider.jsx';
import { navigate } from '../lib/router.js';

export default function LoginPage() {
  const auth = useAuth();
  const { notify } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (auth.isAuthenticated && !auth.requiresMfa) navigate('/dashboard', { replace: true });
  }, [auth.isAuthenticated, auth.requiresMfa]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your work email and password.');
      return;
    }
    setBusy('password');
    try {
      const result = await auth.signIn(email.trim(), password);
      if (result.error) {
        if (result.error.code === 'suspended') {
          navigate('/suspended');
          return;
        }
        setError(result.error.message);
        return;
      }
      if (remember) window.localStorage.setItem('indra.platform.lastEmail', email.trim());
      if (result.requiresMfa) {
        notify('Password accepted. Verify your authenticator to continue.', 'info');
        navigate('/mfa', { replace: true });
        return;
      }
      notify(`Welcome back, ${result.context.profile.fullName?.split(' ')[0] || 'operator'}.`);
      navigate(result.home || '/dashboard', { replace: true });
    } finally {
      setBusy('');
    }
  }

  async function handleOAuth(provider) {
    setError('');
    setBusy(provider);
    try {
      const result = await auth.signInWithOAuth(provider);
      if (result.error) {
        setError(result.error.message);
        notify(result.error.message, 'error');
      }
    } finally {
      setBusy('');
    }
  }

  function fillDemoAccount(account) {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
    notify(`${account.label} credentials filled. Passwords are demo-only.`, 'info');
  }

  return (
    <AuthLayout>
      <AuthHeading
        eyebrow="SECURE SIGN IN"
        title="Sign in to INDRA"
        description="Use your organization account. Access is scoped to your plant, department and assigned roles."
      />

      {auth.isDemo && (
        <Callout tone="info" title="Demo environment">
          Supabase is not configured in this build, so a local demo identity provider is active. Every
          permission still maps to the production role catalogue, RLS policies and protected RPCs shipped
          in <span className="pt-mono">supabase/</span>.
        </Callout>
      )}

      <form className="pt-auth-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="pt-form-error" role="alert">
            <Icon name="AlertTriangle" size={15} />
            {error}
          </div>
        )}

        <Field label="Work email" htmlFor="login-email" required>
          <div className="pt-input-with-icon">
            <Icon name="Mail" size={15} />
            <TextInput
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="name@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus
            />
          </div>
        </Field>

        <Field label="Password" htmlFor="login-password" required>
          <div className="pt-input-with-icon">
            <Icon name="KeyRound" size={15} />
            <TextInput
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="pt-input-action"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={15} />
            </button>
          </div>
        </Field>

        <div className="pt-auth-row">
          <label className="pt-inline-check">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Keep me signed in
          </label>
          <a href="/forgot-password" className="pt-text-link">
            Forgot password?
          </a>
        </div>

        <button type="submit" className="pt-btn pt-btn-primary pt-btn-lg pt-auth-submit" disabled={Boolean(busy)}>
          {busy === 'password' ? <span className="pt-spinner" /> : <Icon name="ArrowRight" size={16} />}
          {busy === 'password' ? 'Verifying…' : 'Sign in'}
        </button>
      </form>

      <div className="pt-divider">
        <span>or continue with</span>
      </div>

      <div className="pt-oauth-row">
        <button type="button" className="pt-oauth-btn" onClick={() => handleOAuth('google')} disabled={Boolean(busy)}>
          <GoogleMark />
          {busy === 'google' ? 'Connecting…' : 'Google'}
        </button>
        <button type="button" className="pt-oauth-btn" onClick={() => handleOAuth('azure')} disabled={Boolean(busy)}>
          <MicrosoftMark />
          {busy === 'azure' ? 'Connecting…' : 'Microsoft'}
        </button>
      </div>
      <p className="pt-auth-small">
        {auth.configured
          ? 'OAuth providers are enabled by the Supabase project administrator. Microsoft Entra ID is supported through Supabase Azure OAuth.'
          : 'OAuth buttons are wired to Supabase Google and Azure providers. Configure credentials to activate them.'}
      </p>

      {auth.isDemo && (
        <div className="pt-demo-accounts">
          <div className="pt-demo-head">
            <span>
              <Icon name="Sparkles" size={14} /> Demo identities
            </span>
            <small>Password: <code>IndraDemo!2026</code></small>
          </div>
          <div className="pt-demo-list">
            {auth.demoAccounts.map((account) => (
              <button key={account.email} type="button" onClick={() => fillDemoAccount(account)}>
                <span className="pt-demo-avatar">{account.label.split(' ').slice(0, 2).map((part) => part[0]).join('')}</span>
                <span>
                  <strong>{account.label}</strong>
                  <small>{account.email}</small>
                </span>
                <Icon name="ArrowUpRight" size={13} />
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="pt-auth-legal">
        By signing in you accept the organization&apos;s acceptable-use policy. Access and actions are
        recorded in the INDRA audit log.
      </p>
    </AuthLayout>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.29V6.62H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38l4.01-3.09Z" />
      <path fill="#EA4335" d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44A11.95 11.95 0 0 0 12 0 12 12 0 0 0 1.26 6.62l4.01 3.09C6.22 6.87 8.87 4.76 12 4.76Z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path fill="#F25022" d="M0 0h11.4v11.4H0z" />
      <path fill="#7FBA00" d="M12.6 0H24v11.4H12.6z" />
      <path fill="#00A4EF" d="M0 12.6h11.4V24H0z" />
      <path fill="#FFB900" d="M12.6 12.6H24V24H12.6z" />
    </svg>
  );
}
