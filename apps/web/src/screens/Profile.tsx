import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.js';
import { api, friendlyError } from '../api.js';
import { Icon, categoryIcon } from '../Icon.js';
import { ImageUpload } from '../ImageUpload.js';
import { Toggle } from '../Toggle.js';
import { GrowthPanel } from './GrowthPanel.js';

interface MyListing {
  id: string;
  title: string;
  category: string;
  price: number;
  originalPrice: number;
  allowOffers: boolean;
  status: string;
  images: string[];
}

interface SavedListing {
  id: string;
  title: string;
  category: string;
  price: number;
  originalPrice: number;
  images: string[];
}

export function Profile({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [listings, setListings] = useState<MyListing[]>([]);
  const [saved, setSaved] = useState<SavedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function load() {
    api.get('/api/listings/mine')
      .then((res) => setListings(res.listings))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
    api.get('/api/listings/saved').then((res) => setSaved(res.listings)).catch(() => {});
  }

  useEffect(load, []);

  async function unsave(id: string) {
    setSaved((prev) => prev.filter((l) => l.id !== id));
    try {
      await api.delete(`/api/listings/${id}/save`);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  if (!user) return null;
  const isNewSeller = user.completedSalesCount === 0 && listings.length > 0;

  return (
    <>
      <div className="section-head">
        <button className="back-btn" onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div>
          <h1 style={{ fontSize: 19 }}>{user.fullName}</h1>
          <p>{user.area} &middot; Joined {new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="plain-card">
        <div className="row" style={{ marginTop: 0, gap: 18 }}>
          <div><strong style={{ fontFamily: 'Fraunces, serif', fontSize: 16 }}>{user.completedSalesCount}</strong><div className="sub">completed sales</div></div>
          <div><strong style={{ fontFamily: 'Fraunces, serif', fontSize: 16 }}>{user.verifiedFemale ? 'Yes' : 'Pending'}</strong><div className="sub">verified</div></div>
        </div>
        {isNewSeller && <span className="match-badge" style={{ marginTop: 10, display: 'inline-block' }}>New here — be one of her first sales!</span>}
      </div>

      <GrowthPanel />

      <div className="stitch" />
      <div className="section-head" style={{ padding: '0 18px 4px' }}>
        <h1 style={{ fontSize: 15 }}>Your listings</h1>
      </div>

      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && listings.length === 0 && <div className="empty-state">You haven't posted anything yet.</div>}

      {listings.map((item) =>
        editingId === item.id ? (
          <EditListingForm key={item.id} listing={item} onDone={() => { setEditingId(null); load(); }} onCancel={() => setEditingId(null)} />
        ) : (
          <div className="plain-card" key={item.id}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className={`listing-card ${item.category !== 'Clothes' ? 'arch' : ''}`} style={{ width: 84, flexShrink: 0 }}>
                <div className="thumb" style={{ height: 72 }}>
                  {item.images[0] ? <img src={item.images[0]} alt={item.title} /> : <Icon name={categoryIcon(item.category)} size={20} />}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <h3>{item.title}</h3>
                <div className="sub">{item.price} EGP &middot; {item.status}</div>
                <div className="row">
                  {item.status !== 'Removed' && (
                    <button className="btn-outline" onClick={() => setEditingId(item.id)}>Edit</button>
                  )}
                  {item.status === 'Active' && (
                    <button className="btn-outline" onClick={() => updateStatus(item.id, 'Sold', load, setError)}>Mark as sold</button>
                  )}
                  {item.status !== 'Removed' && (
                    <button className="btn-outline" onClick={() => updateStatus(item.id, 'Removed', load, setError)}>Remove</button>
                  )}
                  {item.status === 'Removed' && (
                    <button className="btn-outline" onClick={() => updateStatus(item.id, 'Active', load, setError)}>Reactivate</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      <div className="stitch" />
      <div className="section-head" style={{ padding: '0 18px 4px' }}>
        <h1 style={{ fontSize: 15 }}>Saved</h1>
      </div>
      {saved.length === 0 && <div className="empty-state">Nothing saved yet — tap the heart on a listing to save it.</div>}
      <div className="grid">
        {saved.map((item) => (
          <div key={item.id} className={`listing-card ${item.category !== 'Clothes' ? 'arch' : ''}`} style={{ position: 'relative' }}>
            <button className="card-flag-btn" aria-label="Unsave" style={{ left: 6, right: 'auto', color: 'var(--rose)' }} onClick={() => unsave(item.id)}>
              <Icon name="want" size={12} />
            </button>
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
    </>
  );
}

async function updateStatus(id: string, status: string, reload: () => void, setError: (msg: string | null) => void) {
  try {
    await api.patch(`/api/listings/${id}`, { status });
    setError(null);
    reload();
  } catch (err) {
    setError(friendlyError(err));
  }
}

function EditListingForm({ listing, onDone, onCancel }: { listing: MyListing; onDone: () => void; onCancel: () => void }) {
  const [price, setPrice] = useState(String(listing.price));
  const [originalPrice, setOriginalPrice] = useState(String(listing.originalPrice));
  const [allowOffers, setAllowOffers] = useState(listing.allowOffers);
  const [photoUrl, setPhotoUrl] = useState<string | null>(listing.images[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const original = Number(originalPrice);
  const yours = Number(price);
  const validPrice = yours < original;
  const percentOff = original > 0 && yours > 0 && validPrice ? Math.round(((original - yours) / original) * 100) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validPrice) return setError('Your price must be strictly lower than the original price.');
    if (!photoUrl) return setError('At least one photo is required.');

    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/listings/${listing.id}`, {
        price: yours,
        originalPrice: original,
        allowOffers,
        images: [photoUrl]
      });
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="post-form" onSubmit={handleSubmit}>
      <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 14.5 }}>Edit "{listing.title}"</h3>

      <label>Photo</label>
      <ImageUpload value={photoUrl} onChange={setPhotoUrl} />

      <label>Original price (EGP)</label>
      <input required type="number" min={1} value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />

      <label>Your price (EGP)</label>
      <input required type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
      {!validPrice && <p className="field-error">Your price must be strictly lower than the original price.</p>}
      {percentOff !== null && <p className="discount-hint">{percentOff}% below original price</p>}

      <div className="toggle-row">
        <Toggle checked={allowOffers} onChange={setAllowOffers} label="Allow offers" />
      </div>

      {error && <p className="field-error">{error}</p>}

      <div className="form-row">
        <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-solid" disabled={busy}>
          <span className="shine" /><span className="label">{busy ? 'Saving…' : 'Save changes'}</span>
        </button>
      </div>
    </form>
  );
}
