import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Pill } from '../Pill.js';
import { Icon } from '../Icon.js';

interface ModCase {
  id: string;
  contextType: string;
  reviewerId: string | null;
  reviewedUserId: string | null;
  flagTarget: string;
  status: string;
  reason: string;
  createdAt: string;
}

export function Moderation() {
  const [cases, setCases] = useState<ModCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ModCase | null>(null);

  function load() {
    api.get('/api/admin/moderation-cases').then((res) => setCases(res.cases)).catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, []);

  async function act(action: 'coach' | 'escalate' | 'flag-reviewer-instead' | 'dismiss') {
    if (!selected) return;
    try {
      const res = await api.post(`/api/admin/moderation-cases/${selected.id}/${action}`);
      if (action === 'flag-reviewer-instead') {
        setSelected(res.case);
      } else {
        setSelected(null);
        load();
      }
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  if (selected) {
    const targetLabel = selected.flagTarget === 'reviewer' ? 'reviewer' : 'reviewed party';
    return (
      <>
        <button className="back-link" onClick={() => setSelected(null)}><Icon name="back" size={14} /> Back to queue</button>
        <div className="page-head"><h1>Case #{selected.id.slice(0, 8)}</h1><p>{selected.contextType} &middot; <Pill value={selected.status} /></p></div>
        <div className="detail-card" style={{ marginBottom: 16 }}>
          <p className="sub-label">REASON</p>
          <p style={{ fontSize: 13 }}>{selected.reason}</p>
        </div>
        <div className="detail-grid">
          <div className="detail-card">
            <p className="sub-label">REVIEWER</p>
            <p style={{ fontSize: 12.5, color: 'var(--ink-light)' }}>User ID: {selected.reviewerId ?? '—'}</p>
            <textarea rows={3} placeholder="Notes from your call with the reviewer…" />
          </div>
          <div className="detail-card">
            <p className="sub-label">REVIEWED PARTY</p>
            <p style={{ fontSize: 12.5, color: 'var(--ink-light)' }}>User ID: {selected.reviewedUserId ?? '—'}</p>
            <textarea rows={3} placeholder="Notes from your call with the reviewed party…" />
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--ink-light)', margin: '10px 0' }}>
          Current target of coaching/strike actions: <b>{targetLabel}</b>
        </p>
        <div className="btn-row" style={{ marginTop: 6 }}>
          <button className="btn solid" onClick={() => act('coach')}>Coach {targetLabel}</button>
          <button className="btn outline" onClick={() => act('escalate')}>Escalate to strike</button>
          <button className="btn ghost" onClick={() => act('flag-reviewer-instead')}>Flag reviewer instead</button>
          <button className="btn ghost" onClick={() => act('dismiss')}>Dismiss case</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head"><h1>Moderation queue</h1><p>Flagged reviews and reports awaiting a decision</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Case</th><th>Type</th><th>Reason</th><th>Status</th></tr></thead>
          <tbody>
            {cases.length === 0 && !error && <tr className="empty-row"><td colSpan={4}>No open cases</td></tr>}
            {cases.map((c) => (
              <tr className="clickable" key={c.id} onClick={() => setSelected(c)}>
                <td>#{c.id.slice(0, 8)}</td><td>{c.contextType}</td><td>{c.reason}</td><td><Pill value={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
