import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Icon } from '../Icon.js';

interface PersonReview {
  id: string;
  starRating: number | null;
  honestListing: boolean | null;
  easyToCommunicate: boolean | null;
  showedUpAsAgreed: boolean | null;
  notes: string | null;
  disputeStatus: string;
}

export function Reviews({ onBack }: { onBack: () => void }) {
  const [received, setReceived] = useState<PersonReview[]>([]);
  const [given, setGiven] = useState<PersonReview[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'received' | 'given'>('received');

  useEffect(() => {
    api.get('/api/reviews/mine')
      .then((res) => { setReceived(res.received); setGiven(res.given); setAvgRating(res.avgRating); })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleDispute(id: string) {
    const note = window.prompt('Explain why you are disputing this review:');
    if (!note) return;
    try {
      await api.post(`/api/reviews/${id}/dispute`, { note });
      setReceived((prev) => prev.map((r) => (r.id === id ? { ...r, disputeStatus: 'disputed' } : r)));
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  const list = tab === 'received' ? received : given;

  return (
    <>
      <div className="section-head">
        <button className="back-btn" onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div>
          <h1 style={{ fontSize: 19 }}>Reviews</h1>
          <p>{avgRating ? `${avgRating.toFixed(1)} average · ${received.length} received` : 'No ratings yet'}</p>
        </div>
      </div>
      <div className="cat-toggle">
        <button className={tab === 'received' ? 'active' : ''} onClick={() => setTab('received')}>Received</button>
        <button className={tab === 'given' ? 'active' : ''} onClick={() => setTab('given')}>Left by you</button>
      </div>

      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && list.length === 0 && <div className="empty-state">Nothing here yet.</div>}

      {list.map((r) => (
        <div className="review-card" key={r.id}>
          <div className="stars">{'★'.repeat(r.starRating ?? 0)}{'☆'.repeat(5 - (r.starRating ?? 0))}</div>
          <div className="sub" style={{ marginTop: 6 }}>
            {r.honestListing && 'Honest listing · '}{r.easyToCommunicate && 'Easy to communicate · '}{r.showedUpAsAgreed && 'Showed up as agreed'}
          </div>
          {r.notes && <p style={{ fontSize: 12.5, marginTop: 8 }}>{r.notes}</p>}
          {tab === 'received' && r.disputeStatus === 'none' && (
            <button className="btn-outline" style={{ marginTop: 10 }} onClick={() => handleDispute(r.id)}>Dispute this review</button>
          )}
          {tab === 'received' && r.disputeStatus === 'disputed' && (
            <span className="verified-tag">Dispute submitted — a moderator will review it</span>
          )}
        </div>
      ))}
    </>
  );
}
