import React, { useState } from 'react';
import { useAdminAuth } from './AdminAuthContext.js';
import { friendlyError } from './api.js';

export function Login() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Second Look Admin</h1>
        <p>Internal moderation & operations tool</p>
        <label className="field">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p className="login-err">{error}</p>}
        <button className="btn solid" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
