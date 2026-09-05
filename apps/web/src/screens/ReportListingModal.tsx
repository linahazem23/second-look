import React, { useState } from 'react';
import { api, friendlyError } from '../api.js';

const REASONS = [
  { value: 'price_unreasonable', label: "Price seems unreasonable for the item's condition" },
  { value: 'photo_mismatch', label: 'Photos don’t match the description' },
  { value: 'authenticity_concern', label: 'Authenticity concern' },
  { value: 'something_else', label: 'Something else' }
];

export function ReportListingModal({ listingId, listingTitle, onClose, onReported }: {
  listingId: string;
  listingTitle: string;
  onClose: () => void;
  onReported: () => void;
}) {
  const [reason, setReason] = useState('price_unreasonable');
  const [detailText, setDetailText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/reports/listings', { listingId, reason, detailText: detailText || undefined });
      setDone(true);
      onReported();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(90,46,61,0.32)', zIndex: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div className="post-form" style={{ margin: '0 18px 18px', width: '100%', maxWidth: 394 }} onClick={(e) => e.stopPropagation()}>
        {done ? (
          <>
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 14.5 }}>Reported</h3>
            <div className="sub" style={{ marginTop: 6 }}>
              "{listingTitle}" has been hidden pending a moderator's review. Thanks for flagging it.
            </div>
            <div className="form-row">
              <button type="button" className="btn-solid" onClick={onClose}><span className="shine" /><span className="label">Done</span></button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 14.5 }}>Report "{listingTitle}"</h3>
            <label>Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <label>Details (optional)</label>
            <textarea rows={3} value={detailText} onChange={(e) => setDetailText(e.target.value)} placeholder="Anything that helps a moderator review this" />
            {error && <p className="field-error">{error}</p>}
            <div className="form-row">
              <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-solid" disabled={busy}>
                <span className="shine" /><span className="label">{busy ? 'Reporting…' : 'Submit report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
