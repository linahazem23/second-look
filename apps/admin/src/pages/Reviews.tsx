import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';

interface AdminReview {
  id: string;
  type: string;
  starRating: number | null;
  flagged: boolean;
  fraudSignals: string[];
  disputeStatus: string;
  createdAt: string;
}

export function Reviews() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/admin/reviews').then((res) => setReviews(res.reviews)).catch((err) => setError(friendlyError(err)));
  }, []);

  return (
    <>
      <div className="page-head"><h1>Reviews</h1><p>Product and person reviews — flagged ones sort to the top</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Type</th><th>Rating</th><th>Fraud signals</th><th>Dispute</th><th>Posted</th></tr></thead>
          <tbody>
            {reviews.length === 0 && !error && <tr className="empty-row"><td colSpan={5}>No reviews yet</td></tr>}
            {reviews.map((r) => (
              <tr key={r.id} style={r.flagged ? { background: 'var(--danger-bg)' } : undefined}>
                <td>{r.type}</td>
                <td>{r.starRating ? '★'.repeat(r.starRating) : '—'}</td>
                <td>{r.fraudSignals.length > 0 ? r.fraudSignals.join(', ') : '—'}</td>
                <td>{r.disputeStatus === 'none' ? '—' : r.disputeStatus}</td>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
