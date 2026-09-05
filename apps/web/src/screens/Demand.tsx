import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Icon } from '../Icon.js';

interface Comment {
  id: string;
  body: string;
  authorId: string;
}

interface DemandRequest {
  id: string;
  itemName: string;
  category: string;
  area: string;
  comments: Comment[];
  requester: { fullName: string };
  boosted: boolean;
}

export function Demand() {
  const [requests, setRequests] = useState<DemandRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openCommentFor, setOpenCommentFor] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [offered, setOffered] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/demand');
      setRequests(res.requests);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleIHaveIt(id: string) {
    setRowErrors((prev) => ({ ...prev, [id]: '' }));
    try {
      await api.post(`/api/demand/${id}/i-have-it`);
      setOffered((prev) => ({ ...prev, [id]: true }));
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [id]: friendlyError(err) }));
    }
  }

  async function handleSubmitComment(id: string) {
    if (!commentDraft.trim()) return;
    try {
      await api.post(`/api/demand/${id}/comments`, { body: commentDraft.trim() });
      setCommentDraft('');
      setOpenCommentFor(null);
      load();
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [id]: friendlyError(err) }));
    }
  }

  return (
    <>
      <div className="section-head">
        <h1>Open requests</h1>
        <p>People nearby are looking for these</p>
      </div>

      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && requests.length === 0 && <div className="empty-state">No open requests right now.</div>}

      {requests.map((d) => (
        <div className="plain-card" key={d.id}>
          <h3>{d.itemName} {d.boosted && <span className="match-badge">Boosted</span>}</h3>
          <div className="sub">{d.requester.fullName} in {d.area} is looking for this &middot; {d.category}</div>
          <div className="row">
            <button
              className={`btn-outline ${offered[d.id] ? 'done' : ''}`}
              disabled={offered[d.id]}
              onClick={() => handleIHaveIt(d.id)}
            >
              {offered[d.id] ? <>Offered <Icon name="check" size={12} /></> : 'I can sell it'}
            </button>
            <button className="btn-outline" onClick={() => setOpenCommentFor(openCommentFor === d.id ? null : d.id)}>
              Leave a comment
            </button>
          </div>
          {rowErrors[d.id] && <p className="field-error">{rowErrors[d.id]}</p>}
          {openCommentFor === d.id && (
            <>
              <textarea
                className="comment-box"
                rows={2}
                placeholder="Write a comment"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
              />
              <div className="row">
                <button className="btn-solid" onClick={() => handleSubmitComment(d.id)}>
                  <span className="shine" /><span className="label">Send</span>
                </button>
              </div>
            </>
          )}
          {d.comments.length > 0 && (
            <div className="comment-list">
              {d.comments.map((c) => <div className="c" key={c.id}>{c.body}</div>)}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
