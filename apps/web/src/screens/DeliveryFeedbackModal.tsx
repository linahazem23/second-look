import React, { useState } from 'react';
import { api, friendlyError } from '../api.js';

const CONDITION_OPTIONS = [
  { value: 'as_described', label: 'Exactly as described' },
  { value: 'slightly_different', label: 'Slightly different' },
  { value: 'not_as_described', label: 'Not as described' }
];

// Fired right when a buyer confirms delivery — a quick, immediate pulse-check,
// distinct from the considered 6-day-locked star review. Skippable, since this
// is a nicety for quality control, not a hard gate on confirming delivery.
export function DeliveryFeedbackModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [conditionRating, setConditionRating] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!conditionRating) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/orders/${orderId}/delivery-feedback`, { conditionRating, comment: comment.trim() || undefined });
      setSent(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(90,46,61,0.32)', zIndex: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div className="post-form" style={{ margin: '0 18px 18px', width: '100%', maxWidth: 394 }} onClick={(e) => e.stopPropagation()}>
        {sent ? (
          <>
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 14.5 }}>Thanks for letting us know 💕</h3>
            <div className="sub" style={{ marginTop: 6 }}>This helps us keep quality high across the marketplace.</div>
            <div className="form-row">
              <button type="button" className="btn-solid" onClick={onClose}><span className="shine" /><span className="label">Done</span></button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 14.5 }}>How was the item's condition?</h3>
            <div className="sub" style={{ marginBottom: 8 }}>
              Second Look connects buyers and sellers directly — we're not the seller ourselves, but we care about your experience and use this to keep quality high. Your full star review unlocks in 6 days.
            </div>
            <div className="ob-options">
              {CONDITION_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={conditionRating === o.value ? 'picked' : ''}
                  onClick={() => setConditionRating(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              style={{ marginTop: 10 }}
              placeholder="Anything else worth mentioning? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
            />
            {error && <p className="field-error">{error}</p>}
            <div className="form-row">
              <button type="button" className="btn-cancel" onClick={onClose}>Skip for now</button>
              <button type="submit" className="btn-solid" disabled={busy || !conditionRating}>
                <span className="shine" /><span className="label">{busy ? 'Sending…' : 'Submit'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
