import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Icon } from '../Icon.js';
import { displayName } from '../identity.js';

const CATEGORIES = ['Skincare', 'Haircare', 'Makeup', 'Clothes', 'General'] as const;

interface Author {
  id: string;
  fullName: string;
  username?: string | null;
}

interface ThreadSummary {
  id: string;
  title: string;
  body: string;
  category: string | null;
  createdAt: string;
  author: Author;
  replyCount: number;
  watcherCount: number;
  iAmWatching: boolean;
}

interface Reply {
  id: string;
  body: string;
  createdAt: string;
  author: Author;
}

interface ThreadDetail extends Omit<ThreadSummary, 'replyCount'> {
  replies: Reply[];
}

export function Community() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.get('/api/community')
      .then((res) => setThreads(res.threads))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleWatch(id: string) {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, iAmWatching: !t.iAmWatching, watcherCount: t.watcherCount + (t.iAmWatching ? -1 : 1) } : t)));
    try {
      await api.post(`/api/community/${id}/watch`);
    } catch (err) {
      load();
      setError(friendlyError(err));
    }
  }

  if (openThreadId) {
    return <ThreadDetailView threadId={openThreadId} onBack={() => { setOpenThreadId(null); load(); }} />;
  }

  return (
    <>
      <div className="section-head">
        <h1>Community</h1>
        <p>Ask each other for tips, product advice, or where to find something</p>
      </div>

      <div className="post-btn-wrap">
        <button className="post-toggle" onClick={() => setShowForm((v) => !v)}>
          <Icon name="plus" size={16} /> {showForm ? 'Cancel' : 'New consultation'}
        </button>
      </div>

      {showForm && <NewThreadForm onPosted={() => { setShowForm(false); load(); }} />}

      {error && <p className="field-error" style={{ margin: '0 18px 10px' }}>{error}</p>}
      {loading && <div className="empty-state">Loading…</div>}
      {!loading && threads.length === 0 && <div className="empty-state">No consultations yet — be the first to ask something.</div>}

      {threads.map((t) => (
        <div className="plain-card" key={t.id}>
          <button
            style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}
            onClick={() => setOpenThreadId(t.id)}
          >
            <h3>{t.title} {t.category && <span className="match-badge" style={{ marginLeft: 6 }}>{t.category}</span>}</h3>
            <div className="sub" style={{ marginTop: 4 }}>{t.body.length > 140 ? `${t.body.slice(0, 140)}…` : t.body}</div>
            <div className="sub" style={{ marginTop: 6 }}>
              {displayName(t.author)} &middot; {t.replyCount} repl{t.replyCount === 1 ? 'y' : 'ies'}
            </div>
          </button>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className={`notify-btn ${t.iAmWatching ? 'active' : ''}`}
              aria-label={t.iAmWatching ? 'Stop notifying me' : 'Notify me about replies'}
              onClick={() => toggleWatch(t.id)}
            >
              +1
            </button>
            <span className="sub" style={{ alignSelf: 'center' }}>{t.watcherCount} watching</span>
          </div>
        </div>
      ))}
    </>
  );
}

function NewThreadForm({ onPosted }: { onPosted: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string>('General');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/community', { title: title.trim(), body: body.trim(), category });
      onPosted();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="post-form" onSubmit={handleSubmit}>
      <label>What do you want to ask?</label>
      <input required placeholder="e.g. Best toner for oily skin?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />

      <label>Category</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <label>Details</label>
      <textarea required rows={4} placeholder="Give people enough to actually help you" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />

      {error && <p className="field-error">{error}</p>}

      <div className="form-row">
        <button type="submit" className="btn-solid" disabled={busy}>
          <span className="shine" /><span className="label">{busy ? 'Posting…' : 'Post'}</span>
        </button>
      </div>
    </form>
  );
}

function ThreadDetailView({ threadId, onBack }: { threadId: string; onBack: () => void }) {
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get(`/api/community/${threadId}`)
      .then((res) => setThread(res.thread))
      .catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, [threadId]);

  async function toggleWatch() {
    if (!thread) return;
    setThread({ ...thread, iAmWatching: !thread.iAmWatching, watcherCount: thread.watcherCount + (thread.iAmWatching ? -1 : 1) });
    try {
      await api.post(`/api/community/${threadId}/watch`);
    } catch (err) {
      load();
      setError(friendlyError(err));
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/community/${threadId}/replies`, { body: draft.trim() });
      setDraft('');
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="empty-state">{error}</div>;
  if (!thread) return <div className="empty-state">Loading…</div>;

  return (
    <>
      <div className="section-head">
        <button className="back-btn" onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div><h1 style={{ fontSize: 19 }}>{thread.title}</h1></div>
      </div>

      <div className="plain-card">
        {thread.category && <span className="match-badge">{thread.category}</span>}
        <div className="sub" style={{ marginTop: 6 }}>{displayName(thread.author)}</div>
        <p style={{ fontSize: 13.5, marginTop: 8 }}>{thread.body}</p>
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className={`notify-btn ${thread.iAmWatching ? 'active' : ''}`}
            aria-label={thread.iAmWatching ? 'Stop notifying me' : 'Notify me about replies'}
            onClick={toggleWatch}
          >
            +1
          </button>
          <span className="sub" style={{ alignSelf: 'center' }}>{thread.watcherCount} watching &middot; tap to get emailed on new replies</span>
        </div>
      </div>

      <div className="stitch" />
      <div className="section-head" style={{ padding: '0 18px 4px' }}>
        <h1 style={{ fontSize: 15 }}>{thread.replies.length} repl{thread.replies.length === 1 ? 'y' : 'ies'}</h1>
      </div>

      {thread.replies.length === 0 && <div className="empty-state">No replies yet — be the first to help.</div>}
      {thread.replies.map((r) => (
        <div className="plain-card" key={r.id}>
          <div className="sub">{displayName(r.author)}</div>
          <p style={{ fontSize: 13.5, marginTop: 6 }}>{r.body}</p>
        </div>
      ))}

      <form className="post-form" onSubmit={sendReply}>
        <label>Add a reply</label>
        <textarea rows={2} placeholder="Share what worked for you" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} />
        <div className="form-row">
          <button type="submit" className="btn-solid" disabled={busy || !draft.trim()}>
            <span className="shine" /><span className="label">{busy ? 'Sending…' : 'Reply'}</span>
          </button>
        </div>
      </form>
    </>
  );
}
