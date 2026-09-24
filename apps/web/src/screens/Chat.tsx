import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { useAuth } from '../AuthContext.js';
import { Icon } from '../Icon.js';
import { ProductReviewForm, PersonReviewForm } from './ReviewForms.js';
import { uploadFile } from '../ImageUpload.js';
import { displayName } from '../identity.js';
import { DeliveryFeedbackModal } from './DeliveryFeedbackModal.js';
import { Avatar } from '../Avatar.js';

const ORDER_STATUS_LABELS: Record<string, string> = {
  AwaitingDeliveryMethod: 'Choose a delivery method',
  AwaitingPayment: 'Waiting for payment',
  InEscrow: 'Payment held safely',
  PaymentFailed: 'Payment failed',
  PaymentReleased: 'Payment released to seller',
  Disputed: 'Under review',
  Expired: 'Offer expired'
};

function timeRemaining(holdExpiresAt: string | null): string | null {
  if (!holdExpiresAt) return null;
  const ms = new Date(holdExpiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

const DELIVERY_LABELS: Record<string, string> = {
  Meetup: 'Meetup',
  UberCourier: 'Uber Courier',
  InDrive: 'inDrive Delivery',
  BostaMylerz: 'Bosta / Mylerz'
};

const DELIVERY_METHODS = [
  { value: 'Meetup', label: 'Meetup', note: 'Arrange to meet in your shared area' },
  { value: 'UberCourier', label: 'Uber Courier', note: 'Book directly with Uber, share the tracking link in chat' },
  { value: 'InDrive', label: 'inDrive Delivery', note: 'Book directly with inDrive, share the tracking link in chat' }
];

// Not real participants — sentinel senderIds the server uses for the auto tips
// message and for a real admin joining a conversation after an SOS.
const SYSTEM_SENDER_ID = 'system';
const ADMIN_SENDER_ID = 'admin';

function SystemMessageRow({ text, fromAdmin }: { text: string; fromAdmin?: boolean }) {
  return (
    <div style={{ alignSelf: 'center', maxWidth: '90%', textAlign: 'center', margin: '4px 0' }}>
      {fromAdmin && <div className="sub" style={{ fontSize: 10.5, marginBottom: 2 }}>Second Look Support</div>}
      <div className="bubble" style={{ background: fromAdmin ? 'var(--rose-soft)' : 'var(--card-alt)', color: 'var(--ink)', fontSize: 12.5 }}>
        {text}
      </div>
    </div>
  );
}

interface OrderSummary {
  id: string;
  amount: number;
  buyerProtectionFee: number;
  deliveryMethod: string | null;
  escrowStatus: string;
  holdExpiresAt: string | null;
  listing: { title: string; price: number; images: string[] };
  buyer: { id: string; fullName: string; username?: string | null; avatarUrl: string | null; avatarPreset: string | null };
  seller: { id: string; fullName: string; username?: string | null; avatarUrl: string | null; avatarPreset: string | null };
  chats: { messageText: string }[];
  unread: boolean;
}

interface InquirySummary {
  id: string;
  listing: { title: string; images: string[] };
  buyer: { id: string; fullName: string; username?: string | null };
  seller: { id: string; fullName: string; username?: string | null };
  messages: { messageText: string }[];
  unread: boolean;
}

export function Chat({
  initialOrderId,
  initialInquiryId,
  initialSupport,
  onOpenOrder,
  onOpenInquiry,
  onOpenSupport: onLeaveSupport
}: {
  initialOrderId?: string | null;
  initialInquiryId?: string | null;
  initialSupport?: boolean;
  onOpenOrder?: () => void;
  onOpenInquiry?: () => void;
  onOpenSupport?: () => void;
}) {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(initialOrderId ?? null);
  const [activeInquiryId, setActiveInquiryId] = useState<string | null>(initialInquiryId ?? null);
  const [showSupport, setShowSupport] = useState(Boolean(initialSupport));

  useEffect(() => {
    if (initialOrderId) setActiveOrderId(initialOrderId);
  }, [initialOrderId]);

  useEffect(() => {
    if (initialInquiryId) setActiveInquiryId(initialInquiryId);
  }, [initialInquiryId]);

  useEffect(() => {
    if (initialSupport) setShowSupport(true);
  }, [initialSupport]);

  if (showSupport) {
    return <SupportThread onBack={() => { setShowSupport(false); onLeaveSupport?.(); }} />;
  }
  if (activeOrderId) {
    return <ChatThread orderId={activeOrderId} onBack={() => { setActiveOrderId(null); onOpenOrder?.(); }} />;
  }
  if (activeInquiryId) {
    return (
      <InquiryThread
        inquiryId={activeInquiryId}
        onBack={() => { setActiveInquiryId(null); onOpenInquiry?.(); }}
        onOrderReady={(orderId) => { setActiveInquiryId(null); setActiveOrderId(orderId); }}
      />
    );
  }
  return <ChatList onOpen={setActiveOrderId} onOpenInquiry={setActiveInquiryId} onOpenSupport={() => setShowSupport(true)} />;
}

function ChatList({
  onOpen,
  onOpenInquiry,
  onOpenSupport
}: {
  onOpen: (id: string) => void;
  onOpenInquiry: (id: string) => void;
  onOpenSupport: () => void;
}) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [inquiries, setInquiries] = useState<InquirySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get('/api/orders/mine'), api.get('/api/inquiries/mine')])
      .then(([ordersRes, inquiriesRes]) => { setOrders(ordersRes.orders); setInquiries(inquiriesRes.inquiries); })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="section-head">
        <h1>Chat</h1>
        <p>Questions and order conversations</p>
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
      {!loading && !error && orders.length === 0 && inquiries.length === 0 && (
        <div className="empty-state">No conversations yet — message a seller or buy something to start one.</div>
      )}
      {inquiries.map((i) => {
        const other = user?.id === i.buyer.id ? i.seller : i.buyer;
        return (
          <button key={i.id} className="thread-row" onClick={() => onOpenInquiry(i.id)}>
            <div className="avatar">{displayName(other).slice(0, 1)}</div>
            <div>
              <div className="t-name">{displayName(other)} &middot; {i.listing.title} {i.unread && <span className="unread-dot" />}</div>
              <div className="t-sub">{i.messages[0]?.messageText ?? 'Question about this listing'}</div>
            </div>
          </button>
        );
      })}
      {orders.map((o) => {
        const other = user?.id === o.buyer.id ? o.seller : o.buyer;
        return (
          <button key={o.id} className="thread-row" onClick={() => onOpen(o.id)}>
            <div className="avatar">{displayName(other).slice(0, 1)}</div>
            <div>
              <div className="t-name">{displayName(other)} &middot; {o.listing.title} {o.unread && <span className="unread-dot" />}</div>
              <div className="t-sub">{o.chats[0]?.messageText ?? `Order started · ${o.amount} EGP`}</div>
            </div>
          </button>
        );
      })}
    </>
  );
}

interface InquiryFull {
  id: string;
  buyerId: string;
  sellerId: string;
  listing: { id: string; title: string; price: number; originalPrice: number; allowOffers: boolean; status: string };
  buyer: { id: string; fullName: string; username?: string | null };
  seller: { id: string; fullName: string; username?: string | null };
  offerAmount: number | null;
  offerStatus: 'pending' | 'declined' | 'accepted' | null;
  offerByUserId: string | null;
}

function InquiryThread({ inquiryId, onBack, onOrderReady }: { inquiryId: string; onBack: () => void; onOrderReady?: (orderId: string) => void }) {
  const { user } = useAuth();
  const [inquiry, setInquiry] = useState<InquiryFull | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [offerDraft, setOfferDraft] = useState('');
  const [offerBusy, setOfferBusy] = useState(false);
  const [showOfferInput, setShowOfferInput] = useState(false);
  const [buying, setBuying] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [deliveryBusy, setDeliveryBusy] = useState(false);

  async function loadAll() {
    try {
      const [inquiryRes, msgRes] = await Promise.all([
        api.get(`/api/inquiries/${inquiryId}`),
        api.get(`/api/inquiries/${inquiryId}/messages`)
      ]);
      setInquiry(inquiryRes.inquiry);
      setMessages(msgRes.messages);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  useEffect(() => {
    loadAll();
    api.post(`/api/inquiries/${inquiryId}/mark-read`).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await api.post(`/api/inquiries/${inquiryId}/messages`, { messageText: draft.trim() });
      setDraft('');
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendAttachment(file: File) {
    setAttaching(true);
    setError(null);
    try {
      const url = await uploadFile(file);
      const attachmentType = file.type.startsWith('video/') ? 'video' : 'image';
      await api.post(`/api/inquiries/${inquiryId}/messages`, { attachmentUrl: url, attachmentType });
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setAttaching(false);
    }
  }

  async function reportMessage(id: string) {
    try {
      await api.post(`/api/inquiries/messages/${id}/report`);
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function sendOffer(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(offerDraft);
    if (!amount || amount <= 0) return;
    setOfferBusy(true);
    setError(null);
    try {
      await api.post(`/api/inquiries/${inquiryId}/offer`, { amount });
      setOfferDraft('');
      setShowOfferInput(false);
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setOfferBusy(false);
    }
  }

  async function buyNow() {
    if (!inquiry) return;
    setBuying(true);
    setError(null);
    try {
      const res = await api.post('/api/orders', { listingId: inquiry.listing.id });
      onOrderReady?.(res.order.id);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBuying(false);
    }
  }

  async function suggestDelivery(label: string) {
    setDeliveryBusy(true);
    setError(null);
    try {
      await api.post(`/api/inquiries/${inquiryId}/messages`, { messageText: `📦 I suggest: ${label}` });
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setDeliveryBusy(false);
    }
  }

  async function callSos() {
    if (!window.confirm("This brings a real Second Look team member into this chat to help sort things out. Continue?")) return;
    setSosBusy(true);
    setError(null);
    try {
      await api.post(`/api/inquiries/${inquiryId}/sos`);
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSosBusy(false);
    }
  }

  async function respondToOffer(action: 'accept' | 'decline') {
    setOfferBusy(true);
    setError(null);
    try {
      const res = await api.post(`/api/inquiries/${inquiryId}/offer/respond`, { action });
      if (action === 'accept' && res.orderId) {
        onOrderReady?.(res.orderId);
        return;
      }
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setOfferBusy(false);
    }
  }

  if (!inquiry) return <div className="empty-state">{error || 'Loading…'}</div>;

  const other = user?.id === inquiry.buyer.id ? inquiry.seller : inquiry.buyer;
  const hasStartedChatting = messages.some((m) => m.senderId !== SYSTEM_SENDER_ID && m.senderId !== ADMIN_SENDER_ID);
  const canBuy = inquiry.listing.status === 'Active' && inquiry.offerStatus !== 'accepted';

  return (
    <div id="chat-thread">
      <div className="thread-header">
        <button onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div>
          <div className="t-name">{displayName(other)}</div>
          <div className="t-sub">{inquiry.listing.title} &middot; {inquiry.listing.price} EGP &middot; Question</div>
        </div>
        <button className="sos-btn" disabled={sosBusy} onClick={callSos}>SOS</button>
      </div>
      <div className="mod-banner"><Icon name="flag" size={12} /> Conversations on Second Look may be reviewed for safety.</div>

      {canBuy && (
        <div className="plain-card" style={{ margin: '10px 16px 0' }}>
          <button className="btn-solid" style={{ width: '100%' }} disabled={buying} onClick={buyNow}>
            <span className="shine" /><span className="label">{buying ? 'Starting…' : `Buy now — ${inquiry.listing.price} EGP`}</span>
          </button>
        </div>
      )}

      {hasStartedChatting && canBuy && (
        <div className="plain-card" style={{ margin: '10px 16px 0' }}>
          <div className="sub">How will this item get to her?</div>
          <div className="delivery-pills" style={{ marginTop: 8 }}>
            {DELIVERY_METHODS.map((m) => (
              <button key={m.value} type="button" className="delivery-pill" disabled={deliveryBusy} onClick={() => suggestDelivery(m.label)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="messages">
        {messages.map((m) =>
          m.senderId === SYSTEM_SENDER_ID || m.senderId === ADMIN_SENDER_ID ? (
            <SystemMessageRow key={m.id} text={m.messageText} fromAdmin={m.senderId === ADMIN_SENDER_ID} />
          ) : (
            <div key={m.id} style={{ alignSelf: m.senderId === user?.id ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              {m.attachmentUrl && (
                <div className={`bubble attachment ${m.senderId === user?.id ? 'me' : 'them'}`}>
                  {m.attachmentType === 'video' ? <video src={m.attachmentUrl} controls /> : <img src={m.attachmentUrl} alt="Attachment" />}
                </div>
              )}
              {m.messageText && (
                <div className={`bubble ${m.senderId === user?.id ? 'me' : 'them'}`}>{m.messageText}</div>
              )}
              {m.senderId !== user?.id && (
                <button style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--ink-faint)', padding: 0 }} onClick={() => reportMessage(m.id)}>
                  Report
                </button>
              )}
            </div>
          )
        )}
      </div>

      {inquiry.listing.allowOffers && inquiry.listing.status === 'Active' && (
        <div className="plain-card" style={{ margin: '0 16px 10px' }}>
          {inquiry.offerStatus === 'accepted' ? (
            <div className="sub">Offer accepted at {inquiry.offerAmount} EGP — check your Chat list for the order.</div>
          ) : inquiry.offerStatus === 'pending' ? (
            inquiry.offerByUserId === user?.id ? (
              <div className="sub">Waiting on a response to your offer of <strong>{inquiry.offerAmount} EGP</strong>.</div>
            ) : (
              <>
                <div className="sub">Offered <strong>{inquiry.offerAmount} EGP</strong> (listed at {inquiry.listing.price} EGP)</div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn-solid" disabled={offerBusy} onClick={() => respondToOffer('accept')}>
                    <span className="shine" /><span className="label">Accept</span>
                  </button>
                  <button className="btn-outline" disabled={offerBusy} onClick={() => respondToOffer('decline')}>Decline</button>
                </div>
              </>
            )
          ) : showOfferInput ? (
            <form className="row" onSubmit={sendOffer} style={{ marginTop: 0 }}>
              <input
                type="number"
                min={1}
                placeholder={`Less than ${inquiry.listing.price} EGP`}
                value={offerDraft}
                onChange={(e) => setOfferDraft(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-solid" disabled={offerBusy || !offerDraft}>
                <span className="shine" /><span className="label">Send</span>
              </button>
              <button type="button" className="btn-cancel" onClick={() => setShowOfferInput(false)}>Cancel</button>
            </form>
          ) : (
            <button className="btn-outline" onClick={() => setShowOfferInput(true)}>Make an offer</button>
          )}
        </div>
      )}

      {error && <p className="field-error" style={{ margin: '0 16px' }}>{error}</p>}

      <form className="composer" onSubmit={sendMessage}>
        <label className="attach-btn">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
            style={{ display: 'none' }}
            disabled={attaching}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) sendAttachment(file);
              e.target.value = '';
            }}
          />
          <Icon name="attach" size={16} />
        </label>
        <input placeholder={attaching ? 'Sending attachment…' : 'Ask a question…'} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={attaching} />
        <button type="submit" className="send-btn" disabled={busy || attaching}><Icon name="send" size={14} /></button>
      </form>
    </div>
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
  attachmentUrl?: string | null;
  attachmentType?: string | null;
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
  const [attaching, setAttaching] = useState(false);
  const [showTrackingInput, setShowTrackingInput] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState('');
  const [showMonetizationPrompt, setShowMonetizationPrompt] = useState(false);
  const [showDeliveryFeedback, setShowDeliveryFeedback] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);

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
    api.post(`/api/chats/${orderId}/mark-read`).catch(() => {});
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

  async function sendAttachment(file: File) {
    setAttaching(true);
    setError(null);
    try {
      const url = await uploadFile(file);
      const attachmentType = file.type.startsWith('video/') ? 'video' : 'image';
      await api.post(`/api/chats/${orderId}/messages`, { attachmentUrl: url, attachmentType });
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setAttaching(false);
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
      setShowDeliveryFeedback(true);
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

  async function callSos() {
    if (!window.confirm("This brings a real Second Look team member into this chat to help sort things out. Continue?")) return;
    setSosBusy(true);
    setError(null);
    try {
      await api.post(`/api/orders/${orderId}/sos`);
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSosBusy(false);
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

  async function chooseDeliveryMethod(deliveryMethod: string) {
    setBusy(true);
    try {
      await api.post(`/api/orders/${orderId}/delivery-method`, { deliveryMethod });
      loadAll();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function payNow() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(`/api/orders/${orderId}/pay`);
      window.open(res.iframeUrl, '_blank');
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
        <Avatar user={other} size={32} />
        <div>
          <div className="t-name">{displayName(other)}</div>
          <div className="t-sub">
            {order.listing.title} &middot; {order.amount} EGP
            {order.deliveryMethod && <> &middot; {DELIVERY_LABELS[order.deliveryMethod]}</>}
          </div>
        </div>
        <button className="sos-btn" disabled={sosBusy} onClick={callSos}>SOS</button>
      </div>
      <div className="mod-banner"><Icon name="flag" size={12} /> Conversations on Second Look may be reviewed for safety.</div>

      {order.escrowStatus === 'AwaitingDeliveryMethod' || (order.escrowStatus === 'InEscrow' && !order.deliveryMethod) ? (
        <div className="plain-card" style={{ margin: '10px 18px 0' }}>
          <div className="sub">How will this item get to you?</div>
          <div className="delivery-pills" style={{ marginTop: 8 }}>
            {DELIVERY_METHODS.map((m) => (
              <button key={m.value} type="button" className="delivery-pill" disabled={busy} onClick={() => chooseDeliveryMethod(m.value)}>
                {m.label}
              </button>
            ))}
          </div>
          {timeRemaining(order.holdExpiresAt) && (
            <div className="sub" style={{ marginTop: 8, fontSize: 11.5 }}>
              Choose within {timeRemaining(order.holdExpiresAt)} or this reservation expires and the listing goes back on the marketplace.
            </div>
          )}
        </div>
      ) : order.escrowStatus === 'AwaitingPayment' ? (
        <div className="plain-card" style={{ margin: '10px 18px 0' }}>
          {isBuyer ? (
            <>
              <div className="sub">Item price</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span>{order.listing.title}</span><span>{order.listing.price} EGP</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginTop: 4 }}>
                <span>Buyer protection fee ({Math.round((order.buyerProtectionFee / order.listing.price) * 100)}%)</span><span>{order.buyerProtectionFee} EGP</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line)' }}>
                <span>Total due</span><span>{order.amount} EGP</span>
              </div>
              <div className="sub" style={{ marginTop: 6, fontSize: 11.5 }}>
                The protection fee funds identity verification, held payment, and moderation — the seller receives the full {order.listing.price} EGP item price.
              </div>
              <div className="sub" style={{ marginTop: 6, fontSize: 11.5 }}>
                Second Look holds this payment — not the seller. She's only paid once you confirm delivery, so there's always a neutral third party if something goes wrong.
              </div>
            </>
          ) : (
            <div className="sub">Waiting on the buyer's payment — you'll receive {order.listing.price} EGP for this item once it's confirmed delivered.</div>
          )}
          {timeRemaining(order.holdExpiresAt) && (
            <div className="sub" style={{ marginTop: 6, fontSize: 11.5 }}>
              {isBuyer ? 'Pay' : 'They have'} within {timeRemaining(order.holdExpiresAt)} or this reservation expires and the listing goes back on the marketplace.
            </div>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            {isBuyer ? (
              <button className="btn-solid" disabled={busy} onClick={payNow}>
                <span className="shine" /><span className="label">{busy ? 'Opening payment…' : 'Pay now'}</span>
              </button>
            ) : (
              <span className="sub">Waiting for the buyer to complete payment.</span>
            )}
          </div>
        </div>
      ) : order.escrowStatus === 'PaymentFailed' ? (
        <div className="plain-card" style={{ margin: '10px 18px 0' }}>
          <div className="sub">Payment didn't go through, so this order didn't proceed. The listing is active again.</div>
        </div>
      ) : order.escrowStatus === 'Expired' ? (
        <div className="plain-card" style={{ margin: '10px 18px 0' }}>
          <div className="sub">This reservation expired before a delivery method (and payment, if needed) was completed in time. The listing is active again.</div>
        </div>
      ) : (
      <div className="plain-card" style={{ margin: '10px 18px 0' }}>
        <div className="sub">
          Order status: <strong>
            {order.escrowStatus === 'InEscrow' && order.deliveryMethod === 'Meetup'
              ? 'Meetup arranged'
              : ORDER_STATUS_LABELS[order.escrowStatus] ?? order.escrowStatus}
          </strong>
        </div>
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
      )}

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

      {showDeliveryFeedback && (
        <DeliveryFeedbackModal orderId={order.id} onClose={() => setShowDeliveryFeedback(false)} />
      )}

      <div className="messages">
        {messages.map((m) =>
          m.senderId === SYSTEM_SENDER_ID || m.senderId === ADMIN_SENDER_ID ? (
            <SystemMessageRow key={m.id} text={m.messageText} fromAdmin={m.senderId === ADMIN_SENDER_ID} />
          ) : (
            <div key={m.id} style={{ alignSelf: m.senderId === user?.id ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              {m.attachmentUrl && (
                <div className={`bubble attachment ${m.senderId === user?.id ? 'me' : 'them'}`}>
                  {m.attachmentType === 'video' ? (
                    <video src={m.attachmentUrl} controls />
                  ) : (
                    <img src={m.attachmentUrl} alt="Attachment" />
                  )}
                </div>
              )}
              {m.messageText && (
                <div className={`bubble ${m.senderId === user?.id ? 'me' : 'them'}`}>{m.messageText}</div>
              )}
              {m.senderId !== user?.id && (
                <button style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--ink-faint)', padding: 0 }} onClick={() => reportMessage(m.id)}>
                  Report
                </button>
              )}
            </div>
          )
        )}
      </div>

      {error && <p className="field-error" style={{ margin: '0 16px' }}>{error}</p>}

      <form className="composer" onSubmit={sendMessage}>
        <label className="attach-btn">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
            style={{ display: 'none' }}
            disabled={attaching}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) sendAttachment(file);
              e.target.value = '';
            }}
          />
          <Icon name="attach" size={16} />
        </label>
        <input placeholder={attaching ? 'Sending attachment…' : 'Message…'} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={attaching} />
        <button type="submit" className="send-btn" disabled={busy || attaching}><Icon name="send" size={14} /></button>
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
