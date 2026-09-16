import React, { useState } from 'react';
import { useAuth } from '../AuthContext.js';
import { api, friendlyError } from '../api.js';
import { Icon } from '../Icon.js';
import { suggestUsername } from '../identity.js';

type Mode = 'login' | 'signup' | 'forgot';
type SignupStep = 1 | 2 | 3;

export function Auth({ initialMode = 'login', reason, onCancel }: { initialMode?: Mode; reason?: string; onCancel?: () => void }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [area, setArea] = useState('');
  const [age, setAge] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [languagePreference, setLanguagePreference] = useState('en');
  const [referralCode, setReferralCode] = useState(() => new URLSearchParams(window.location.search).get('ref') ?? '');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const isMinor = age !== '' && Number(age) < 18;
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/api/auth/forgot-password', { email: forgotEmail });
      setForgotSent(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

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

  function goToStep2(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSignupStep(2);
  }

  function goToStep3(e: React.FormEvent) {
    e.preventDefault();
    if (isMinor && (!guardianName || !guardianPhone || !guardianEmail)) {
      setError("A guardian's name, phone, and email are required for members under 18.");
      return;
    }
    setError(null);
    if (!usernameTouched) setUsername(suggestUsername());
    setSignupStep(3);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // AuthContext's signup() already refreshes the current user; App then routes
      // the newly-created (unverified, guidelines-pending) account into onboarding.
      await signup({
        email,
        password,
        fullName,
        area,
        age: age ? Number(age) : undefined,
        phoneNumber,
        languagePreference,
        referralCode: referralCode || undefined,
        username: username || undefined,
        guardianName: isMinor ? guardianName : undefined,
        guardianPhone: isMinor ? guardianPhone : undefined,
        guardianEmail: isMinor ? guardianEmail : undefined
      });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="onboarding">
      {mode === 'signup' && (
        <div className="ob-dots">
          {[1, 2, 3].map((s) => <div key={s} className={s <= signupStep ? 'on' : ''} />)}
        </div>
      )}
      <div className="ob-body">
        {onCancel && (
          <button
            type="button"
            className="back-btn"
            style={{ marginBottom: 8 }}
            onClick={() => {
              if (mode === 'signup' && signupStep > 1) { setSignupStep((s) => (s - 1) as SignupStep); setError(null); return; }
              onCancel();
            }}
          >
            <Icon name="arrowLeft" size={18} />
          </button>
        )}
        <p className="kicker" style={{ fontSize: 12, color: 'var(--ink-light)', letterSpacing: 0.4 }}>
          Women-only resale &middot; Egypt
        </p>
        <h1>Second Look</h1>
        <p className="lead">
          {reason ??
            'Buy and sell skincare, makeup, and clothes with identity-verified members, moderated reviews, and demand matching built in.'}
        </p>

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button
              type="button"
              className="switch-link"
              style={{ marginTop: 6 }}
              onClick={() => { setMode('forgot'); setError(null); setForgotEmail(email); setForgotSent(false); }}
            >
              Forgot password?
            </button>
            {error && <p className="ob-err">{error}</p>}
            <div className="ob-footer" style={{ padding: '16px 0 0' }}>
              <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
              <button type="button" className="switch-link" onClick={() => { setMode('signup'); setSignupStep(1); setError(null); }}>
                New here? Create an account
              </button>
            </div>
          </form>
        ) : mode === 'forgot' ? (
          forgotSent ? (
            <div>
              <p className="lead">If that email has an account, we've sent a link to reset the password. Check your inbox.</p>
              <div className="ob-footer" style={{ padding: '16px 0 0' }}>
                <button type="button" onClick={() => { setMode('login'); setError(null); }}>Back to login</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword}>
              <label>Email</label>
              <input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
              {error && <p className="ob-err">{error}</p>}
              <div className="ob-footer" style={{ padding: '16px 0 0' }}>
                <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
                <button type="button" className="switch-link" onClick={() => { setMode('login'); setError(null); }}>
                  Back to login
                </button>
              </div>
            </form>
          )
        ) : signupStep === 1 ? (
          <form onSubmit={goToStep2}>
            <label>Full name</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <label>Password</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="ob-err">{error}</p>}
            <div className="ob-footer" style={{ padding: '16px 0 0' }}>
              <button type="submit">Continue</button>
              <button type="button" className="switch-link" onClick={() => { setMode('login'); setError(null); }}>
                Already have an account? Log in
              </button>
            </div>
          </form>
        ) : signupStep === 2 ? (
          <form onSubmit={goToStep3}>
            <label>Area / neighborhood</label>
            <input required placeholder="e.g. Maadi" value={area} onChange={(e) => setArea(e.target.value)} />
            <label>Age</label>
            <input type="number" min={1} required value={age} onChange={(e) => setAge(e.target.value)} />
            <label>Phone number</label>
            <input
              type="tel"
              required
              placeholder="01xxxxxxxxx"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="lead" style={{ fontSize: 11.5, marginTop: -6 }}>
              So we can reach you fast if anything urgent ever comes up with an order.
            </p>

            {isMinor && (
              <div className="plain-card" style={{ margin: '10px 0' }}>
                <h3>A guardian is required for under 18</h3>
                <div className="sub">
                  Someone 18 or older — a sister, mother, or cousin — who'll confirm her own ID and be the safety contact for this account.
                </div>
                <label style={{ marginTop: 10 }}>Guardian's full name</label>
                <input required value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
                <label>Guardian's phone number</label>
                <input required type="tel" placeholder="01xxxxxxxxx" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
                <label>Guardian's email</label>
                <input required type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
              </div>
            )}
            {error && <p className="ob-err">{error}</p>}
            <div className="ob-footer" style={{ padding: '16px 0 0' }}>
              <button type="submit">Continue</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <label>Username</label>
            <input
              placeholder="Shown instead of your name — leave blank to use your name"
              value={username}
              onChange={(e) => { setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '')); setUsernameTouched(true); }}
              maxLength={20}
            />
            <p className="lead" style={{ fontSize: 11.5, marginTop: -6 }}>
              We suggested one — change it, or clear the field to just use your real name.
            </p>

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
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
