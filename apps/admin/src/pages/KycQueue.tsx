import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';

interface PendingKycUser {
  id: string;
  fullName: string;
  email: string;
  area: string;
  age: number | null;
  createdAt: string;
}

export function KycQueue() {
  const [users, setUsers] = useState<PendingKycUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get('/api/admin/kyc-pending').then((res) => setUsers(res.users)).catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, []);

  async function approve(id: string) {
    try {
      await api.post(`/api/admin/kyc-pending/${id}/approve`);
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function reject(id: string) {
    const reason = window.prompt('Reason for rejecting this verification (the member will need to resubmit):');
    if (!reason) return;
    try {
      await api.post(`/api/admin/kyc-pending/${id}/reject`, { reason });
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <>
      <div className="page-head"><h1>Identity verification</h1><p>Accounts routed to manual review after the automated check couldn't confirm them</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Area</th><th>Age</th><th>Waiting since</th><th></th></tr></thead>
          <tbody>
            {users.length === 0 && !error && <tr className="empty-row"><td colSpan={6}>Nothing pending review</td></tr>}
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}</td><td>{u.email}</td><td>{u.area}</td><td>{u.age ?? '—'}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="btn-row">
                  <button className="btn solid" onClick={() => approve(u.id)}>Approve</button>
                  <button className="btn ghost" onClick={() => reject(u.id)}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
