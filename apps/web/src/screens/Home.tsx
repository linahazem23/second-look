import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Icon, categoryIcon } from '../Icon.js';
import { useAuth } from '../AuthContext.js';
import { MultiImageUpload } from '../ImageUpload.js';
import { ReportListingModal } from './ReportListingModal.js';
import { LocationAreaField } from '../LocationArea.js';
import { Toggle } from '../Toggle.js';
import { Explore } from './Explore.js';
import { displayName } from '../identity.js';
import { MAX_DISCOUNT_BY_CONDITION, minAllowedPrice } from '../pricing.js';

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
  seller: { id: string; fullName: string; username?: string | null };
}

export function Home({ onOrderCreated, onMessageSeller, onViewProfile, onNeedAuth }: { onOrderCreated?: (orderId: string) => void; onMessageSeller?: (inquiryId: string) => void; onViewProfile?: (userId: string) => void; onNeedAuth?: () => void }) {
  const { user } = useAuth();
  const [reportTarget, setReportTarget] = useState<Listing | null>(null);
  const [negotiateTarget, setNegotiateTarget] = useState<Listing | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [boostingId, setBoostingId] = useState<string | null>(null);
  // Separate from `error` (page-load failure) — an action failing here should
  // surface a message without wiping the whole listings grid off the screen.
  const [actionError, setActionError] = useState<string | null>(null);

  async function buyNow(item: Listing) {
    if (!user) return onNeedAuth?.();
    setBuyingId(item.id);
    setActionError(null);
    try {
      const res = await api.post('/api/orders', { listingId: item.id });
      onOrderCreated?.(res.order.id);
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setBuyingId(null);
    }
  }

  async function messageSeller(item: Listing) {
    if (!user) return onNeedAuth?.();
    setMessagingId(item.id);
    setActionError(null);
    try {
      const res = await api.post('/api/inquiries', { listingId: item.id });
      onMessageSeller?.(res.inquiry.id);
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setMessagingId(null);
    }
  }

  function tapBuy(item: Listing) {
    if (!user) return onNeedAuth?.();
    if (item.allowOffers) setNegotiateTarget(item);
    else buyNow(item);
  }

  async function sendOffer(item: Listing, amount: number) {
    setActionError(null);
    try {
      const inquiryRes = await api.post('/api/inquiries', { listingId: item.id });
      await api.post(`/api/inquiries/${inquiryRes.inquiry.id}/offer`, { amount });
      setNegotiateTarget(null);
      onMessageSeller?.(inquiryRes.inquiry.id);
    } catch (err) {
      setActionError(friendlyError(err));
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
  const [showExplore, setShowExplore] = useState(false);

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

  // Polls until Paymob's webhook marks the boost payment paid, then flips the
  // badge on — boosting a non-Plus listing is a real 25 EGP charge, so the
  // listing can't be marked boosted until the money has actually moved.
  function pollBoostPayment(listingId: string, boostPaymentId: string, attempt = 0) {
    if (attempt > 40) {
      setBoostingId((current) => (current === listingId ? null : current));
      setActionError('Still waiting on that payment — if you completed it, the badge will appear on refresh.');
      return;
    }
    setTimeout(async () => {
      try {
        const res = await api.get(`/api/listings/boost-payments/${boostPaymentId}`);
        if (res.paid) {
          setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, boosted: true } : l)));
          setActionError(null);
          setBoostingId((current) => (current === listingId ? null : current));
          return;
        }
      } catch {
        // transient poll error — keep trying
      }
      pollBoostPayment(listingId, boostPaymentId, attempt + 1);
    }, 3000);
  }

  async function boostListing(id: string) {
    if (!user) return onNeedAuth?.();
    setActionError(null);
    setBoostingId(id);
    try {
      const res = await api.post(`/api/listings/${id}/boost`);
      if (res.wasFree) {
        setListings((prev) => prev.map((l) => (l.id === id ? { ...l, boosted: true } : l)));
        setBoostingId(null);
        return;
      }
      const checkoutTab = window.open(res.iframeUrl, '_blank');
      if (!checkoutTab) {
        setActionError('Your browser blocked the payment tab. Please allow popups for this site and try boosting again.');
        setBoostingId(null);
        return;
      }
      setActionError('Complete the 25 EGP payment in the new tab — the Boosted badge appears here automatically once it goes through.');
      pollBoostPayment(id, res.boostPaymentId);
    } catch (err) {
      setActionError(friendlyError(err));
      setBoostingId(null);
    }
  }

  async function toggleSave(item: Listing) {
    if (!user) return onNeedAuth?.();
    setListings((prev) => prev.map((l) => (l.id === item.id ? { ...l, savedByMe: !l.savedByMe } : l)));
    try {
      if (item.savedByMe) await api.delete(`/api/listings/${item.id}/save`);
      else await api.post(`/api/listings/${item.id}/save`);
    } catch (err) {
      setListings((prev) => prev.map((l) => (l.id === item.id ? { ...l, savedByMe: item.savedByMe } : l)));
      setActionError(friendlyError(err));
    }
  }

  function clearFilters() {
    setSortDir('');
    setConditionFilter('');
    setAreaFilter('');
    setSizeFilter('');
    setAllowOffersOnly(false);
  }

  if (showExplore) {
    return (
      <>
        <div className="section-head">
          <button className="back-btn" onClick={() => setShowExplore(false)}><Icon name="arrowLeft" size={18} /></button>
          <div><h1 style={{ fontSize: 19 }}>Browse by area</h1></div>
        </div>
        <Explore />
      </>
    );
  }

  return (
    <>
      <p className="home-greeting">Hiii Bestie</p>
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
        <button className="filter-btn" onClick={() => setShowExplore(true)}>
          <Icon name="explore" size={12} /> Browse by area
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
        <button className="post-toggle" onClick={() => (user ? setShowSellForm((v) => !v) : onNeedAuth?.())}>
          <Icon name="plus" size={16} /> {showSellForm ? 'Cancel' : 'Sell an item'}
        </button>
      </div>

      {showSellForm && user && <SellForm onPosted={() => { setShowSellForm(false); load(); }} />}

      {reportTarget && (
        <ReportListingModal
          listingId={reportTarget.id}
          listingTitle={reportTarget.title}
          onClose={() => setReportTarget(null)}
          onReported={load}
        />
      )}

      {negotiateTarget && (
        <NegotiateModal
          item={negotiateTarget}
          onBuyNow={() => { const item = negotiateTarget; setNegotiateTarget(null); buyNow(item); }}
          onSendOffer={(amount) => sendOffer(negotiateTarget, amount)}
          onClose={() => setNegotiateTarget(null)}
        />
      )}

      {actionError && (
        <p className="field-error" style={{ margin: '0 18px 10px' }}>
          {actionError} <button type="button" onClick={() => setActionError(null)} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', padding: 0 }}>Dismiss</button>
        </p>
      )}
      {loading && <div className="empty-state">Loading listings…</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && listings.length === 0 && <div className="empty-state">Nothing here yet — be the queen that sells first 👑</div>}

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
                  {item.allowOffers && <span className="match-badge" style={{ marginLeft: 6 }}>Negotiable</span>}
                  {item.boosted && <span className="match-badge" style={{ marginLeft: 6 }}>Boosted</span>}
                  <div className="meta">
                    {CONDITIONS.find((c) => c.value === item.condition)?.label ?? item.condition} &middot; {item.area}
                  </div>
                  {onViewProfile && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewProfile(item.seller.id); }}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 10.5, color: 'var(--rose-dark)', textDecoration: 'underline' }}
                    >
                      {displayName(item.seller)}
                    </button>
                  )}
                  <div className="card-actions" style={{ marginTop: 8 }}>
                    {item.seller.id !== user?.id ? (
                      <button className="btn-outline" disabled={buyingId === item.id} onClick={() => tapBuy(item)}>
                        {buyingId === item.id ? 'Starting…' : 'Buy'}
                      </button>
                    ) : (
                      !item.boosted && (
                        <button className="btn-outline" disabled={boostingId === item.id} onClick={() => boostListing(item.id)}>
                          {boostingId === item.id ? 'Waiting for payment…' : 'Boost (25 EGP)'}
                        </button>
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
          <Toggle checked={allowOffersOnly} onChange={setAllowOffersOnly} label="Negotiable only" />
        </div>

        <div className="form-row">
          <button type="button" className="btn-cancel" onClick={onClear}>Clear all</button>
          <button type="button" className="btn-solid" onClick={onClose}><span className="shine" /><span className="label">Show results</span></button>
        </div>
      </div>
    </div>
  );
}

function NegotiateModal({ item, onBuyNow, onSendOffer, onClose }: {
  item: Listing;
  onBuyNow: () => void;
  onSendOffer: (amount: number) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  // An offer negotiates below the current asking price, not the pre-discount
  // original — capped at the listing's own price so an older listing already
  // priced under the standard floor still has a valid (if narrow) range.
  const floor = Math.min(minAllowedPrice(item.originalPrice, item.condition), item.price - 1);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(90,46,61,0.32)', zIndex: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div className="post-form" style={{ margin: '0 18px 18px', width: '100%', maxWidth: 394 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 14.5 }}>{item.title}</h3>
        <div className="sub">This seller accepts offers — buy now at the listed price, or propose your own.</div>

        <div className="form-row" style={{ marginTop: 14 }}>
          <button type="button" className="btn-solid" onClick={onBuyNow}>
            <span className="shine" /><span className="label">Buy now — {item.price} EGP</span>
          </button>
        </div>

        <label style={{ marginTop: 14 }}>Or make an offer (EGP)</label>
        <input type="number" min={Math.ceil(floor)} max={item.price - 1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Between ${Math.ceil(floor)} and ${item.price - 1}`} />

        <div className="form-row">
          <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-outline"
            disabled={!amount || Number(amount) < floor || Number(amount) >= item.price}
            onClick={() => onSendOffer(Number(amount))}
          >
            Send offer
          </button>
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
  const floor = original > 0 ? minAllowedPrice(original, condition) : 0;
  const validPrice = originalPrice && price ? yours < original && yours >= floor : true;
  const percentOff = original > 0 && yours > 0 && yours < original ? Math.round(((original - yours) / original) * 100) : null;
  const maxDiscountPercent = Math.round(MAX_DISCOUNT_BY_CONDITION[condition] * 100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (photoUrls.length === 0) return setError('At least one photo is required.');
    if (yours >= original) return setError('Your price must be strictly lower than the original price.');
    if (yours < floor) return setError(`For this condition, the price can't be discounted more than ${maxDiscountPercent}% off the original — that's ${Math.ceil(floor)} EGP minimum.`);
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

      <label>How many times used</label>
      <select value={condition} onChange={(e) => setCondition(e.target.value)}>
        {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>

      <label>Original price (EGP)</label>
      <input required type="number" min={1} value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />

      <label>Your price (EGP)</label>
      <input required type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
      {original > 0 && (
        <p className="discount-hint">
          For this condition, price can't go below {Math.ceil(floor)} EGP (max {maxDiscountPercent}% off).
        </p>
      )}
      {!validPrice && yours >= original && <p className="field-error">Your price must be strictly lower than the original price.</p>}
      {!validPrice && yours > 0 && yours < floor && (
        <p className="field-error">That's discounted more than this condition allows — {Math.ceil(floor)} EGP minimum.</p>
      )}
      {validPrice && percentOff !== null && <p className="discount-hint">{percentOff}% below original price</p>}

      <label>Reason for selling</label>
      <textarea required rows={2} value={reasonForSelling} onChange={(e) => setReasonForSelling(e.target.value)} />

      <label>Photos</label>
      <MultiImageUpload value={photoUrls} onChange={setPhotoUrls} />

      <label>Area</label>
      <LocationAreaField value={area} onChange={setArea} />

      <div className="toggle-row">
        <Toggle checked={allowOffers} onChange={setAllowOffers} label="Negotiation" />
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
