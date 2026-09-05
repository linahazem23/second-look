import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Pill } from '../Pill.js';
import { Icon } from '../Icon.js';

interface AdminReport {
  id: string;
  reason: string;
  detailText: string | null;
  originalPrice: number | null;
  listedPrice: number | null;
  status: string;
  listing: { title: string; seller: { fullName: string } };
}

export function Reports() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminReport | null>(null);

  function load() {
    api.get('/api/admin/reported-listings').then((res) => setReports(res.reports)).catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, []);

  async function act(action: 'restore' | 'remove' | 'coaching-tip') {
    if (!selected) return;
    try {
      await api.post(`/api/admin/reported-listings/${selected.id}/${action}`);
      setSelected(null);
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  if (selected) {
    return (
      <>
        <button className="back-link" onClick={() => setSelected(null)}><Icon name="back" size={14} /> Back to reported listings</button>
        <div className="page-head"><h1>{selected.listing.title}</h1><p>Reported by a buyer &middot; <Pill value={selected.status} /></p></div>
        <div className="detail-grid">
          <div className="detail-card">
            <p className="sub-label">LISTING</p>
            <p style={{ fontSize: 13.5, marginBottom: 2 }}><b>{selected.listing.title}</b> &middot; {selected.listing.seller.fullName}</p>
            <p style={{ fontSize: 12.5, color: 'var(--ink-light)', marginBottom: 10 }}>
              Original {selected.originalPrice} EGP &rarr; Listed {selected.listedPrice} EGP
            </p>
            <p className="sub-label">REPORT REASON</p>
            <p style={{ fontSize: 13, marginBottom: 6 }}>{selected.reason.replace(/_/g, ' ')}</p>
            <p style={{ fontSize: 12, color: 'var(--ink-light)' }}>{selected.detailText}</p>
          </div>
          <div className="detail-card">
            <p className="sub-label">YOUR DECISION</p>
            <div className="btn-row">
              <button className="btn solid" onClick={() => act('restore')}>Restore listing</button>
              <button className="btn ghost" onClick={() => act('remove')}>Remove listing</button>
            </div>
            <div style={{ borderTop: '0.5px dashed var(--rose)', marginTop: 16, paddingTop: 14 }}>
              <p style={{ fontSize: 11.5, color: 'var(--ink-light)', marginBottom: 8 }}>
                Send the seller a quick coaching tip — this does <b>not</b> count as a flag or strike.
              </p>
              <button className="btn outline" onClick={() => act('coaching-tip')}>Send coaching tip</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Reported listings</h1>
        <p>One report is enough to take a listing offline pending review — it stays hidden from buyers until resolved here</p>
      </div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Item</th><th>Seller</th><th>Reason</th><th>Status</th></tr></thead>
          <tbody>
            {reports.length === 0 && !error && <tr className="empty-row"><td colSpan={4}>Nothing to review</td></tr>}
            {reports.map((r) => (
              <tr className="clickable" key={r.id} onClick={() => setSelected(r)}>
                <td>{r.listing.title}</td><td>{r.listing.seller.fullName}</td>
                <td>{r.reason.replace(/_/g, ' ')}</td><td><Pill value={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
