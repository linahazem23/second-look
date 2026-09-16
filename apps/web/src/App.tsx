import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './AuthContext.js';
import { Auth } from './screens/Auth.js';
import { KycGate, ProfileQuizGate, GuidelinesGate, HOW_TO_STEPS } from './screens/Onboarding.js';
import { PublicProfile } from './screens/PublicProfile.js';
import { Home } from './screens/Home.js';
import { WantHub } from './screens/WantHub.js';
import { Chat } from './screens/Chat.js';
import { Reviews } from './screens/Reviews.js';
import { Community } from './screens/Community.js';
import { Profile } from './screens/Profile.js';
import { GuardianConsent } from './screens/GuardianConsent.js';
import { Icon } from './Icon.js';

type Tab = 'home' | 'want' | 'reviews' | 'community' | 'chat';
type MenuView = 'profile' | 'guidelines' | null;

/** Shown in place of Want/Community/Chat for a guest — browsing stays open, only actions require an account. */
function GuestGate({ what, onSignup, onLogin }: { what: string; onSignup: () => void; onLogin: () => void }) {
  return (
    <>
      <div className="section-head">
        <h1>{what}</h1>
      </div>
      <div className="plain-card">
        <h3>Create an account to continue</h3>
        <div className="sub">{what} needs an identity-verified account — it's how Second Look keeps this space safe.</div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn-solid" onClick={onSignup}><span className="shine" /><span className="label">Create account</span></button>
          <button className="btn-outline" onClick={onLogin}>Log in</button>
        </div>
      </div>
    </>
  );
}

export function App() {
  const { user, loading, logout, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [pendingInquiryId, setPendingInquiryId] = useState<string | null>(null);
  const [pendingSupport, setPendingSupport] = useState(false);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [hasUnreadChats, setHasUnreadChats] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<{ mode: 'login' | 'signup'; reason?: string } | null>(null);
  const consumedDeepLink = useRef(false);

  // Lets a "you have a new message" email link (?order=<id> or ?inquiry=<id>)
  // drop the user straight into that conversation instead of the home feed.
  useEffect(() => {
    if (!user || consumedDeepLink.current) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    const inquiryId = params.get('inquiry');
    if (!orderId && !inquiryId) return;

    consumedDeepLink.current = true;
    if (orderId) setPendingOrderId(orderId);
    if (inquiryId) setPendingInquiryId(inquiryId);
    setTab('chat');
    window.history.replaceState(null, '', window.location.pathname);
  }, [user]);

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

  // Reached only via a one-time link emailed to a minor's guardian — no
  // Second Look account involved, so this bypasses auth/loading entirely.
  // Checked after every hook above so hook order never changes across renders.
  const guardianConsentToken = new URLSearchParams(window.location.search).get('guardianConsent');
  if (guardianConsentToken) {
    return (
      <div id="phone">
        <GuardianConsent token={guardianConsentToken} />
      </div>
    );
  }

  if (loading) {
    return (
      <div id="phone">
        <div className="spinner-wrap">Loading Second Look…</div>
      </div>
    );
  }

  // These gates only ever apply to a logged-in user — a guest skips straight
  // past them into the normal (browsable, action-gated) shell below.
  if (user) {
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
  }

  if (authPrompt) {
    return (
      <div id="phone">
        <Auth initialMode={authPrompt.mode} reason={authPrompt.reason} onCancel={() => setAuthPrompt(null)} />
      </div>
    );
  }

  function needAuth(reason?: string) {
    setAuthPrompt({ mode: 'signup', reason });
  }

  function goToOrder(orderId: string) {
    if (!user) return needAuth();
    setPendingOrderId(orderId);
    setTab('chat');
  }

  function goToInquiry(inquiryId: string) {
    if (!user) return needAuth();
    setPendingInquiryId(inquiryId);
    setTab('chat');
  }

  function goToSupport() {
    if (!user) return needAuth();
    setPendingSupport(true);
    setMenuView(null);
    setTab('chat');
  }

  return (
    <div id="phone">
      <header className="topbar">
        <img className="logo" src="/logo.png" alt="Second Look" />
        <button className="menu-btn" onClick={() => setMenuOpen(true)}>
          <Icon name="menu" size={18} />
        </button>
      </header>

      <main className="content">
        {viewingProfileId ? (
          <PublicProfile userId={viewingProfileId} onBack={() => setViewingProfileId(null)} />
        ) : (
          <>
        {menuView === 'profile' && user && <Profile onBack={() => setMenuView(null)} />}
        {menuView === 'guidelines' && <GuidelinesView onBack={() => setMenuView(null)} onContactSupport={goToSupport} />}

        {menuView === null && (
          <>
            {tab === 'home' && (
              <Home
                onOrderCreated={goToOrder}
                onMessageSeller={goToInquiry}
                onViewProfile={setViewingProfileId}
                onNeedAuth={() => needAuth()}
              />
            )}
            {tab === 'want' && (
              user ? <WantHub /> : (
                <GuestGate
                  what="Want & Demand"
                  onSignup={() => setAuthPrompt({ mode: 'signup' })}
                  onLogin={() => setAuthPrompt({ mode: 'login' })}
                />
              )
            )}
            {tab === 'reviews' && <Reviews guest={!user} onNeedAuth={() => needAuth()} />}
            {tab === 'community' && (
              user ? <Community /> : (
                <GuestGate
                  what="Community"
                  onSignup={() => setAuthPrompt({ mode: 'signup' })}
                  onLogin={() => setAuthPrompt({ mode: 'login' })}
                />
              )
            )}
            {tab === 'chat' && (
              user ? (
                <Chat
                  initialOrderId={pendingOrderId}
                  initialInquiryId={pendingInquiryId}
                  initialSupport={pendingSupport}
                  onOpenOrder={() => setPendingOrderId(null)}
                  onOpenInquiry={() => setPendingInquiryId(null)}
                  onOpenSupport={() => setPendingSupport(false)}
                />
              ) : (
                <GuestGate
                  what="Chat"
                  onSignup={() => setAuthPrompt({ mode: 'signup' })}
                  onLogin={() => setAuthPrompt({ mode: 'login' })}
                />
              )
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
        <button className={tab === 'reviews' && !menuView ? 'active' : ''} onClick={() => { setTab('reviews'); setMenuView(null); }}>
          <Icon name="star" /><span>Reviews</span>
        </button>
        <button className={tab === 'community' && !menuView ? 'active' : ''} onClick={() => { setTab('community'); setMenuView(null); }}>
          <Icon name="community" /><span>Community</span>
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
          {user ? (
            <>
              <button className="item" onClick={() => { setMenuView('profile'); setMenuOpen(false); }}>My profile</button>
              <button className="item" onClick={() => { setMenuView('guidelines'); setMenuOpen(false); }}>Community guidelines</button>
              <button className="item" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <button className="item" onClick={() => { setMenuView('guidelines'); setMenuOpen(false); }}>Community guidelines</button>
              <button className="item" onClick={() => { setMenuOpen(false); setAuthPrompt({ mode: 'signup' }); }}>Create account</button>
              <button className="item" onClick={() => { setMenuOpen(false); setAuthPrompt({ mode: 'login' }); }}>Log in</button>
            </>
          )}
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
          <img className="logo" src="/logo.png" alt="Second Look" />
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
        <img className="logo" src="/logo.png" alt="Second Look" />
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

function GuidelinesView({ onBack, onContactSupport }: { onBack: () => void; onContactSupport: () => void }) {
  return (
    <>
      <div className="section-head">
        <button className="back-btn" onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div>
          <h1 style={{ fontSize: 19 }}>Community guidelines</h1>
        </div>
      </div>
      <div className="plain-card">
        <h3>How Second Look works</h3>
        <ol className="how-to-list">
          {HOW_TO_STEPS.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
      </div>
      <div className="plain-card">
        <h3>Need help?</h3>
        <div className="sub">Reach Second Look Support directly, any time.</div>
        <button className="btn-outline" style={{ marginTop: 10 }} onClick={onContactSupport}>Contact Support</button>
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
