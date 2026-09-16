import React, { useState } from 'react';

const API_BASE = (import.meta as any).env.VITE_API_BASE ?? 'http://localhost:4000';

// Public — reached only via the one-time link emailed on a forgot-password
// request, so this bypasses auth entirely (there's no session to check).
export function ResetPassword({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Those passwords don't match.");

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Something went wrong.');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div id="onboarding">
        <div className="ob-body">
          <h1>Password updated</h1>
          <p className="lead">You can log in with your new password now.</p>
          <div className="ob-footer" style={{ padding: '16px 0 0' }}>
            <button onClick={onDone}>Go to login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="onboarding">
      <div className="ob-body">
        <h1>Set a new password</h1>
        <p className="lead">Choose a new password for your Second Look account.</p>
        <form onSubmit={handleSubmit}>
          <label>New password</label>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <label>Confirm new password</label>
          <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <p className="ob-err">{error}</p>}
          <div className="ob-footer" style={{ padding: '16px 0 0' }}>
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
