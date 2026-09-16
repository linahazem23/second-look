import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';

interface FeedbackRow {
  id: string;
  message: string;
  createdAt: string;
  user: { fullName: string; email: string } | null;
}

export function Feedback() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/admin/feedback').then((res) => setRows(res.feedback)).catch((err) => setError(friendlyError(err)));
  }, []);

  return (
    <>
      <div className="page-head"><h1>App feedback</h1><p>What members say about the app itself</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>From</th><th>Message</th><th>Sent</th></tr></thead>
          <tbody>
            {rows.length === 0 && !error && <tr className="empty-row"><td colSpan={3}>No feedback yet</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.user?.fullName ?? '—'}<div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{r.user?.email}</div></td>
                <td>{r.message}</td>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
