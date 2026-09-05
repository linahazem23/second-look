import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { useAuth } from '../AuthContext.js';
import { Icon } from '../Icon.js';
import { ProductReviewForm, PersonReviewForm } from './ReviewForms.js';

const DELIVERY_LABELS: Record<string, string> = {
  Meetup: 'Meetup',
  UberCourier: 'Uber Courier',
  InDrive: 'inDrive Delivery',
  BostaMylerz: 'Bosta / Mylerz'
};

interface OrderSummary {
  id: string;
  amount: number;
  deliveryMethod: string;
  escrowStatus: string;
  listing: { title: string; images: string[] };
  buyer: { id: string; fullName: string };
  seller: { id: string; fullName: string };
  chats: { messageText: string }[];
}

export function Chat({ initialOrderId, onOpenOrder }: { initialOrderId?: string | null; onOpenOrder?: () => void }) {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(initialOrderId ?? null);
  const [showSupport, setShowSupport] = useState(false);

  useEffect(() => {
    if (initialOrderId) setActiveOrderId(initialOrderId);
  }, [initialOrderId]);

  if (showSupport) {
    return <SupportThread onBack={() => setShowSupport(false)} />;
  }
  if (activeOrderId) {
    return <ChatThread orderId={activeOrderId} onBack={() => { setActiveOrderId(null); onOpenOrder?.(); }} />;
  }
  return <ChatList onOpen={setActiveOrderId} onOpenSupport={() => setShowSupport(true)} />;
}

function ChatList({ onOpen, onOpenSupport }: { onOpen: (id: string) => void; onOpenSupport: () => void }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/orders/mine')
      .then((res) => setOrders(res.orders))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="section-head">
        <h1>Chat</h1>
        <p>Order conversations</p>
      </div>
      <button className="thread-row" onClick={onOpenSupport}>
        <div className="avatar" style={{ background: 'var(--rose)', color: 'var(--white)' }}>SL</div>
        <div>
          <div className="t-name">Second Look Support</div>
          <div className="t-sub">Get help fast — quick answers or a real person</div>
        </div>
      </button>
      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && orders.length === 0 && (
        <div className="empty-state">No conversations yet — buy or sell something to start one.</div>
      )}
      {orders.map((o) => {
        const other = user?.id === o.buyer.id ? o.seller : o.buyer;
        return (
          <button key={o.id} className="thread-row" onClick={() => onOpen(o.id)}>
            <div className="avatar">{other.fullName.slice(0, 1)}</div>
            <div>
              <div className="t-name">{other.fullName} &middot; {o.listing.title}</div>
              <div className="t-sub">{o.chats[0]?.messageText ?? `Order started · ${o.amount} EGP`}</div>
            </div>
          </button>
        );
      })}
    </>
  );
}

interface FullOrder extends OrderSummary {
  deliveryConfirmed: boolean;
  reviewUnlockAt: string | null;
  trackingLinks: { id: string; url: string }[];
}

interface Message {
  id: string;
  messageText: string;
  senderId: string;
  autoFlagged: boolean;
  createdAt: string;
}

function ChatThread({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const { user } = useAuth();
  const [order, setOrder] = useState<FullOrder | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTrackingInput, setShowTrackingInput] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState('');
  const [showMonetizationPrompt, setShowMonetizationPrompt] = useState(false);

  async function loadAll() {
    try {
      const [orderRes, chatRes] = await Promise.all([
        api.get(`/api/orders/${orderId}`),
        api.get(`/api/chats/${orderId}/messages`)
      ]);
      setOrder(orderRes.order);
      setMessages(chatRes.messages);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await api.post(`/api/chats/${orderId}/messages`, { messageText: draft.trim() });
      setDraft('');
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function reportMessage(id: string) {
    try {
      await api.post(`/api/chats/messages/${id}/report`);
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function shareTrackingLink() {
    if (!trackingUrl.trim()) return;
    setBusy(true);
    try {
      await api.post(`/api/orders/${orderId}/tracking-link`, { url: trackingUrl.trim() });
      setTrackingUrl('');
      setShowTrackingInput(false);
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelivery() {
    setBusy(true);
    try {
      const res = await api.post(`/api/orders/${orderId}/confirm-delivery`);
      if (res.offerMonetizationChoice) setShowMonetizationPrompt(true);
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function chooseMonetizationMode(mode: 'commission' | 'seller_plus') {
    try {
      await api.post('/api/orders/monetization-mode', { mode });
      setShowMonetizationPrompt(false);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function raiseDispute() {
    setBusy(true);
    try {
      await api.post(`/api/orders/${orderId}/dispute`);
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <div className="empty-state">{error || 'Loading…'}</div>;

  const isBuyer = user?.id === order.buyer.id;
  const other = isBuyer ? order.seller : order.buyer;
  const reviewsUnlocked = order.escrowStatus === 'PaymentReleased' && order.reviewUnlockAt && new Date(order.reviewUnlockAt) <= new Date();

  return (
    <div id="chat-thread">
      <div className="thread-header">
        <button onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div>
          <div className="t-name">{other.fullName}</div>
          <div className="t-sub">{order.listing.title} &middot; {order.amount} EGP &middot; {DELIVERY_LABELS[order.deliveryMethod]}</div>
        </div>
      </div>
      <div className="mod-banner"><Icon name="flag" size={12} /> Conversations on Second Look may be reviewed for safety.</div>

      <div className="plain-card" style={{ margin: '10px 18px 0' }}>
        <div className="sub">Escrow status: <strong>{order.escrowStatus}</strong></div>
        {order.trackingLinks.length > 0 && (
          <div className="sub">Tracking: <a href={order.trackingLinks[0].url} target="_blank" rel="noreferrer">{order.trackingLinks[0].url}</a></div>
        )}
        <div className="row">
          {order.escrowStatus === 'InEscrow' && isBuyer && (
            <button className="btn-outline" disabled={busy} onClick={confirmDelivery}>Confirm delivery</button>
          )}
          {order.escrowStatus === 'InEscrow' && (
            <button className="btn-outline" disabled={busy} onClick={raiseDispute}>Report a problem</button>
          )}
          {order.deliveryMethod !== 'Meetup' && (
            <button className="btn-outline" onClick={() => setShowTrackingInput((v) => !v)}>Share tracking link</button>
          )}
        </div>
        {showTrackingInput && (
          <div className="row">
            <input
              style={{ flex: 1, border: '0.5px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}
              placeholder="https://…"
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
            />
            <button className="btn-solid" disabled={busy} onClick={shareTrackingLink}><span className="shine" /><span className="label">Save</span></button>
          </div>
        )}
      </div>

      {showMonetizationPrompt && (
        <div className="plain-card">
          <h3>You've hit 5 completed sales! 🎉</h3>
          <div className="sub">Choose how you'd like to sell going forward. You can change this later.</div>
          <div className="row">
            <button className="btn-outline" onClick={() => chooseMonetizationMode('commission')}>Stay on per-sale commission</button>
            <button className="btn-solid" onClick={() => chooseMonetizationMode('seller_plus')}>
              <span className="shine" /><span className="label">Try Seller Plus</span>
            </button>
          </div>
        </div>
      )}

      {reviewsUnlocked && (
        <>
          {isBuyer && <ProductReviewForm orderId={order.id} onDone={loadAll} />}
          <PersonReviewForm orderId={order.id} onDone={loadAll} />
        </>
      )}

      <div className="messages">
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.senderId === user?.id ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
            <div className={`bubble ${m.senderId === user?.id ? 'me' : 'them'}`}>{m.messageText}</div>
            {m.senderId !== user?.id && (
              <button style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--ink-faint)', padding: 0 }} onClick={() => reportMessage(m.id)}>
                Report
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <p className="field-error" style={{ margin: '0 16px' }}>{error}</p>}

      <form className="composer" onSubmit={sendMessage}>
        <input placeholder="Message…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="send-btn" disabled={busy}><Icon name="send" size={14} /></button>
      </form>
    </div>
  );
}

interface SupportMessage {
  id: string;
  body: string;
  fromSupport: boolean;
  createdAt: string;
}

function SupportThread({ onBack }: { onBack: () => void }) {
  const [quickReplies, setQuickReplies] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [qrRes, msgRes] = await Promise.all([
        api.get('/api/chats/support/quick-replies'),
        api.get('/api/chats/support/messages')
      ]);
      setQuickReplies(qrRes.quickReplies);
      setMessages(msgRes.messages);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function send(body: string, quickReplyKey?: string) {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api.post('/api/chats/support/messages', { body: body.trim(), quickReplyKey });
      setDraft('');
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="chat-thread">
      <div className="thread-header">
        <button onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div>
          <div className="t-name">Second Look Support</div>
          <div className="t-sub">Usually replies fast · pick a topic or type your own question</div>
        </div>
      </div>

      {Object.keys(quickReplies).length > 0 && (
        <div className="filter-chips" style={{ flexWrap: 'wrap' }}>
          {Object.entries(quickReplies).map(([key]) => (
            <button key={key} disabled={busy} onClick={() => send(QUICK_REPLY_TITLES[key] ?? key, key)}>
              {QUICK_REPLY_TITLES[key] ?? key}
            </button>
          ))}
        </div>
      )}

      <div className="messages">
        {messages.length === 0 && <div className="empty-state">Ask us anything — pick a topic above or type below.</div>}
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.fromSupport ? 'flex-start' : 'flex-end', maxWidth: '80%' }}>
            <div className={`bubble ${m.fromSupport ? 'them' : 'me'}`}>{m.body}</div>
          </div>
        ))}
      </div>

      {error && <p className="field-error" style={{ margin: '0 16px' }}>{error}</p>}

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <input placeholder="Type your question…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="send-btn" disabled={busy}><Icon name="send" size={14} /></button>
      </form>
    </div>
  );
}

const QUICK_REPLY_TITLES: Record<string, string> = {
  paid_after_sale: 'How do I get paid?',
  item_mismatch: "Item didn't match?",
  buy_only_restriction: 'What is buy-only restriction?',
  ship_without_meeting: 'Ship without meeting?',
  report_someone: 'Report someone'
};
