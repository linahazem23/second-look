import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';

interface Submission {
  id: string;
  videoUrl: string;
  createdAt: string;
  user: { id: string; fullName: string; email: string; videoPromoGrantsUsed: number };
}

export function Growth() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get('/api/admin/video-submissions').then((res) => setSubmissions(res.submissions)).catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, []);

  async function approve(id: string) {
    try {
      await api.post(`/api/admin/video-submissions/${id}/approve`);
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function reject(id: string) {
    const reason = window.prompt('Reason for rejecting this video (shown to the member):');
    if (!reason) return;
    try {
      await api.post(`/api/admin/video-submissions/${id}/reject`, { reason });
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <>
      <div className="page-head"><h1>Growth: TikTok videos</h1><p>Each approval grants one free month of Second Look Plus — capped at 5 lifetime grants per member</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Member</th><th>Video</th><th>Lifetime grants used</th><th>Submitted</th><th></th></tr></thead>
          <tbody>
            {submissions.length === 0 && !error && <tr className="empty-row"><td colSpan={5}>Nothing pending review</td></tr>}
            {submissions.map((s) => (
              <tr key={s.id}>
                <td>{s.user.fullName}<div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{s.user.email}</div></td>
                <td><a href={s.videoUrl} target="_blank" rel="noreferrer">{s.videoUrl}</a></td>
                <td>{s.user.videoPromoGrantsUsed} / 5</td>
                <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                <td className="btn-row">
                  <button className="btn solid" onClick={() => approve(s.id)}>Approve</button>
                  <button className="btn ghost" onClick={() => reject(s.id)}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
