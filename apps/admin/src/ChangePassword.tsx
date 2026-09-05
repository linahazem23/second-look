import React, { useState } from 'react';
import { api, friendlyError } from './api.js';
import { Icon } from './Icon.js';

export function ChangePassword({ onBack }: { onBack: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/admin/me/change-password', { currentPassword, newPassword });
      setDone(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="back-link" onClick={onBack}><Icon name="back" size={14} /> Back</button>
      <div className="page-head"><h1>Change password</h1><p>Especially important if you're still using the seeded default password</p></div>
      {done ? (
        <div className="detail-card">Password updated.</div>
      ) : (
        <form className="detail-card" style={{ maxWidth: 360 }} onSubmit={submit}>
          <label className="field">Current password<input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
          <label className="field">New password (8+ characters)<input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
          {error && <p className="login-err">{error}</p>}
          <button className="btn solid" type="submit" disabled={busy} style={{ marginTop: 12 }}>{busy ? 'Saving…' : 'Update password'}</button>
        </form>
      )}
    </>
  );
}
