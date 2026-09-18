import React, { useEffect, useState } from 'react';
import { useAdminAuth } from './AdminAuthContext.js';
import { Login } from './Login.js';
import { Icon } from './Icon.js';
import { GlobalSearch } from './GlobalSearch.js';
import { ChangePassword } from './ChangePassword.js';
import { api } from './api.js';
import { Overview } from './pages/Overview.js';
import { Users } from './pages/Users.js';
import { Listings } from './pages/Listings.js';
import { Reports } from './pages/Reports.js';
import { Orders } from './pages/Orders.js';
import { Moderation } from './pages/Moderation.js';
import { Chats } from './pages/Chats.js';
import { SupportInbox } from './pages/SupportInbox.js';
import { Appeals } from './pages/Appeals.js';
import { Reviews } from './pages/Reviews.js';
import { Ads } from './pages/Ads.js';
import { Admins } from './pages/Admins.js';
import { KycQueue } from './pages/KycQueue.js';
import { GuardianConsentQueue } from './pages/GuardianConsentQueue.js';
import { Growth } from './pages/Growth.js';
import { Feedback } from './pages/Feedback.js';
import { DeliveryFeedback } from './pages/DeliveryFeedback.js';

type Page = 'overview' | 'users' | 'listings' | 'reports' | 'orders' | 'moderation' | 'chats' | 'support' | 'appeals' | 'reviews' | 'ads' | 'admins' | 'kyc' | 'guardian' | 'growth' | 'feedback' | 'deliveryFeedback';

const NAV: { id: Page; label: string; icon: Parameters<typeof Icon>[0]['name']; superAdminOnly?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'kyc', label: 'ID verification', icon: 'appeals' },
  { id: 'guardian', label: 'Guardian consent', icon: 'appeals' },
  { id: 'listings', label: 'Listings', icon: 'listings' },
  { id: 'reports', label: 'Reported listings', icon: 'flag' },
  { id: 'orders', label: 'Orders', icon: 'orders' },
  { id: 'moderation', label: 'Moderation', icon: 'moderation' },
  { id: 'chats', label: 'Chats', icon: 'chats' },
  { id: 'support', label: 'Support inbox', icon: 'chats' },
  { id: 'appeals', label: 'Appeals', icon: 'appeals' },
  { id: 'reviews', label: 'Reviews', icon: 'reviews' },
  { id: 'deliveryFeedback', label: 'Delivery feedback', icon: 'reviews' },
  { id: 'growth', label: 'Growth', icon: 'reviews' },
  { id: 'feedback', label: 'App feedback', icon: 'reviews' },
  { id: 'ads', label: 'Ads', icon: 'ads', superAdminOnly: true },
  { id: 'admins', label: 'Admins', icon: 'users', superAdminOnly: true }
];

export function App() {
  const { admin, logout } = useAdminAuth();
  const [page, setPage] = useState<Page>('overview');
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    if (!admin) return;
    api.get('/api/admin/overview').then((res) => {
      setBadges({
        moderation: res.stats.openCases,
        appeals: res.stats.pendingAppeals,
        reports: res.stats.pendingReports,
        kyc: res.stats.pendingKyc,
        growth: res.stats.pendingVideoSubmissions,
        support: res.stats.pendingSupportReplies
      });
    }).catch(() => {});
  }, [admin, page]);

  if (!admin) return <Login />;

  const isSuperAdmin = admin.role === 'super_admin';
  const visibleNav = NAV.filter((n) => !n.superAdminOnly || isSuperAdmin);

  return (
    <div id="app">
      <div id="sidebar">
        <div className="brand"><img src="/logo.png" alt="Second Look" /><span>Admin</span></div>
        {visibleNav.map((n) => (
          <button key={n.id} className={page === n.id && !showChangePassword ? 'active' : ''} onClick={() => { setPage(n.id); setShowChangePassword(false); }}>
            <Icon name={n.icon} />
            <span className="label">{n.label}</span>
            {badges[n.id] ? <span className="badge">{badges[n.id]}</span> : null}
          </button>
        ))}
        <div className="bottom-item">
          <button onClick={() => setShowChangePassword(true)}><span className="label">Change password</span></button>
          <button onClick={logout}><span className="label">Log out ({admin.fullName})</span></button>
        </div>
      </div>

      <div id="main">
        <div id="topbar">
          <GlobalSearch />
        </div>
        {showChangePassword ? (
          <ChangePassword onBack={() => setShowChangePassword(false)} />
        ) : (
          <>
            {page === 'overview' && <Overview />}
            {page === 'users' && <Users />}
            {page === 'kyc' && <KycQueue />}
            {page === 'guardian' && <GuardianConsentQueue />}
            {page === 'listings' && <Listings />}
            {page === 'reports' && <Reports />}
            {page === 'orders' && <Orders />}
            {page === 'moderation' && <Moderation />}
            {page === 'chats' && <Chats />}
            {page === 'support' && <SupportInbox />}
            {page === 'appeals' && <Appeals />}
            {page === 'reviews' && <Reviews />}
            {page === 'deliveryFeedback' && <DeliveryFeedback />}
            {page === 'growth' && <Growth />}
            {page === 'feedback' && <Feedback />}
            {page === 'ads' && isSuperAdmin && <Ads />}
            {page === 'admins' && isSuperAdmin && <Admins />}
          </>
        )}
      </div>
    </div>
  );
}
