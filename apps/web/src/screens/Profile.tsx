import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.js';
import { api, friendlyError } from '../api.js';
import { Icon, categoryIcon } from '../Icon.js';
import { MultiImageUpload } from '../ImageUpload.js';
import { Toggle } from '../Toggle.js';
import { GrowthPanel } from './GrowthPanel.js';
import { LocationAreaField } from '../LocationArea.js';
import { maxAllowedPrice } from '../pricing.js';

const CATEGORIES = ['Skincare', 'Makeup', 'Clothes'] as const;
const CONDITIONS = [
  { value: 'NeverUsed', label: 'Never used' },
  { value: 'UsedOnce', label: 'Used once' },
  { value: 'UsedAFewTimes', label: 'Used a few times' },
  { value: 'RegularlyUsed', label: 'Regularly used' }
];
const CLOTHES_SIZES = ['One Size', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];

interface MyListing {
  id: string;
  title: string;
  category: string;
  price: number;
  originalPrice: number;
  condition: string;
  allowOffers: boolean;
  status: string;
  images: string[];
  size?: string | null;
  area: string;
  reasonForSelling: string;
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
  const { user, refresh } = useAuth();
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

      <UsernameCard username={user.username} onSaved={refresh} />

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
          <div key={item.id} className={`listing-card ${item.category !== 'Clothes' ? 'arch' : ''}`}>
            <div className="thumb">
              {item.images[0] ? <img src={item.images[0]} alt={item.title} /> : <Icon name={categoryIcon(item.category)} size={20} />}
            </div>
            <div className="info">
              <div className="name">{item.title}</div>
              <div className="price-row"><span className="price">{item.price} EGP</span><span className="original-price">{item.originalPrice} EGP</span></div>
              <div className="card-actions" style={{ marginTop: 8 }}>
                <button className="card-icon-btn" aria-label="Unsave" style={{ color: 'var(--rose)' }} onClick={() => unsave(item.id)}>
                  <Icon name="want" size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function UsernameCard({ username, onSaved }: { username: string | null; onSaved: () => void }) {
  const [value, setValue] = useState(username ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch('/api/auth/username', { username: value.trim() || null });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="plain-card">
      <h3>Username</h3>
      <div className="sub">Optional — shown instead of your real name everywhere it's public. Leave blank to use your name.</div>
      <input
        style={{ marginTop: 10 }}
        placeholder="e.g. skincarefan22"
        value={value}
        onChange={(e) => { setValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, '')); setSaved(false); }}
        maxLength={20}
      />
      {error && <p className="field-error">{error}</p>}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn-outline" disabled={busy || value.trim() === (username ?? '')} onClick={handleSave}>
          {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save username'}
        </button>
      </div>
    </div>
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
  const [title, setTitle] = useState(listing.title);
  const [category, setCategory] = useState(listing.category);
  const [condition, setCondition] = useState(listing.condition);
  const [size, setSize] = useState(listing.size ?? '');
  const [area, setArea] = useState(listing.area);
  const [reasonForSelling, setReasonForSelling] = useState(listing.reasonForSelling ?? '');
  const [price, setPrice] = useState(String(listing.price));
  const [originalPrice, setOriginalPrice] = useState(String(listing.originalPrice));
  const [allowOffers, setAllowOffers] = useState(listing.allowOffers);
  const [photoUrls, setPhotoUrls] = useState<string[]>(listing.images ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const original = Number(originalPrice);
  const yours = Number(price);
  const ceiling = original > 0 ? maxAllowedPrice(original, condition) : Infinity;
  const validPrice = yours < original && yours <= ceiling;
  const savings = original > 0 && yours > 0 && validPrice ? Math.round(original - yours) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (yours >= original) return setError('Your price must be strictly lower than the original price.');
    if (yours > ceiling) return setError(`For this condition, your price can't be more than ${Math.floor(ceiling)} EGP — you're welcome to price it lower.`);
    if (photoUrls.length === 0) return setError('At least one photo is required.');
    if (category === 'Clothes' && !size) return setError('Size is required for Clothes listings.');
    if (!area) return setError('An area is required.');

    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/listings/${listing.id}`, {
        title,
        category,
        condition,
        size: category === 'Clothes' ? size : undefined,
        area,
        reasonForSelling,
        price: yours,
        originalPrice: original,
        allowOffers,
        images: photoUrls
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

      <label>Item name</label>
      <input required value={title} onChange={(e) => setTitle(e.target.value)} />

      <label>Category</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {category === 'Clothes' && (
        <>
          <label>Size</label>
          <select value={size} onChange={(e) => setSize(e.target.value)} required>
            <option value="">Select size</option>
            {CLOTHES_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </>
      )}

      <label>How many times used</label>
      <select value={condition} onChange={(e) => setCondition(e.target.value)}>
        {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>

      <label>Photos</label>
      <MultiImageUpload value={photoUrls} onChange={setPhotoUrls} />

      <label>Original price (EGP)</label>
      <input required type="number" min={1} value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />

      <label>Your price (EGP)</label>
      <input required type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
      {!validPrice && yours >= original && <p className="field-error">Your price must be strictly lower than the original price.</p>}
      {!validPrice && yours > 0 && yours > ceiling && <p className="field-error">That's too close to the original price for this condition — {Math.floor(ceiling)} EGP maximum.</p>}
      {savings !== null && <p className="discount-hint">You'll save the buyer {savings} EGP</p>}

      <label>Reason for selling</label>
      <textarea required rows={2} value={reasonForSelling} onChange={(e) => setReasonForSelling(e.target.value)} />

      <label>Area</label>
      <LocationAreaField value={area} onChange={setArea} />

      <div className="toggle-row">
        <Toggle checked={allowOffers} onChange={setAllowOffers} label="Negotiation" />
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
