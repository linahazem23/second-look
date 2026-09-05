import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Pill } from '../Pill.js';
import { Icon } from '../Icon.js';

interface Appeal {
  id: string;
  userId: string;
  originalDecision: string;
  statement: string;
  status: string;
  responseDueAt: string | null;
}

export function Appeals() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appeal | null>(null);
  const [reason, setReason] = useState('');

  function load() {
    api.get('/api/admin/appeals').then((res) => setAppeals(res.appeals)).catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, []);

  async function decide(outcome: 'overturn' | 'uphold') {
    if (!selected) return;
    if (!reason.trim()) return setError('A reasoning note is required — it gets sent back to the user.');
    try {
      await api.post(`/api/admin/appeals/${selected.id}/decide`, { outcome, reason });
      setSelected(null);
      setReason('');
      setError(null);
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  if (selected) {
    return (
      <>
        <button className="back-link" onClick={() => { setSelected(null); setError(null); }}><Icon name="back" size={14} /> Back to appeals</button>
        <div className="page-head"><h1>Appeal</h1><p>Original decision: {selected.originalDecision} &middot; <Pill value={selected.status} /></p></div>
        <div className="detail-card" style={{ marginBottom: 16 }}>
          <p className="sub-label">USER'S WRITTEN STATEMENT</p>
          <p style={{ fontSize: 13 }}>{selected.statement}</p>
        </div>
        <div className="detail-card">
          <p className="sub-label">YOUR DECISION</p>
          <p style={{ fontSize: 11.5, color: 'var(--ink-light)', marginBottom: 8 }}>
            A moderator who was not involved in the original decision must review this. The reasoning below is shared with the user.
          </p>
          <textarea rows={3} placeholder="Reasoning for your decision…" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <p className="login-err">{error}</p>}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn solid" onClick={() => decide('overturn')}>Overturn</button>
            <button className="btn ghost" onClick={() => decide('uphold')}>Uphold</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head"><h1>Appeals</h1><p>A different moderator than the original decision must review each one</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>User</th><th>Original decision</th><th>Response due</th><th>Status</th></tr></thead>
          <tbody>
            {appeals.length === 0 && !error && <tr className="empty-row"><td colSpan={4}>No pending appeals</td></tr>}
            {appeals.map((a) => (
              <tr className="clickable" key={a.id} onClick={() => setSelected(a)}>
                <td>{a.userId.slice(0, 8)}</td><td>{a.originalDecision}</td>
                <td>{a.responseDueAt ? new Date(a.responseDueAt).toLocaleDateString() : '—'}</td>
                <td><Pill value={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
