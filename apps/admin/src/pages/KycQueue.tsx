import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';

interface PendingKycUser {
  id: string;
  fullName: string;
  email: string;
  area: string;
  age: number | null;
  createdAt: string;
  idDocumentUrl: string | null;
  selfieUrl: string | null;
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
      <div className="page-head"><h1>Identity verification</h1><p>Manually reviewed — no automated vendor is wired up yet</p></div>
      {error && <p className="login-err">{error}</p>}
      {users.length === 0 && !error && <div className="panel"><p style={{ padding: 16 }}>Nothing pending review</p></div>}
      {users.map((u) => (
        <div className="panel" key={u.id} style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong>{u.fullName}</strong> &middot; {u.email}
              <div style={{ fontSize: 13, color: '#777' }}>
                {u.area} &middot; Age {u.age ?? '—'} &middot; Waiting since {new Date(u.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="btn-row">
              <button className="btn solid" onClick={() => approve(u.id)}>Approve</button>
              <button className="btn ghost" onClick={() => reject(u.id)}>Reject</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#777', marginBottom: 4 }}>ID document</div>
              {u.idDocumentUrl
                ? <img src={u.idDocumentUrl} alt="ID document" style={{ width: 220, maxHeight: 220, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 6, background: '#fafafa' }} />
                : <div style={{ width: 220, height: 120, border: '1px dashed #ccc', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12 }}>No document uploaded</div>}
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#777', marginBottom: 4 }}>Selfie</div>
              {u.selfieUrl
                ? <img src={u.selfieUrl} alt="Selfie" style={{ width: 220, maxHeight: 220, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 6, background: '#fafafa' }} />
                : <div style={{ width: 220, height: 120, border: '1px dashed #ccc', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12 }}>No selfie uploaded</div>}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
