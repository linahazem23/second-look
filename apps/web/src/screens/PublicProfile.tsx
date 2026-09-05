import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Icon, categoryIcon } from '../Icon.js';

interface ProfileData {
  profile: { id: string; fullName: string; area: string; createdAt: string; completedSalesCount: number; verifiedFemale: boolean };
  activeListings: { id: string; title: string; category: string; price: number; originalPrice: number; images: string[] }[];
  avgRating: number | null;
  reviewsReceived: { id: string; starRating: number | null; honestListing: boolean | null; easyToCommunicate: boolean | null; showedUpAsAgreed: boolean | null; notes: string | null }[];
  reviewsGiven: { id: string; starRating: number | null; notes: string | null }[];
}

export function PublicProfile({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'received' | 'given'>('received');

  useEffect(() => {
    api.get(`/api/profiles/${userId}`)
      .then(setData)
      .catch((err) => setError(friendlyError(err)));
  }, [userId]);

  if (error) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Loading…</div>;

  const { profile, activeListings, avgRating, reviewsReceived, reviewsGiven } = data;
  const isNewSeller = profile.completedSalesCount === 0 && activeListings.length > 0;
  const list = tab === 'received' ? reviewsReceived : reviewsGiven;

  return (
    <>
      <div className="section-head">
        <button className="back-btn" onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div>
          <h1 style={{ fontSize: 19 }}>{profile.fullName}</h1>
          <p>{profile.area} &middot; Joined {new Date(profile.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="plain-card">
        <div className="row" style={{ marginTop: 0, gap: 18 }}>
          <div><strong style={{ fontFamily: 'Fraunces, serif', fontSize: 16 }}>{profile.completedSalesCount}</strong><div className="sub">completed sales</div></div>
          <div><strong style={{ fontFamily: 'Fraunces, serif', fontSize: 16 }}>{avgRating ? avgRating.toFixed(1) : '—'}</strong><div className="sub">average rating</div></div>
          {profile.verifiedFemale && <span className="verified-tag"><Icon name="check" size={12} /> Verified</span>}
        </div>
        {isNewSeller && <span className="match-badge" style={{ marginTop: 10, display: 'inline-block' }}>New here — be one of her first sales!</span>}
      </div>

      <div className="stitch" />
      <div className="section-head" style={{ padding: '0 18px 4px' }}>
        <h1 style={{ fontSize: 15 }}>Active listings</h1>
      </div>
      {activeListings.length === 0 && <div className="empty-state">No active listings right now.</div>}
      <div className="grid">
        {activeListings.map((item) => (
          <div key={item.id} className={`listing-card ${item.category !== 'Clothes' ? 'arch' : ''}`}>
            <div className="thumb">
              {item.images[0] ? <img src={item.images[0]} alt={item.title} /> : <Icon name={categoryIcon(item.category)} size={20} />}
            </div>
            <div className="info">
              <div className="name">{item.title}</div>
              <div className="price-row"><span className="price">{item.price} EGP</span><span className="original-price">{item.originalPrice} EGP</span></div>
            </div>
          </div>
        ))}
      </div>

      <div className="stitch" />
      <div className="cat-toggle">
        <button className={tab === 'received' ? 'active' : ''} onClick={() => setTab('received')}>Reviews received</button>
        <button className={tab === 'given' ? 'active' : ''} onClick={() => setTab('given')}>Reviews left</button>
      </div>
      {list.length === 0 && <div className="empty-state">Nothing here yet.</div>}
      {list.map((r) => (
        <div className="review-card" key={r.id}>
          <div className="stars">{'★'.repeat(r.starRating ?? 0)}{'☆'.repeat(5 - (r.starRating ?? 0))}</div>
          {r.notes && <p style={{ fontSize: 12.5, marginTop: 8 }}>{r.notes}</p>}
        </div>
      ))}
    </>
  );
}
