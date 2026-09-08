import React, { useState } from 'react';
import { api, friendlyError } from '../api.js';

export function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="stars" style={{ cursor: 'pointer' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} onClick={() => onChange(n)}>{n <= value ? '★' : '☆'}</span>
      ))}
    </div>
  );
}

export function ProductReviewForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [productIdentity, setProductIdentity] = useState('');
  const [usageDuration, setUsageDuration] = useState('');
  const [starRating, setStarRating] = useState(5);
  const [beforePhotoUrl, setBeforePhotoUrl] = useState('');
  const [afterPhotoUrl, setAfterPhotoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/reviews/product', { orderId, productIdentity, usageDuration, starRating, beforePhotoUrl, afterPhotoUrl, notes });
      setDone(true);
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) return <div className="plain-card"><h3>Thanks for your product review!</h3></div>;

  return (
    <form className="post-form" onSubmit={submit}>
      <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 14.5 }}>Review this product</h3>
      <label>What product was it (for matching to other listings)?</label>
      <input required value={productIdentity} onChange={(e) => setProductIdentity(e.target.value)} placeholder="e.g. Brand X Glow Serum 30ml" />
      <label>How long did you use it?</label>
      <input required value={usageDuration} onChange={(e) => setUsageDuration(e.target.value)} placeholder="e.g. 3 weeks" />
      <label>Rating</label>
      <Stars value={starRating} onChange={setStarRating} />
      <label>Before photo URL</label>
      <input required value={beforePhotoUrl} onChange={(e) => setBeforePhotoUrl(e.target.value)} />
      <label>After photo URL</label>
      <input required value={afterPhotoUrl} onChange={(e) => setAfterPhotoUrl(e.target.value)} />
      <label>Notes</label>
      <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p className="field-error">{error}</p>}
      <div className="form-row">
        <button type="submit" className="btn-solid" disabled={busy}><span className="shine" /><span className="label">{busy ? 'Sending…' : 'Submit'}</span></button>
      </div>
    </form>
  );
}

export function PersonReviewForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [honestListing, setHonestListing] = useState(true);
  const [easyToCommunicate, setEasyToCommunicate] = useState(true);
  const [showedUpAsAgreed, setShowedUpAsAgreed] = useState(true);
  const [starRating, setStarRating] = useState(5);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/reviews/person', { orderId, honestListing, easyToCommunicate, showedUpAsAgreed, starRating, notes });
      setDone(true);
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="plain-card">
        <h3>Review submitted</h3>
        <div className="sub">It stays private until the other side submits theirs too, or 7 days pass.</div>
      </div>
    );
  }

  return (
    <form className="post-form" onSubmit={submit}>
      <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 14.5 }}>Rate this person</h3>
      <p className="discount-hint" style={{ color: 'var(--ink-light)' }}>Blind &amp; simultaneous — neither side sees the other's review until both are in.</p>
      <div className="toggle-row"><span>Honest, accurate listing</span><input type="checkbox" checked={honestListing} onChange={(e) => setHonestListing(e.target.checked)} /></div>
      <div className="toggle-row"><span>Easy to communicate with</span><input type="checkbox" checked={easyToCommunicate} onChange={(e) => setEasyToCommunicate(e.target.checked)} /></div>
      <div className="toggle-row"><span>Showed up as agreed</span><input type="checkbox" checked={showedUpAsAgreed} onChange={(e) => setShowedUpAsAgreed(e.target.checked)} /></div>
      <label>Overall rating</label>
      <Stars value={starRating} onChange={setStarRating} />
      <label>Notes (optional)</label>
      <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p className="field-error">{error}</p>}
      <div className="form-row">
        <button type="submit" className="btn-solid" disabled={busy}><span className="shine" /><span className="label">{busy ? 'Sending…' : 'Submit'}</span></button>
      </div>
    </form>
  );
}
