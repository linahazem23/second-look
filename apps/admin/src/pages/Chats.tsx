import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Icon } from '../Icon.js';

interface Thread {
  orderId: string;
  buyer: string;
  seller: string;
  deliveryMethod: string;
  hasTrackingLink: boolean;
  lastMessage: { messageText: string; autoFlagged: boolean } | null;
}

interface Message {
  id: string;
  senderId: string;
  messageText: string;
  autoFlagged: boolean;
  flaggedKeyword: string | null;
  reported: boolean;
  createdAt: string;
}

export function Chats() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [trackingLinks, setTrackingLinks] = useState<{ url: string }[]>([]);

  useEffect(() => {
    api.get('/api/admin/chats').then((res) => setThreads(res.threads)).catch((err) => setError(friendlyError(err)));
  }, []);

  useEffect(() => {
    if (!selectedOrderId) return;
    api.get(`/api/admin/chats/${selectedOrderId}`)
      .then((res) => { setMessages(res.messages); setTrackingLinks(res.trackingLinks); })
      .catch((err) => setError(friendlyError(err)));
  }, [selectedOrderId]);

  async function openCase() {
    if (!selectedOrderId) return;
    const reason = window.prompt('Reason for opening a moderation case from this chat:');
    if (!reason) return;
    const thread = threads.find((t) => t.orderId === selectedOrderId);
    try {
      await api.post(`/api/admin/chats/${selectedOrderId}/open-case`, { reviewedUserId: thread?.seller, reason });
      window.alert('Moderation case opened.');
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  if (selectedOrderId) {
    const thread = threads.find((t) => t.orderId === selectedOrderId);
    return (
      <>
        <button className="back-link" onClick={() => setSelectedOrderId(null)}><Icon name="back" size={14} /> Back to chats</button>
        <div className="page-head">
          <h1>{thread?.buyer} &amp; {thread?.seller}</h1>
          <p>Order {selectedOrderId.slice(0, 8)} &middot; {thread?.deliveryMethod}</p>
        </div>
        <div className="detail-grid">
          <div className="detail-card">
            <p className="sub-label">MESSAGES</p>
            {messages.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--ink-light)' }}>No messages yet.</p>}
            {messages.map((m) => (
              <div key={m.id} className={m.autoFlagged ? 'flagged-msg' : ''} style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 6, border: '0.5px solid var(--line)' }}>
                <div style={{ fontSize: 12.5 }}>{m.messageText}</div>
                {m.autoFlagged && <div className="flag-tag"><Icon name="flag" size={11} /> Auto-flagged: "{m.flaggedKeyword}"</div>}
                {m.reported && <div className="flag-tag">Reported by a participant</div>}
              </div>
            ))}
          </div>
          <div className="detail-card">
            <p className="sub-label">DELIVERY LINK ON FILE</p>
            {trackingLinks.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--ink-light)' }}>None shared yet.</p>}
            {trackingLinks.map((t, i) => <p key={i} style={{ fontSize: 12.5 }}><a href={t.url} target="_blank" rel="noreferrer">{t.url}</a></p>)}
            <div style={{ marginTop: 16 }}>
              <button className="btn outline" onClick={openCase}>Open a case from this chat</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head"><h1>Chats</h1><p>Every conversation is visible to your team by default, per the community guidelines users agree to</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Order</th><th>Between</th><th>Delivery method</th><th>Delivery link</th><th>Last message</th></tr></thead>
          <tbody>
            {threads.length === 0 && !error && <tr className="empty-row"><td colSpan={5}>No conversations yet</td></tr>}
            {threads.map((t) => (
              <tr className="clickable" key={t.orderId} onClick={() => setSelectedOrderId(t.orderId)}>
                <td>{t.orderId.slice(0, 8)}</td>
                <td>{t.buyer} &amp; {t.seller}</td>
                <td>{t.deliveryMethod}</td>
                <td>{t.hasTrackingLink ? <><Icon name="link" size={13} /> on file</> : '—'}</td>
                <td>
                  {t.lastMessage?.messageText ?? '—'}
                  {t.lastMessage?.autoFlagged && <span className="pill danger" style={{ marginLeft: 6 }}>Auto-flagged</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
