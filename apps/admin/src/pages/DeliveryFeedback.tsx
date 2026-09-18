import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';

interface DeliveryFeedbackRow {
  id: string;
  conditionRating: string;
  comment: string | null;
  createdAt: string;
  order: { buyer: { fullName: string; username: string | null }; listing: { title: string } } | null;
}

const RATING_LABELS: Record<string, string> = {
  as_described: 'As described',
  slightly_different: 'Slightly different',
  not_as_described: 'Not as described'
};

const RATING_TONE: Record<string, string> = {
  as_described: 'ok',
  slightly_different: 'warn',
  not_as_described: 'danger'
};

export function DeliveryFeedback() {
  const [rows, setRows] = useState<DeliveryFeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/admin/delivery-feedback').then((res) => setRows(res.feedback)).catch((err) => setError(friendlyError(err)));
  }, []);

  return (
    <>
      <div className="page-head"><h1>Delivery feedback</h1><p>The immediate condition check buyers answer right after confirming delivery</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Buyer</th><th>Item</th><th>Condition</th><th>Comment</th><th>Sent</th></tr></thead>
          <tbody>
            {rows.length === 0 && !error && <tr className="empty-row"><td colSpan={5}>No delivery feedback yet</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.order?.buyer.username ?? r.order?.buyer.fullName ?? '—'}</td>
                <td>{r.order?.listing.title ?? '—'}</td>
                <td><span className={`pill ${RATING_TONE[r.conditionRating] ?? 'neutral'}`}>{RATING_LABELS[r.conditionRating] ?? r.conditionRating}</span></td>
                <td>{r.comment ?? '—'}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
