import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider.jsx';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import Icon from '../components/Icon.jsx';
import { Callout } from '../components/Ui.jsx';
import { resolveHome } from '../data/accessControl.js';
import { navigate } from '../lib/router.js';

export default function MfaPage() {
  const auth = useAuth();
  // Destructure the stable callbacks: the auth value object changes whenever
  // session state updates, so depending on `auth` itself would re-run the
  // challenge effect on every render and create an infinite loop.
  const { challengeMfa, listMfaFactors } = auth;
  const [factors, setFactors] = useState([]);
  const [factorId, setFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await listMfaFactors();
      if (cancelled) return;
      const verified = (result.factors || []).filter((factor) => factor.status === 'verified');
      setFactors(verified);
      const first = verified[0];
      if (first) {
        setFactorId(first.id);
        const challenge = await challengeMfa(first.id);
        if (!cancelled) {
          if (challenge.error) setError(challenge.error.message);
          else setChallengeId(challenge.challengeId);
        }
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [challengeMfa, listMfaFactors]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    try {
      const result = await auth.verifyMfa({ factorId, challengeId, code });
      if (result.error) {
        setError(result.error.message);
        const challenge = await challengeMfa(factorId);
        if (challenge.challengeId) setChallengeId(challenge.challengeId);
        setCode('');
        return;
      }
      const home = resolveHome(auth.context?.roles || []);
      navigate(home, { replace: true });
    } finally {
      setBusy(false);
    }
  }

  if (!auth.session) {
    return (
      <AuthLayout compact>
        <AuthHeading icon="ShieldCheck" eyebrow="MULTI-FACTOR AUTHENTICATION" title="Start from sign in" description="Multi-factor verification needs an active sign-in attempt." />
        <a href="/login" className="pt-btn pt-btn-primary pt-btn-lg pt-auth-submit">
          Go to sign in <Icon name="ArrowRight" size={15} />
        </a>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout compact>
      <AuthHeading
        icon="Smartphone"
        eyebrow="MULTI-FACTOR AUTHENTICATION"
        title="Verify your identity"
        description="Your account requires a second factor. Enter the current six-digit code from your authenticator app."
      />

      {auth.isDemo && (
        <Callout tone="info" title="Demo verification">
          No authenticator is enrolled in demo mode. Use code <code className="pt-mono">123456</code>.
        </Callout>
      )}

      {!loading && !factors.length && !auth.isDemo && (
        <Callout tone="warn" title="No verified authenticator">
          This account has no verified MFA factor. Contact your administrator or enroll an authenticator
          from Account security after signing in.
        </Callout>
      )}

      <form className="pt-auth-form pt-mfa-form" onSubmit={handleSubmit}>
        {error && <div className="pt-form-error" role="alert"><Icon name="AlertTriangle" size={15} /> {error}</div>}
        {factors.length > 1 && (
          <label className="pt-field">
            <span className="pt-field-label">Authenticator</span>
            <select className="pt-select" value={factorId} onChange={(event) => setFactorId(event.target.value)}>
              {factors.map((factor) => (
                <option key={factor.id} value={factor.id}>{factor.friendlyName || factor.friendly_name || 'Authenticator'}</option>
              ))}
            </select>
          </label>
        )}
        <label className="pt-field">
          <span className="pt-field-label">Six-digit code</span>
          <input
            className="pt-otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            autoFocus
          />
        </label>
        <button type="submit" className="pt-btn pt-btn-primary pt-btn-lg pt-auth-submit" disabled={busy || loading}>
          {busy ? <span className="pt-spinner" /> : <Icon name="ShieldCheck" size={15} />}
          {busy ? 'Verifying code…' : 'Verify and continue'}
        </button>
      </form>

      <div className="pt-mfa-meta">
        <span><Icon name="Clock" size={13} /> Codes rotate every 30 seconds</span>
        <button type="button" className="pt-text-link" onClick={() => auth.signOut()}>
          <Icon name="LogOut" size={13} /> Use another account
        </button>
      </div>

      <div className="pt-auth-help">
        <Icon name="LifeBuoy" size={15} />
        <span>Lost your authenticator? Your administrator can reset MFA factors after identity verification.</span>
      </div>
    </AuthLayout>
  );
}
