import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Pill } from '../Pill.js';
import { useAdminAuth } from '../AdminAuthContext.js';

interface AdminUserRow {
  id: string;
  fullName: string;
  email: string;
  status: string;
  buyOnlyUntil: string | null;
  blockedUntil: string | null;
  completedSalesCount: number;
  flagCount: number;
  createdAt: string;
}

export function Users() {
  const { admin } = useAdminAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get('/api/admin/users').then((res) => setUsers(res.users)).catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, []);

  function standing(u: AdminUserRow) {
    if (u.status === 'Blocked') return `Blocked${u.blockedUntil ? ' until ' + new Date(u.blockedUntil).toLocaleDateString() : ' permanently'}`;
    if (u.status === 'BuyOnlyRestricted') return `Restricted — buy only${u.buyOnlyUntil ? ' until ' + new Date(u.buyOnlyUntil).toLocaleDateString() : ''}`;
    return 'Good';
  }

  async function immediateBlock(u: AdminUserRow) {
    const reason = window.prompt(`Reason for immediately blocking ${u.fullName} (severe/unambiguous violation — skips the strike ladder):`);
    if (!reason) return;
    const permanent = window.confirm('Make this a permanent block? Cancel = 14-day block.');
    try {
      await api.post(`/api/admin/users/${u.id}/immediate-block`, { reason, permanent });
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <>
      <div className="page-head"><h1>Users</h1><p>Standing, order history, and flags</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Name</th><th>Joined</th><th>Completed sales</th><th>Flags</th><th>Standing</th><th></th></tr></thead>
          <tbody>
            {users.length === 0 && !error && <tr className="empty-row"><td colSpan={6}>No users yet</td></tr>}
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}<div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{u.email}</div></td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>{u.completedSalesCount}</td>
                <td>{u.flagCount}</td>
                <td><Pill value={standing(u)} /></td>
                <td>
                  {admin?.role === 'super_admin' && u.status !== 'Blocked' && (
                    <button className="btn ghost" onClick={() => immediateBlock(u)}>Immediate block</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
