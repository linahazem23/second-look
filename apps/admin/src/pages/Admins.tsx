import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Pill } from '../Pill.js';

interface AdminAccount {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export function Admins() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('moderator');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get('/api/admin/admins').then((res) => setAdmins(res.admins)).catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/admin/admins', { email, password, fullName, role });
      setShowForm(false);
      setEmail(''); setPassword(''); setFullName('');
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head"><h1>Admins</h1><p>Manage who has access to this tool and at what level</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button className="btn solid" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Add admin'}</button>
      </div>
      {showForm && (
        <form className="detail-card" style={{ marginBottom: 20, maxWidth: 380 }} onSubmit={submit}>
          <label className="field">Full name<input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></label>
          <label className="field">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="field">Temporary password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <label className="field">Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="moderator">Moderator</option>
              <option value="super_admin">Super admin</option>
            </select>
          </label>
          <button className="btn solid" type="submit" disabled={busy} style={{ marginTop: 12 }}>{busy ? 'Creating…' : 'Create admin'}</button>
        </form>
      )}
      <div className="panel">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Added</th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.fullName}</td><td>{a.email}</td>
                <td><Pill value={a.role} /></td>
                <td>{new Date(a.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
