import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { useAuth } from '../AuthContext.js';
import { Icon } from '../Icon.js';
import { LocationAreaField } from '../LocationArea.js';

const CATEGORIES = ['Skincare', 'Haircare', 'Makeup', 'Clothes'] as const;

interface WantRequest {
  id: string;
  itemName: string;
  category: string;
  area: string;
  note: string | null;
  requesterId: string;
  boosted: boolean;
}

export function Want() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<WantRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<string>('Skincare');
  const [area, setArea] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [boostingId, setBoostingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/demand');
      setRequests(res.requests.filter((r: WantRequest) => r.requesterId === user?.id));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirrors Home.tsx's listing boost flow — a real 25 EGP Paymob charge, with
  // the badge only appearing once the webhook confirms payment went through.
  function pollBoostPayment(wantId: string, boostPaymentId: string, attempt = 0) {
    if (attempt > 40) {
      setBoostingId((current) => (current === wantId ? null : current));
      setActionError('Still waiting on that payment — if you completed it, the badge will appear on refresh.');
      return;
    }
    setTimeout(async () => {
      try {
        const res = await api.get(`/api/demand/boost-payments/${boostPaymentId}`);
        if (res.paid) {
          setRequests((prev) => prev.map((r) => (r.id === wantId ? { ...r, boosted: true } : r)));
          setActionError(null);
          setBoostingId((current) => (current === wantId ? null : current));
          return;
        }
      } catch {
        // transient poll error — keep trying
      }
      pollBoostPayment(wantId, boostPaymentId, attempt + 1);
    }, 3000);
  }

  async function boostWant(id: string) {
    setActionError(null);
    setBoostingId(id);
    try {
      const res = await api.post(`/api/demand/${id}/boost`);
      if (res.wasFree) {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, boosted: true } : r)));
        setBoostingId(null);
        return;
      }
      const checkoutTab = window.open(res.iframeUrl, '_blank');
      if (!checkoutTab) {
        setActionError('Your browser blocked the payment tab. Please allow popups for this site and try boosting again.');
        setBoostingId(null);
        return;
      }
      setActionError('Complete the 25 EGP payment in the new tab — the Boosted badge appears here automatically once it goes through.');
      pollBoostPayment(id, res.boostPaymentId);
    } catch (err) {
      setActionError(friendlyError(err));
      setBoostingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!area) return setFormError('We need your area — allow location access or pick one.');
    setBusy(true);
    try {
      await api.post('/api/demand', { itemName, category, area, note: note || undefined });
      setItemName('');
      setNote('');
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="section-head">
        <h1>Your wants</h1>
        <p>Post what you're looking for and sellers nearby get notified</p>
      </div>

      <div className="post-btn-wrap">
        <button className="post-toggle" onClick={() => setShowForm((v) => !v)}>
          <Icon name="plus" size={16} /> {showForm ? 'Cancel' : 'Post a want'}
        </button>
      </div>

      {showForm && (
        <form className="post-form" onSubmit={handleSubmit}>
          <label>Item</label>
          <input required placeholder="e.g. Green clay mask" value={itemName} onChange={(e) => setItemName(e.target.value)} />
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label>Area</label>
          <LocationAreaField value={area} onChange={setArea} />
          <label>Note</label>
          <textarea rows={2} placeholder="Any details that help sellers" value={note} onChange={(e) => setNote(e.target.value)} />
          {formError && <p className="field-error">{formError}</p>}
          <div className="form-row">
            <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn-solid" disabled={busy}>
              <span className="shine" /><span className="label">{busy ? 'Posting…' : 'Post'}</span>
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <p className="field-error" style={{ margin: '0 18px 10px' }}>
          {actionError} <button type="button" onClick={() => setActionError(null)} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', padding: 0 }}>Dismiss</button>
        </p>
      )}
      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && requests.length === 0 && <div className="empty-state">You haven't posted any wants yet.</div>}

      {requests.map((w) => (
        <div className="plain-card" key={w.id}>
          <h3>{w.itemName} {w.boosted && <span className="match-badge">Boosted</span>}</h3>
          <div className="sub">{w.note || 'No extra notes'} &middot; {w.area}</div>
          {!w.boosted && (
            <div className="row">
              <button className="btn-outline" disabled={boostingId === w.id} onClick={() => boostWant(w.id)}>
                {boostingId === w.id ? 'Waiting for payment…' : 'Boost (25 EGP)'}
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
