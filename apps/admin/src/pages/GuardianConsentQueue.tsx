import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';

interface PendingGuardianConsent {
  id: string;
  fullName: string;
  email: string;
  age: number | null;
  createdAt: string;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  guardianIdDocumentUrl: string | null;
}

export function GuardianConsentQueue() {
  const [users, setUsers] = useState<PendingGuardianConsent[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get('/api/admin/guardian-consent-pending').then((res) => setUsers(res.users)).catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, []);

  async function approve(id: string) {
    try {
      await api.post(`/api/admin/guardian-consent-pending/${id}/approve`);
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function reject(id: string) {
    const reason = window.prompt('Reason for rejecting this guardian submission (the guardian will need to resubmit):');
    if (!reason) return;
    try {
      await api.post(`/api/admin/guardian-consent-pending/${id}/reject`, { reason });
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <>
      <div className="page-head"><h1>Guardian consent</h1><p>Under-18 members — a guardian confirmed via ID upload, awaiting review</p></div>
      {error && <p className="login-err">{error}</p>}
      {users.length === 0 && !error && <div className="panel"><p style={{ padding: 16 }}>Nothing pending review</p></div>}
      {users.map((u) => (
        <div className="panel" key={u.id} style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong>{u.fullName}</strong> &middot; {u.email} &middot; Age {u.age ?? '—'}
              <div style={{ fontSize: 13, color: '#777' }}>
                Guardian: {u.guardianName} &middot; {u.guardianPhone} &middot; {u.guardianEmail}
              </div>
              <div style={{ fontSize: 13, color: '#777' }}>Signed up {new Date(u.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="btn-row">
              <button className="btn solid" onClick={() => approve(u.id)}>Approve</button>
              <button className="btn ghost" onClick={() => reject(u.id)}>Reject</button>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#777', marginBottom: 4 }}>Guardian's ID document</div>
            {u.guardianIdDocumentUrl
              ? <img src={u.guardianIdDocumentUrl} alt="Guardian ID" style={{ width: 220, maxHeight: 220, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 6, background: '#fafafa' }} />
              : <div style={{ width: 220, height: 120, border: '1px dashed #ccc', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12 }}>No document uploaded</div>}
          </div>
        </div>
      ))}
    </>
  );
}
