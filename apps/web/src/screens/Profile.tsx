import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.js';
import { api, friendlyError } from '../api.js';
import { Icon, categoryIcon } from '../Icon.js';
import { MultiImageUpload, ImageUpload } from '../ImageUpload.js';
import { Toggle } from '../Toggle.js';
import { GrowthPanel } from './GrowthPanel.js';
import { LocationAreaField } from '../LocationArea.js';
import { maxAllowedPrice } from '../pricing.js';
import { suggestUsername } from '../identity.js';
import { Avatar } from '../Avatar.js';
import { AVATAR_PRESETS } from '../avatarPresets.js';
import { RewardsPanel } from './RewardsPanel.js';

const CATEGORIES = ['Skincare', 'Haircare', 'Makeup', 'Clothes', 'MomBaby'] as const;
function categoryLabel(c: string): string {
  return c === 'MomBaby' ? 'Mom & Baby' : c;
}
function visibleCategories(isMother: boolean | undefined): string[] {
  const visible = CATEGORIES.filter((c) => c !== 'MomBaby' || isMother);
  return isMother ? ['MomBaby', ...visible.filter((c) => c !== 'MomBaby')] : visible;
}
const CONDITIONS = [
  { value: 'NeverUsed', label: 'Never used' },
  { value: 'UsedOnce', label: 'Used once' },
  { value: 'UsedAFewTimes', label: 'Used a few times' },
  { value: 'RegularlyUsed', label: 'Regularly used' }
];
const CLOTHES_SIZES = ['One Size', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
const SKIN_TYPES = ['All', 'Oily', 'Dry', 'Combination', 'Normal', 'Sensitive'];
const HAIR_TYPES = ['All', 'Straight', 'Wavy', 'Curly', 'Coily'];

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
  skinType?: string | null;
  hairType?: string | null;
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
  const [showSettings, setShowSettings] = useState(false);

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

  if (showSettings) {
    return (
      <>
        <div className="section-head">
          <button className="back-btn" onClick={() => setShowSettings(false)}><Icon name="arrowLeft" size={18} /></button>
          <div><h1 style={{ fontSize: 19 }}>Profile settings</h1></div>
        </div>
        <AvatarCard user={user} onSaved={refresh} />
        <UsernameCard username={user.username} onSaved={refresh} />
        <PhoneCard phoneNumber={user.phoneNumber} onSaved={refresh} />
        <BirthdayCard birthday={user.birthday} hidden={user.birthdayBoardHidden} onSaved={refresh} />
      </>
    );
  }

  return (
    <>
      <div className="section-head">
        <button className="back-btn" onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <Avatar user={user} size={44} />
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

      <RewardsPanel />

      <button className="plain-card" style={{ width: '100%', textAlign: 'left', border: '0.5px solid var(--line)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => setShowSettings(true)}>
        <Avatar user={user} size={32} />
        <div style={{ flex: 1 }}>
          <h3>Profile settings</h3>
          <div className="sub">Profile picture, username, phone number, birthday</div>
        </div>
        <span style={{ color: 'var(--ink-light)', fontSize: 18 }}>›</span>
      </button>

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

function AvatarCard({ user, onSaved }: { user: { avatarUrl: string | null; avatarPreset: string | null; fullName: string; username: string | null }; onSaved: () => void }) {
  const [mode, setMode] = useState<'upload' | 'presets'>(user.avatarUrl ? 'upload' : 'presets');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveUpload(url: string | null) {
    setBusy(true);
    setError(null);
    try {
      await api.patch('/api/auth/avatar', { avatarUrl: url });
      onSaved();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function savePreset(key: string) {
    setBusy(true);
    setError(null);
    try {
      await api.patch('/api/auth/avatar', { avatarPreset: key });
      onSaved();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="plain-card">
      <h3>Profile picture</h3>
      <div className="sub">A real photo, or pick a character instead.</div>
      <div className="cat-toggle" style={{ padding: '10px 0 0' }}>
        <button className={mode === 'upload' ? 'active' : ''} onClick={() => setMode('upload')}>Upload a photo</button>
        <button className={mode === 'presets' ? 'active' : ''} onClick={() => setMode('presets')}>Pick a character</button>
      </div>
      {mode === 'upload' ? (
        <div style={{ marginTop: 10 }}>
          <ImageUpload value={user.avatarUrl} onChange={saveUpload} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 10 }}>
          {AVATAR_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={busy}
              onClick={() => savePreset(p.key)}
              style={{
                background: p.bg,
                border: user.avatarPreset === p.key ? '2px solid var(--rose)' : '2px solid transparent',
                borderRadius: '50%',
                aspectRatio: '1',
                fontSize: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              aria-label={p.label}
            >
              {p.emoji}
            </button>
          ))}
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
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
        className="field-input"
        style={{ marginTop: 12 }}
        placeholder="e.g. skincarefan22"
        value={value}
        onChange={(e) => { setValue(e.target.value.replace(/[^a-zA-Z0-9_]/g, '')); setSaved(false); }}
        maxLength={20}
      />
      <button
        type="button"
        className="switch-link"
        style={{ marginTop: 4 }}
        onClick={() => { setValue(suggestUsername()); setSaved(false); }}
      >
        🎲 Suggest one for me
      </button>
      {error && <p className="field-error">{error}</p>}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn-outline" disabled={busy || value.trim() === (username ?? '')} onClick={handleSave}>
          {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save username'}
        </button>
      </div>
    </div>
  );
}

function PhoneCard({ phoneNumber, onSaved }: { phoneNumber: string | null; onSaved: () => void }) {
  const [phone, setPhone] = useState(phoneNumber ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch('/api/auth/phone', { phoneNumber: phone.trim() });
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
      <h3>Phone number</h3>
      <div className="sub">
        So we can reach you fast — by call or WhatsApp — if anything urgent ever comes up with an order.
      </div>
      <input
        className="field-input"
        style={{ marginTop: 12 }}
        type="tel"
        placeholder="01xxxxxxxxx"
        value={phone}
        onChange={(e) => { setPhone(e.target.value); setSaved(false); }}
      />
      {error && <p className="field-error">{error}</p>}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn-outline" disabled={busy || !phone.trim() || phone.trim() === (phoneNumber ?? '')} onClick={handleSave}>
          {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save phone number'}
        </button>
      </div>
    </div>
  );
}

function BirthdayCard({ birthday, hidden, onSaved }: { birthday: string | null; hidden: boolean; onSaved: () => void }) {
  const [value, setValue] = useState(birthday ? birthday.slice(0, 10) : '');
  const [boardHidden, setBoardHidden] = useState(hidden);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch('/api/auth/birthday', {
        birthday: value ? new Date(value).toISOString() : null,
        birthdayBoardHidden: boardHidden
      });
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
      <h3>Your birthday</h3>
      <div className="sub">Shows day and month only on the Birthdays board — never your age. Others can set up a gift pool for you once it's set.</div>
      <input
        className="field-input"
        style={{ marginTop: 12 }}
        type="date"
        value={value}
        onChange={(e) => { setValue(e.target.value); setSaved(false); }}
      />
      {value && (
        <div className="toggle-row" style={{ marginTop: 10 }}>
          <Toggle checked={!boardHidden} onChange={(v) => { setBoardHidden(!v); setSaved(false); }} label="Show me on the Birthdays board" />
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn-outline" disabled={busy || (value === (birthday?.slice(0, 10) ?? '') && boardHidden === hidden)} onClick={handleSave}>
          {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save birthday'}
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
  const { user } = useAuth();
  const [title, setTitle] = useState(listing.title);
  const [category, setCategory] = useState(listing.category);
  const [condition, setCondition] = useState(listing.condition);
  const [size, setSize] = useState(listing.size ?? '');
  const [skinType, setSkinType] = useState(listing.skinType ?? '');
  const [hairType, setHairType] = useState(listing.hairType ?? '');
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
    if (category === 'Skincare' && !skinType) return setError('Skin type is required for Skincare listings.');
    if (category === 'Haircare' && !hairType) return setError('Hair type is required for Haircare listings.');
    if (!area) return setError('An area is required.');

    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/listings/${listing.id}`, {
        title,
        category,
        condition,
        size: category === 'Clothes' ? size : undefined,
        skinType: category === 'Skincare' ? skinType : undefined,
        hairType: category === 'Haircare' ? hairType : undefined,
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
      <input required autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} />

      <label>Category</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {visibleCategories(user?.isMother).map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
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

      {category === 'Skincare' && (
        <>
          <label>Suitable for which skin type</label>
          <select value={skinType} onChange={(e) => setSkinType(e.target.value)} required>
            <option value="">Select skin type</option>
            {SKIN_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </>
      )}

      {category === 'Haircare' && (
        <>
          <label>Suitable for which hair type</label>
          <select value={hairType} onChange={(e) => setHairType(e.target.value)} required>
            <option value="">Select hair type</option>
            {HAIR_TYPES.map((h) => <option key={h} value={h}>{h}</option>)}
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
