import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Icon, categoryIcon } from '../Icon.js';
import { useAuth } from '../AuthContext.js';
import { MultiImageUpload } from '../ImageUpload.js';
import { ReportListingModal } from './ReportListingModal.js';
import { LocationAreaField } from '../LocationArea.js';
import { Toggle } from '../Toggle.js';

const CATEGORIES = ['Skincare', 'Makeup', 'Clothes'] as const;
const CONDITIONS = [
  { value: 'NeverUsed', label: 'Never used' },
  { value: 'UsedOnce', label: 'Used once' },
  { value: 'UsedAFewTimes', label: 'Used a few times' },
  { value: 'RegularlyUsed', label: 'Regularly used' }
];
const CLOTHES_SIZES = ['One Size', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];

interface Listing {
  id: string;
  title: string;
  category: string;
  price: number;
  originalPrice: number;
  percentOff: number;
  condition: string;
  allowOffers: boolean;
  size?: string | null;
  area: string;
  images: string[];
  boosted: boolean;
  savedByMe: boolean;
  seller: { id: string; fullName: string };
}

export function Home({ onOrderCreated, onMessageSeller, onViewProfile }: { onOrderCreated?: (orderId: string) => void; onMessageSeller?: (inquiryId: string) => void; onViewProfile?: (userId: string) => void }) {
  const { user } = useAuth();
  const [reportTarget, setReportTarget] = useState<Listing | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  async function buyNow(item: Listing) {
    setBuyingId(item.id);
    try {
      const res = await api.post('/api/orders', { listingId: item.id });
      onOrderCreated?.(res.order.id);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBuyingId(null);
    }
  }

  async function messageSeller(item: Listing) {
    setMessagingId(item.id);
    try {
      const res = await api.post('/api/inquiries', { listingId: item.id });
      onMessageSeller?.(res.inquiry.id);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setMessagingId(null);
    }
  }
  const [category, setCategory] = useState<string>('Skincare');
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | ''>('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [allowOffersOnly, setAllowOffersOnly] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSellForm, setShowSellForm] = useState(false);

  const activeFilterCount = [sortDir, conditionFilter, areaFilter, sizeFilter].filter(Boolean).length + (allowOffersOnly ? 1 : 0);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ category });
      if (query) params.set('q', query);
      if (sortDir) {
        params.set('sortBy', 'price');
        params.set('sortDir', sortDir);
      }
      if (conditionFilter) params.set('condition', conditionFilter);
      if (areaFilter) params.set('area', areaFilter);
      if (category === 'Clothes' && sizeFilter) params.set('size', sizeFilter);
      if (allowOffersOnly) params.set('allowOffers', 'true');
      const res = await api.get(`/api/listings?${params.toString()}`);
      setListings(res.listings);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sortDir, conditionFilter, areaFilter, sizeFilter, allowOffersOnly]);

  async function boostListing(id: string) {
    try {
      await api.post(`/api/listings/${id}/boost`);
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function toggleSave(item: Listing) {
    setListings((prev) => prev.map((l) => (l.id === item.id ? { ...l, savedByMe: !l.savedByMe } : l)));
    try {
      if (item.savedByMe) await api.delete(`/api/listings/${item.id}/save`);
      else await api.post(`/api/listings/${item.id}/save`);
    } catch (err) {
      setListings((prev) => prev.map((l) => (l.id === item.id ? { ...l, savedByMe: item.savedByMe } : l)));
      setError(friendlyError(err));
    }
  }

  function clearFilters() {
    setSortDir('');
    setConditionFilter('');
    setAreaFilter('');
    setSizeFilter('');
    setAllowOffersOnly(false);
  }

  return (
    <>
      <div className="section-head">
        <h1>For you</h1>
        <p>Skincare, makeup, and clothes from verified sellers</p>
      </div>

      <div className="cat-toggle">
        {CATEGORIES.map((c) => (
          <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="search-row">
        <input
          placeholder="Search listings…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
      </div>
      <div className="filter-chips">
        <button className={`filter-btn ${activeFilterCount > 0 ? 'active' : ''}`} onClick={() => setShowFilters(true)}>
          <Icon name="flag" size={12} /> Filter
          {activeFilterCount > 0 && <span className="count">{activeFilterCount}</span>}
        </button>
      </div>

      {showFilters && (
        <FilterSheet
          category={category}
          sortDir={sortDir}
          setSortDir={setSortDir}
          conditionFilter={conditionFilter}
          setConditionFilter={setConditionFilter}
          areaFilter={areaFilter}
          setAreaFilter={setAreaFilter}
          sizeFilter={sizeFilter}
          setSizeFilter={setSizeFilter}
          allowOffersOnly={allowOffersOnly}
          setAllowOffersOnly={setAllowOffersOnly}
          onClear={clearFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      <div className="post-btn-wrap">
        <button className="post-toggle" onClick={() => setShowSellForm((v) => !v)}>
          <Icon name="plus" size={16} /> {showSellForm ? 'Cancel' : 'Sell an item'}
        </button>
      </div>

      {showSellForm && <SellForm onPosted={() => { setShowSellForm(false); load(); }} />}

      {reportTarget && (
        <ReportListingModal
          listingId={reportTarget.id}
          listingTitle={reportTarget.title}
          onClose={() => setReportTarget(null)}
          onReported={load}
        />
      )}

      {loading && <div className="empty-state">Loading listings…</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && listings.length === 0 && <div className="empty-state">No listings yet in this category.</div>}

      {!loading && !error && listings.length > 0 && (
        <>
          <div className="result-count">{listings.length} result{listings.length === 1 ? '' : 's'}</div>
          <div className="grid">
            {listings.map((item) => (
              <div key={item.id} className={`listing-card ${item.category !== 'Clothes' ? 'arch' : ''}`}>
                <div className="thumb">
                  {item.images[0] ? <img src={item.images[0]} alt={item.title} /> : <Icon name={categoryIcon(item.category)} size={24} />}
                </div>
                <div className="info">
                  <div className="name">{item.title}</div>
                  <div className="price-row">
                    <span className="price">{item.price} EGP</span>
                    <span className="original-price">{item.originalPrice} EGP</span>
                  </div>
                  <span className="discount-badge">{item.percentOff}% below original</span>
                  {item.boosted && <span className="match-badge" style={{ marginLeft: 6 }}>Boosted</span>}
                  <div className="meta">
                    {CONDITIONS.find((c) => c.value === item.condition)?.label ?? item.condition} &middot; {item.area}
                  </div>
                  {onViewProfile && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewProfile(item.seller.id); }}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 10.5, color: 'var(--rose-dark)', textDecoration: 'underline' }}
                    >
                      {item.seller.fullName}
                    </button>
                  )}
                  <div className="card-actions" style={{ marginTop: 8 }}>
                    {item.seller.id !== user?.id ? (
                      <button className="btn-outline" disabled={buyingId === item.id} onClick={() => buyNow(item)}>
                        {buyingId === item.id ? 'Starting…' : 'Buy'}
                      </button>
                    ) : (
                      !item.boosted && (
                        <button className="btn-outline" onClick={() => boostListing(item.id)}>Boost (25 EGP)</button>
                      )
                    )}
                    {item.seller.id !== user?.id && (
                      <button
                        className="card-icon-btn"
                        aria-label="Message seller"
                        disabled={messagingId === item.id}
                        onClick={(e) => { e.stopPropagation(); messageSeller(item); }}
                      >
                        <Icon name="chat" size={13} />
                      </button>
                    )}
                    <button
                      className="card-icon-btn"
                      aria-label={item.savedByMe ? 'Unsave' : 'Save'}
                      style={{ color: item.savedByMe ? 'var(--rose)' : 'var(--ink-light)' }}
                      onClick={(e) => { e.stopPropagation(); toggleSave(item); }}
                    >
                      <Icon name="want" size={13} />
                    </button>
                    {item.seller.id !== user?.id && (
                      <button
                        className="card-icon-btn"
                        aria-label="Report this listing"
                        onClick={(e) => { e.stopPropagation(); setReportTarget(item); }}
                      >
                        <Icon name="flag" size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

interface FilterSheetProps {
  category: string;
  sortDir: 'asc' | 'desc' | '';
  setSortDir: (v: 'asc' | 'desc' | '') => void;
  conditionFilter: string;
  setConditionFilter: (v: string) => void;
  areaFilter: string;
  setAreaFilter: (v: string) => void;
  sizeFilter: string;
  setSizeFilter: (v: string) => void;
  allowOffersOnly: boolean;
  setAllowOffersOnly: (v: boolean) => void;
  onClear: () => void;
  onClose: () => void;
}

function FilterSheet(props: FilterSheetProps) {
  const { category, sortDir, setSortDir, conditionFilter, setConditionFilter, areaFilter, setAreaFilter, sizeFilter, setSizeFilter, allowOffersOnly, setAllowOffersOnly, onClear, onClose } = props;

  return (
    <div className="filter-sheet-backdrop" onClick={onClose}>
      <div className="filter-sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Filter listings</h2>

        <div className="field-block">
          <label>Sort by price</label>
          <select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc' | '')}>
            <option value="">Default</option>
            <option value="asc">Low to high</option>
            <option value="desc">High to low</option>
          </select>
        </div>

        <div className="field-block">
          <label>Condition</label>
          <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
            <option value="">Any condition</option>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div className="field-block">
          <label>Area</label>
          <LocationAreaField value={areaFilter} onChange={setAreaFilter} allowAny />
        </div>

        {category === 'Clothes' && (
          <div className="field-block">
            <label>Size</label>
            <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
              <option value="">Any size</option>
              {CLOTHES_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="field-block">
          <Toggle checked={allowOffersOnly} onChange={setAllowOffersOnly} label="Allows offers only" />
        </div>

        <div className="form-row">
          <button type="button" className="btn-cancel" onClick={onClear}>Clear all</button>
          <button type="button" className="btn-solid" onClick={onClose}><span className="shine" /><span className="label">Show results</span></button>
        </div>
      </div>
    </div>
  );
}

function SellForm({ onPosted }: { onPosted: () => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('Skincare');
  const [originalPrice, setOriginalPrice] = useState('');
  const [price, setPrice] = useState('');
  const [reasonForSelling, setReasonForSelling] = useState('');
  const [condition, setCondition] = useState('NeverUsed');
  const [allowOffers, setAllowOffers] = useState(false);
  const [size, setSize] = useState('');
  const [area, setArea] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const original = Number(originalPrice);
  const yours = Number(price);
  const validPrice = originalPrice && price ? yours < original : true;
  const percentOff = original > 0 && yours > 0 && yours < original ? Math.round(((original - yours) / original) * 100) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (photoUrls.length === 0) return setError('At least one photo is required.');
    if (!validPrice) return setError('Your price must be strictly lower than the original price.');
    if (category === 'Clothes' && !size) return setError('Size is required for Clothes listings.');
    if (!area) return setError('We need your area to list this item — allow location access or pick one.');

    setBusy(true);
    try {
      await api.post('/api/listings', {
        title,
        category,
        originalPrice: original,
        price: yours,
        reasonForSelling,
        condition,
        allowOffers,
        size: category === 'Clothes' ? size : undefined,
        images: photoUrls,
        area
      });
      onPosted();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="post-form" onSubmit={handleSubmit}>
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

      <label>Original price (EGP)</label>
      <input required type="number" min={1} value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />

      <label>Your price (EGP)</label>
      <input required type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
      {!validPrice && <p className="field-error">Your price must be strictly lower than the original price.</p>}
      {percentOff !== null && <p className="discount-hint">{percentOff}% below original price</p>}

      <label>How many times used</label>
      <select value={condition} onChange={(e) => setCondition(e.target.value)}>
        {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>

      <label>Reason for selling</label>
      <textarea required rows={2} value={reasonForSelling} onChange={(e) => setReasonForSelling(e.target.value)} />

      <label>Photos</label>
      <MultiImageUpload value={photoUrls} onChange={setPhotoUrls} />

      <label>Area</label>
      <LocationAreaField value={area} onChange={setArea} />

      <div className="toggle-row">
        <Toggle checked={allowOffers} onChange={setAllowOffers} label="Allow offers" />
      </div>

      {error && <p className="field-error">{error}</p>}

      <div className="form-row">
        <button type="submit" className="btn-solid" disabled={busy}>
          <span className="shine" /><span className="label">{busy ? 'Posting…' : 'Post listing'}</span>
        </button>
      </div>
    </form>
  );
}
