import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Pill } from '../Pill.js';

interface Ad {
  id: string;
  slotType: string;
  brand: string;
  startDate: string;
  endDate: string;
  status: string;
}

export function Ads() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [brand, setBrand] = useState('');
  const [slotType, setSlotType] = useState('top_banner');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [creativeUrl, setCreativeUrl] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get('/api/admin/ads').then((res) => setAds(res.ads)).catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/api/admin/ads', { brand, slotType, startDate, endDate, creativeUrl: creativeUrl || undefined });
      setShowForm(false);
      setBrand(''); setStartDate(''); setEndDate(''); setCreativeUrl('');
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head"><h1>Ads</h1><p>Manually scheduled brand placements — top banner or in-feed sponsored card</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button className="btn solid" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : '+ Add placement'}</button>
      </div>
      {showForm && (
        <form className="detail-card" style={{ marginBottom: 20, maxWidth: 420 }} onSubmit={submit}>
          <label className="field">Brand<input type="text" required value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
          <label className="field">Slot type
            <select value={slotType} onChange={(e) => setSlotType(e.target.value)}>
              <option value="top_banner">Top banner</option>
              <option value="in_feed_sponsored_card">In-feed sponsored card</option>
            </select>
          </label>
          <label className="field">Start date<input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label className="field">End date<input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
          <label className="field">Creative URL (optional)<input type="text" value={creativeUrl} onChange={(e) => setCreativeUrl(e.target.value)} /></label>
          <button className="btn solid" type="submit" disabled={busy} style={{ marginTop: 12 }}>{busy ? 'Saving…' : 'Save placement'}</button>
        </form>
      )}
      <div className="panel">
        <table>
          <thead><tr><th>Brand</th><th>Slot</th><th>Dates</th><th>Status</th></tr></thead>
          <tbody>
            {ads.length === 0 && !error && <tr className="empty-row"><td colSpan={4}>No placements yet</td></tr>}
            {ads.map((a) => (
              <tr key={a.id}>
                <td>{a.brand}</td><td>{a.slotType.replace(/_/g, ' ')}</td>
                <td>{new Date(a.startDate).toLocaleDateString()} – {new Date(a.endDate).toLocaleDateString()}</td>
                <td><Pill value={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
