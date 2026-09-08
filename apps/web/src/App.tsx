import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './AuthContext.js';
import { Auth } from './screens/Auth.js';
import { KycGate, ProfileQuizGate, GuidelinesGate } from './screens/Onboarding.js';
import { PublicProfile } from './screens/PublicProfile.js';
import { Home } from './screens/Home.js';
import { Want } from './screens/Want.js';
import { Demand } from './screens/Demand.js';
import { Explore } from './screens/Explore.js';
import { Chat } from './screens/Chat.js';
import { Reviews } from './screens/Reviews.js';
import { Profile } from './screens/Profile.js';
import { Icon } from './Icon.js';

type Tab = 'home' | 'want' | 'demand' | 'explore' | 'chat';
type MenuView = 'reviews' | 'profile' | 'guidelines' | null;

export function App() {
  const { user, loading, logout, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [pendingInquiryId, setPendingInquiryId] = useState<string | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [hasUnreadChats, setHasUnreadChats] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    function poll() {
      Promise.all([api.get('/api/orders/mine'), api.get('/api/inquiries/mine')])
        .then(([ordersRes, inquiriesRes]) => {
          if (cancelled) return;
          const anyUnread =
            ordersRes.orders.some((o: { unread: boolean }) => o.unread) ||
            inquiriesRes.inquiries.some((i: { unread: boolean }) => i.unread);
          setHasUnreadChats(anyUnread);
        })
        .catch(() => {});
    }
    poll();
    const interval = setInterval(poll, 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user, tab]);

  if (loading) {
    return (
      <div id="phone">
        <div className="spinner-wrap">Loading Second Look…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div id="phone">
        <Auth />
      </div>
    );
  }

  // A blocked account still gets an explicit, honest screen — not a silent logout
  // and not the normal feed as if nothing happened. It still gets to finish any
  // order it already had in progress (the API exempts that), just nothing new.
  if (user.status === 'Blocked') {
    return (
      <div id="phone">
        <BlockedNotice blockedUntil={user.blockedUntil} onLogout={logout} />
      </div>
    );
  }

  // KYC and community guidelines are gates, not steps in the signup form itself —
  // a returning user who never finished either lands right back here, every load.
  if (user.kycStatus === 'pending' || user.kycStatus === 'rejected') {
    return (
      <div id="phone">
        <KycGate onDone={refresh} />
      </div>
    );
  }

  if (!user.profileQuizComplete) {
    return (
      <div id="phone">
        <ProfileQuizGate onDone={refresh} />
      </div>
    );
  }

  if (!user.guidelinesComplete) {
    return (
      <div id="phone">
        <GuidelinesGate onDone={refresh} />
      </div>
    );
  }

  function goToOrder(orderId: string) {
    setPendingOrderId(orderId);
    setTab('chat');
  }

  function goToInquiry(inquiryId: string) {
    setPendingInquiryId(inquiryId);
    setTab('chat');
  }

  return (
    <div id="phone">
      <header className="topbar">
        <span className="logo">Second Look</span>
        <button className="menu-btn" onClick={() => setMenuOpen(true)}>
          <Icon name="menu" size={18} />
        </button>
      </header>

      <main className="content">
        {viewingProfileId ? (
          <PublicProfile userId={viewingProfileId} onBack={() => setViewingProfileId(null)} />
        ) : (
          <>
        {menuView === 'reviews' && <Reviews onBack={() => setMenuView(null)} />}
        {menuView === 'profile' && <Profile onBack={() => setMenuView(null)} />}
        {menuView === 'guidelines' && <GuidelinesView onBack={() => setMenuView(null)} />}

        {menuView === null && (
          <>
            {tab === 'home' && <Home onOrderCreated={goToOrder} onMessageSeller={goToInquiry} onViewProfile={setViewingProfileId} />}
            {tab === 'want' && <Want />}
            {tab === 'demand' && <Demand />}
            {tab === 'explore' && <Explore />}
            {tab === 'chat' && (
              <Chat
                initialOrderId={pendingOrderId}
                initialInquiryId={pendingInquiryId}
                onOpenOrder={() => setPendingOrderId(null)}
                onOpenInquiry={() => setPendingInquiryId(null)}
              />
            )}
          </>
        )}
          </>
        )}
      </main>

      <nav className="bottom-nav">
        <button className={tab === 'home' && !menuView ? 'active' : ''} onClick={() => { setTab('home'); setMenuView(null); }}>
          <Icon name="home" /><span>Home</span>
        </button>
        <button className={tab === 'want' && !menuView ? 'active' : ''} onClick={() => { setTab('want'); setMenuView(null); }}>
          <Icon name="want" /><span>Want</span>
        </button>
        <button className={tab === 'demand' && !menuView ? 'active' : ''} onClick={() => { setTab('demand'); setMenuView(null); }}>
          <Icon name="demand" /><span>Demand</span>
        </button>
        <button className={tab === 'explore' && !menuView ? 'active' : ''} onClick={() => { setTab('explore'); setMenuView(null); }}>
          <Icon name="explore" /><span>Explore</span>
        </button>
        <button className={tab === 'chat' && !menuView ? 'active' : ''} onClick={() => { setTab('chat'); setMenuView(null); }}>
          <Icon name="chat" /><span>Chat</span>
          {hasUnreadChats && <span className="nav-badge" />}
        </button>
      </nav>

      <div id="side-menu" className={menuOpen ? 'open' : ''}>
        <div className="panel">
          <button className="close-x" onClick={() => setMenuOpen(false)}>
            <Icon name="close" size={16} />
          </button>
          <h2>Menu</h2>
          <button className="item" onClick={() => { setMenuView('reviews'); setMenuOpen(false); }}>Reviews</button>
          <button className="item" onClick={() => { setMenuView('profile'); setMenuOpen(false); }}>My profile</button>
          <button className="item" onClick={() => { setMenuView('guidelines'); setMenuOpen(false); }}>Community guidelines</button>
          <button className="item" onClick={logout}>Log out</button>
        </div>
      </div>
    </div>
  );
}

function BlockedNotice({ blockedUntil, onLogout }: { blockedUntil: string | null; onLogout: () => void }) {
  const [showOrders, setShowOrders] = useState(false);

  if (showOrders) {
    return (
      <>
        <header className="topbar">
          <span className="logo">Second Look</span>
        </header>
        <main className="content">
          <div className="section-head">
            <button className="back-btn" onClick={() => setShowOrders(false)}><Icon name="arrowLeft" size={18} /></button>
            <div><h1 style={{ fontSize: 19 }}>Your orders</h1><p>You can still finish anything already in progress</p></div>
          </div>
          <Chat />
        </main>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <span className="logo">Second Look</span>
      </header>
      <main className="content">
        <div className="section-head">
          <h1>Account blocked</h1>
          <p>
            {blockedUntil
              ? `Your account is blocked until ${new Date(blockedUntil).toLocaleDateString()}.`
              : 'Your account has been permanently blocked.'}
          </p>
        </div>
        <div className="plain-card">
          <h3>What this means</h3>
          <div className="sub">
            You can't browse, buy, sell, or message right now. If you have an order already in progress, you can still
            complete it — confirm delivery, share a tracking link, or finish the conversation.
          </div>
          <div className="row">
            <button className="btn-outline" onClick={() => setShowOrders(true)}>View my orders in progress</button>
          </div>
        </div>
        <div className="plain-card">
          <h3>Think this is a mistake?</h3>
          <div className="sub">Contact Second Look Support to appeal this decision.</div>
        </div>
        <div style={{ padding: '0 18px' }}>
          <button className="btn-cancel" onClick={onLogout}>Log out</button>
        </div>
      </main>
    </>
  );
}

const GUIDELINE_TEXT = [
  ['Second Look is women-only', 'Every member is identity-verified. Be part of keeping this space safe and honest.'],
  ['Chats may be reviewed', 'For everyone’s safety, our moderation team can review conversations at any time.'],
  ['Be honest in listings and reviews', 'Describe items accurately, and only review real, completed orders.'],
  ['Report, don’t retaliate', 'If something feels off, report it. Harassment or threats lead to an immediate block.']
];

function GuidelinesView({ onBack }: { onBack: () => void }) {
  return (
    <>
      <div className="section-head">
        <button className="back-btn" onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div>
          <h1 style={{ fontSize: 19 }}>Community guidelines</h1>
        </div>
      </div>
      {GUIDELINE_TEXT.map(([title, body]) => (
        <div className="plain-card" key={title}>
          <h3>{title}</h3>
          <div className="sub">{body}</div>
        </div>
      ))}
    </>
  );
}
