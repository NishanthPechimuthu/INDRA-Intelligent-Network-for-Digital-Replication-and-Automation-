import React, { useState } from 'react';
import { useAuth } from './AuthProvider.jsx';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import Icon from '../components/Icon.jsx';
import { Callout, Field, TextInput } from '../components/Ui.jsx';

export default function ForgotPasswordPage() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Enter the work email associated with your INDRA account.');
      return;
    }
    setBusy(true);
    try {
      const result = await auth.sendPasswordReset(email.trim());
      if (result.error) setError(result.error.message);
      else setSent(result);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout compact>
      <AuthHeading
        icon="KeyRound"
        eyebrow="ACCOUNT RECOVERY"
        title="Reset your password"
        description="Enter your work email. If it belongs to an INDRA account, we will send a secure reset link that expires after 60 minutes."
      />

      {sent ? (
        <div className="pt-auth-success">
          <div className="pt-success-mark">
            <Icon name="Check" size={26} />
          </div>
          <h3>Check your inbox</h3>
          <p>{sent.message}</p>
          {sent.demo && sent.accountFound && (
            <a className="pt-btn pt-btn-primary pt-btn-lg" href={`/reset-password?email=${encodeURIComponent(email)}`}>
              Continue to demo reset <Icon name="ArrowRight" size={15} />
            </a>
          )}
          <div className="pt-auth-links">
            <a href="/login" className="pt-text-link"><Icon name="ArrowLeft" size={13} /> Back to sign in</a>
            <button type="button" className="pt-text-link" onClick={() => setSent(null)}>Use another email</button>
          </div>
        </div>
      ) : (
        <form className="pt-auth-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="pt-form-error" role="alert">
              <Icon name="AlertTriangle" size={15} /> {error}
            </div>
          )}
          <Field label="Work email" htmlFor="forgot-email" required>
            <div className="pt-input-with-icon">
              <Icon name="Mail" size={15} />
              <TextInput
                id="forgot-email"
                type="email"
                autoComplete="username"
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoFocus
              />
            </div>
          </Field>
          <button type="submit" className="pt-btn pt-btn-primary pt-btn-lg pt-auth-submit" disabled={busy}>
            {busy ? <span className="pt-spinner" /> : <Icon name="Send" size={15} />}
            {busy ? 'Sending reset link…' : 'Send reset link'}
          </button>
          <div className="pt-auth-links pt-auth-links-center">
            <a href="/login" className="pt-text-link"><Icon name="ArrowLeft" size={13} /> Back to sign in</a>
          </div>
        </form>
      )}

      {auth.isDemo && (
        <Callout tone="info" title="Demo mode">
          Email delivery is disabled. Known demo addresses continue to the local reset form; no message
          leaves the browser.
        </Callout>
      )}

      <div className="pt-auth-help">
        <Icon name="LifeBuoy" size={15} />
        <span>Still locked out? Contact your plant administrator or <a href="mailto:support@indra.example">support@indra.example</a>.</span>
      </div>
    </AuthLayout>
  );
}
