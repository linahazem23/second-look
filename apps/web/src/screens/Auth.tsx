import React, { useState } from 'react';
import { useAuth } from '../AuthContext.js';
import { friendlyError } from '../api.js';

type Mode = 'login' | 'signup';

export function Auth() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [area, setArea] = useState('');
  const [age, setAge] = useState('');
  const [languagePreference, setLanguagePreference] = useState('en');
  const [referralCode, setReferralCode] = useState(() => new URLSearchParams(window.location.search).get('ref') ?? '');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // AuthContext's signup() already refreshes the current user; App then routes
      // the newly-created (unverified, guidelines-pending) account into onboarding.
      await signup({ email, password, fullName, area, age: age ? Number(age) : undefined, languagePreference, referralCode: referralCode || undefined });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="onboarding">
      <div className="ob-body">
        <p className="kicker" style={{ fontSize: 12, color: 'var(--ink-light)', letterSpacing: 0.4 }}>
          Women-only resale &middot; Egypt
        </p>
        <h1>Second Look</h1>
        <p className="lead">
          Buy and sell skincare, makeup, and clothes with identity-verified members, moderated reviews, and demand
          matching built in.
        </p>

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="ob-err">{error}</p>}
            <div className="ob-footer" style={{ padding: '16px 0 0' }}>
              <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
              <button type="button" className="switch-link" onClick={() => { setMode('signup'); setError(null); }}>
                New here? Create an account
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <label>Full name</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label>Password</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            <label>Area / neighborhood</label>
            <input required placeholder="e.g. Maadi" value={area} onChange={(e) => setArea(e.target.value)} />
            <label>Age</label>
            <input type="number" min={1} value={age} onChange={(e) => setAge(e.target.value)} />
            <label>Preferred language</label>
            <select value={languagePreference} onChange={(e) => setLanguagePreference(e.target.value)}>
              <option value="en">English</option>
              <option value="ar">Arabic (coming soon — English shown for now)</option>
            </select>
            <label>Referral code (optional)</label>
            <input value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} placeholder="e.g. AB3XQ9KM" />
            {error && <p className="ob-err">{error}</p>}
            <div className="ob-footer" style={{ padding: '16px 0 0' }}>
              <button type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
              <button type="button" className="switch-link" onClick={() => { setMode('login'); setError(null); }}>
                Already have an account? Log in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
