import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Icon } from '../Icon.js';

interface ThreadSummary {
  userId: string;
  userName: string;
  username: string | null;
  userEmail: string;
  lastMessage: { body: string; fromSupport: boolean; createdAt: string };
  needsReply: boolean;
}

interface Message {
  id: string;
  body: string;
  fromSupport: boolean;
  quickReplyKey: string | null;
  createdAt: string;
}

export function SupportInbox() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  function loadThreads() {
    api.get('/api/admin/support-threads').then((res) => setThreads(res.threads)).catch((err) => setError(friendlyError(err)));
  }

  useEffect(loadThreads, []);

  useEffect(() => {
    if (!selectedUserId) return;
    api.get(`/api/admin/support-threads/${selectedUserId}/messages`)
      .then((res) => setMessages(res.messages))
      .catch((err) => setError(friendlyError(err)));
  }, [selectedUserId]);

  async function sendReply() {
    if (!selectedUserId || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/admin/support-threads/${selectedUserId}/messages`, { body: draft.trim() });
      setDraft('');
      const res = await api.get(`/api/admin/support-threads/${selectedUserId}/messages`);
      setMessages(res.messages);
      loadThreads();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (selectedUserId) {
    const thread = threads.find((t) => t.userId === selectedUserId);
    return (
      <>
        <button className="back-link" onClick={() => setSelectedUserId(null)}><Icon name="back" size={14} /> Back to inbox</button>
        <div className="page-head">
          <h1>{thread?.userName ?? 'Conversation'}</h1>
          <p>{thread?.userEmail}{thread?.username ? ` · @${thread.username}` : ''}</p>
        </div>
        <div className="panel" style={{ padding: 16 }}>
          {messages.length === 0 && <p style={{ fontSize: 12.5, color: '#777' }}>No messages yet.</p>}
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: m.fromSupport ? 'flex-end' : 'flex-start',
                marginBottom: 8
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '8px 12px',
                  borderRadius: 10,
                  fontSize: 13,
                  background: m.fromSupport ? '#C6597A' : '#F6D9E3',
                  color: m.fromSupport ? '#fff' : '#37202A'
                }}
              >
                {m.body}
                <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>{new Date(m.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
        {error && <p className="login-err">{error}</p>}
        <div className="panel" style={{ padding: 16, display: 'flex', gap: 8 }}>
          <textarea
            rows={2}
            style={{ flex: 1, resize: 'vertical' }}
            placeholder="Reply as Second Look Support…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn solid" disabled={busy || !draft.trim()} onClick={sendReply}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head"><h1>Support inbox</h1><p>Messages from Second Look Support that a real person needs to answer</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>User</th><th>Email</th><th>Last message</th><th>Status</th></tr></thead>
          <tbody>
            {threads.length === 0 && !error && <tr className="empty-row"><td colSpan={4}>No support conversations yet</td></tr>}
            {threads.map((t) => (
              <tr className="clickable" key={t.userId} onClick={() => setSelectedUserId(t.userId)}>
                <td>{t.userName}</td>
                <td>{t.userEmail}</td>
                <td>{t.lastMessage.body.length > 60 ? `${t.lastMessage.body.slice(0, 60)}…` : t.lastMessage.body}</td>
                <td>{t.needsReply ? <span className="pill danger">Needs reply</span> : <span className="pill ok">Answered</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
