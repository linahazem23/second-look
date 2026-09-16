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
import { maxAllowedPrice } from '../pricing.js';

const CATEGORIES = ['Skincare', 'Haircare', 'Makeup', 'Clothes'] as const;
const BROWSE_CATEGORIES = ['All', ...CATEGORIES] as const;
const CONDITIONS = [
  { value: 'NeverUsed', label: 'Never used' },
  { value: 'UsedOnce', label: 'Used once' },
  { value: 'UsedAFewTimes', label: 'Used a few times' },
  { value: 'RegularlyUsed', label: 'Regularly used' }
];
const CLOTHES_SIZES = ['One Size', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
// "All" means suitable for every skin/hair type — always shown first so it
// reads as the default-friendly option, not just another item in the list.
const SKIN_TYPES = ['All', 'Oily', 'Dry', 'Combination', 'Normal', 'Sensitive'];
const HAIR_TYPES = ['All', 'Straight', 'Wavy', 'Curly', 'Coily'];

interface ActiveAd {
  id: string;
  brand: string;
  creativeUrl: string | null;
  linkUrl: string | null;
}

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
  skinType?: string | null;
  hairType?: string | null;
  area: string;
  reasonForSelling: string;
  images: string[];
  boosted: boolean;
  savedByMe: boolean;
  seller: { id: string; fullName: string; username?: string | null };
}

export function Home({ onOrderCreated, onMessageSeller, onViewProfile, onNeedAuth }: { onOrderCreated?: (orderId: string) => void; onMessageSeller?: (inquiryId: string) => void; onViewProfile?: (userId: string) => void; onNeedAuth?: () => void }) {
  const { user } = useAuth();
  const [reportTarget, setReportTarget] = useState<Listing | null>(null);
  const [viewingItem, setViewingItem] = useState<Listing | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [boostingId, setBoostingId] = useState<string | null>(null);
  // Separate from `error` (page-load failure) — an action failing here should
  // surface a message without wiping the whole listings grid off the screen.
  const [actionError, setActionError] = useState<string | null>(null);

  // Buy always opens the chat with the seller first — arranging delivery (and
  // negotiating, if she allows offers) happens there, with "Buy now" itself
  // available from inside that chat once they're actually ready to commit.
  async function tapBuy(item: Listing) {
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

  const [category, setCategory] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | ''>('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [skinTypeFilter, setSkinTypeFilter] = useState('');
  const [hairTypeFilter, setHairTypeFilter] = useState('');
  const [allowOffersOnly, setAllowOffersOnly] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSellForm, setShowSellForm] = useState(false);
  const [showExplore, setShowExplore] = useState(false);
  const [activeAd, setActiveAd] = useState<ActiveAd | null>(null);

  useEffect(() => {
    api.get('/api/ads/active?slotType=in_feed_sponsored_card').then((res) => setActiveAd(res.ad)).catch(() => {});
  }, []);

  const activeFilterCount = [sortDir, conditionFilter, areaFilter, sizeFilter, skinTypeFilter, hairTypeFilter].filter(Boolean).length + (allowOffersOnly ? 1 : 0);

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
      if ((category === 'Clothes' || category === 'All') && sizeFilter) params.set('size', sizeFilter);
      if ((category === 'Skincare' || category === 'All') && skinTypeFilter) params.set('skinType', skinTypeFilter);
      if ((category === 'Haircare' || category === 'All') && hairTypeFilter) params.set('hairType', hairTypeFilter);
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
  }, [category, sortDir, conditionFilter, areaFilter, sizeFilter, skinTypeFilter, hairTypeFilter, allowOffersOnly]);

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
    setSkinTypeFilter('');
    setHairTypeFilter('');
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
        <p>Skincare, makeup, haircare, and clothes from verified sellers</p>
      </div>

      <div className="cat-toggle">
        {BROWSE_CATEGORIES.map((c) => (
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
          skinTypeFilter={skinTypeFilter}
          setSkinTypeFilter={setSkinTypeFilter}
          hairTypeFilter={hairTypeFilter}
          setHairTypeFilter={setHairTypeFilter}
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

      {viewingItem && (
        <ListingDetailModal
          item={viewingItem}
          isOwner={viewingItem.seller.id === user?.id}
          buying={messagingId === viewingItem.id}
          boosting={boostingId === viewingItem.id}
          onClose={() => setViewingItem(null)}
          onBuy={() => tapBuy(viewingItem)}
          onToggleSave={() => toggleSave(viewingItem)}
          onReport={() => { setViewingItem(null); setReportTarget(viewingItem); }}
          onBoost={() => boostListing(viewingItem.id)}
          onViewProfile={onViewProfile ? () => { setViewingItem(null); onViewProfile(viewingItem.seller.id); } : undefined}
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
            {listings.map((item, idx) => (
              <React.Fragment key={item.id}>
                {idx === 2 && <AdCard ad={activeAd} />}
              <div className={`listing-card ${item.category !== 'Clothes' ? 'arch' : ''}`} onClick={() => setViewingItem(item)} style={{ cursor: 'pointer' }}>
                <div className="thumb">
                  {item.images[0] ? <img src={item.images[0]} alt={item.title} /> : <Icon name={categoryIcon(item.category)} size={24} />}
                </div>
                <div className="info">
                  <div className="name">{item.title}</div>
                  <div className="price-row">
                    <span className="price">{item.price} EGP</span>
                    <span className="original-price">{item.originalPrice} EGP</span>
                  </div>
                  <span className="discount-badge">Save {Math.round(item.originalPrice - item.price)} EGP</span>
                  {item.allowOffers && <span className="match-badge" style={{ marginLeft: 6 }}>Negotiable</span>}
                  {item.boosted && <span className="match-badge" style={{ marginLeft: 6 }}>Boosted</span>}
                  <div className="meta">
                    {CONDITIONS.find((c) => c.value === item.condition)?.label ?? item.condition}
                    {item.size ? ` · ${item.size}` : ''}
                    {item.skinType ? ` · ${item.skinType} skin` : ''}
                    {item.hairType ? ` · ${item.hairType} hair` : ''} &middot; {item.area}
                  </div>
                  {onViewProfile && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewProfile(item.seller.id); }}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 10.5, color: 'var(--rose-dark)', textDecoration: 'underline' }}
                    >
                      {displayName(item.seller)}
                    </button>
                  )}
                  <div className="card-actions" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                    {item.seller.id !== user?.id ? (
                      <button className="btn-outline" disabled={messagingId === item.id} onClick={() => tapBuy(item)}>
                        {messagingId === item.id ? 'Starting…' : 'Buy'}
                      </button>
                    ) : (
                      !item.boosted && (
                        <button className="btn-outline" disabled={boostingId === item.id} onClick={() => boostListing(item.id)}>
                          {boostingId === item.id ? 'Waiting for payment…' : 'Boost (25 EGP)'}
                        </button>
                      )
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
              </React.Fragment>
            ))}
            {listings.length < 3 && <AdCard ad={activeAd} />}
          </div>
        </>
      )}
    </>
  );
}

function AdCard({ ad }: { ad: ActiveAd | null }) {
  const href = ad?.linkUrl ?? 'mailto:ads@trysecondlook.app?subject=Advertise%20on%20Second%20Look';
  return (
    <a href={href} target={ad?.linkUrl ? '_blank' : undefined} rel="noreferrer" className="listing-card arch ad-card">
      <div className="thumb">
        {ad?.creativeUrl ? <img src={ad.creativeUrl} alt={ad.brand} /> : <Icon name="star" size={24} />}
      </div>
      <div className="info">
        <div className="name">{ad ? ad.brand : 'Advertise here'}</div>
        <div className="meta">{ad ? 'Sponsored' : 'Reach thousands of verified shoppers — get in touch'}</div>
      </div>
    </a>
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
  skinTypeFilter: string;
  setSkinTypeFilter: (v: string) => void;
  hairTypeFilter: string;
  setHairTypeFilter: (v: string) => void;
  allowOffersOnly: boolean;
  setAllowOffersOnly: (v: boolean) => void;
  onClear: () => void;
  onClose: () => void;
}

function FilterSheet(props: FilterSheetProps) {
  const { category, sortDir, setSortDir, conditionFilter, setConditionFilter, areaFilter, setAreaFilter, sizeFilter, setSizeFilter, skinTypeFilter, setSkinTypeFilter, hairTypeFilter, setHairTypeFilter, allowOffersOnly, setAllowOffersOnly, onClear, onClose } = props;

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

        {(category === 'Clothes' || category === 'All') && (
          <div className="field-block">
            <label>Size</label>
            <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
              <option value="">Any size</option>
              {CLOTHES_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {(category === 'Skincare' || category === 'All') && (
          <div className="field-block">
            <label>Skin type</label>
            <select value={skinTypeFilter} onChange={(e) => setSkinTypeFilter(e.target.value)}>
              <option value="">Any skin type</option>
              {SKIN_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {(category === 'Haircare' || category === 'All') && (
          <div className="field-block">
            <label>Hair type</label>
            <select value={hairTypeFilter} onChange={(e) => setHairTypeFilter(e.target.value)}>
              <option value="">Any hair type</option>
              {HAIR_TYPES.map((h) => <option key={h} value={h}>{h}</option>)}
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

function ListingDetailModal({ item, isOwner, buying, boosting, onClose, onBuy, onToggleSave, onReport, onBoost, onViewProfile }: {
  item: Listing;
  isOwner: boolean;
  buying: boolean;
  boosting: boolean;
  onClose: () => void;
  onBuy: () => void;
  onToggleSave: () => void;
  onReport: () => void;
  onBoost: () => void;
  onViewProfile?: () => void;
}) {
  const [slide, setSlide] = useState<'photos' | 'details'>('photos');
  const [photoIndex, setPhotoIndex] = useState(0);
  const images = item.images.length > 0 ? item.images : [null];

  return (
    <div className="listing-detail-backdrop" onClick={onClose}>
      <div className="listing-detail" onClick={(e) => e.stopPropagation()}>
        <div className="listing-detail-head">
          <button className="back-btn" onClick={onClose}><Icon name="close" size={18} /></button>
          <div className="slide-tabs">
            <button className={slide === 'photos' ? 'active' : ''} onClick={() => setSlide('photos')}>Photos</button>
            <button className={slide === 'details' ? 'active' : ''} onClick={() => setSlide('details')}>Details</button>
          </div>
        </div>

        {slide === 'photos' ? (
          <div className="listing-detail-photos">
            <div className="listing-detail-photo-frame">
              {images[photoIndex] ? (
                <img src={images[photoIndex]!} alt={item.title} />
              ) : (
                <Icon name={categoryIcon(item.category)} size={40} />
              )}
              {images.length > 1 && (
                <>
                  <button
                    className="photo-nav prev"
                    aria-label="Previous photo"
                    onClick={() => setPhotoIndex((i) => (i - 1 + images.length) % images.length)}
                  >
                    <Icon name="arrowLeft" size={16} />
                  </button>
                  <button
                    className="photo-nav next"
                    aria-label="Next photo"
                    onClick={() => setPhotoIndex((i) => (i + 1) % images.length)}
                  >
                    <Icon name="arrowLeft" size={16} />
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="photo-dots">
                {images.map((_, i) => (
                  <span key={i} className={i === photoIndex ? 'dot active' : 'dot'} onClick={() => setPhotoIndex(i)} />
                ))}
              </div>
            )}
            <div className="listing-detail-price-row">
              <div>
                <div className="name" style={{ fontSize: 17 }}>{item.title}</div>
                <div className="price-row" style={{ marginTop: 4 }}>
                  <span className="price" style={{ fontSize: 18 }}>{item.price} EGP</span>
                  <span className="original-price">{item.originalPrice} EGP</span>
                </div>
                <span className="discount-badge">Save {Math.round(item.originalPrice - item.price)} EGP</span>
              </div>
              <button type="button" className="switch-link" onClick={() => setSlide('details')}>See details →</button>
            </div>
          </div>
        ) : (
          <div className="listing-detail-info">
            <h1 style={{ fontSize: 18, fontFamily: 'Fraunces, serif' }}>{item.title}</h1>
            <div className="row" style={{ marginTop: 2 }}>
              {item.allowOffers && <span className="match-badge">Negotiable</span>}
              {item.boosted && <span className="match-badge" style={{ marginLeft: 6 }}>Boosted</span>}
            </div>
            <div className="meta" style={{ marginTop: 8 }}>
              {CONDITIONS.find((c) => c.value === item.condition)?.label ?? item.condition}
              {item.size ? ` · Size ${item.size}` : ''}
              {item.skinType ? ` · ${item.skinType} skin` : ''}
              {item.hairType ? ` · ${item.hairType} hair` : ''} &middot; {item.area}
            </div>
            {onViewProfile && (
              <button
                onClick={onViewProfile}
                style={{ background: 'none', border: 'none', padding: 0, marginTop: 6, fontSize: 12, color: 'var(--rose-dark)', textDecoration: 'underline' }}
              >
                {displayName(item.seller)}
              </button>
            )}
            {item.reasonForSelling && (
              <p style={{ fontSize: 13.5, marginTop: 12, lineHeight: 1.5 }}>{item.reasonForSelling}</p>
            )}

            <div className="card-actions" style={{ marginTop: 16 }}>
              {!isOwner ? (
                <button className="btn-outline" disabled={buying} onClick={onBuy}>
                  {buying ? 'Starting…' : `Buy — ${item.price} EGP`}
                </button>
              ) : (
                !item.boosted && (
                  <button className="btn-outline" disabled={boosting} onClick={onBoost}>
                    {boosting ? 'Waiting for payment…' : 'Boost (25 EGP)'}
                  </button>
                )
              )}
              <button
                className="card-icon-btn"
                aria-label={item.savedByMe ? 'Unsave' : 'Save'}
                style={{ color: item.savedByMe ? 'var(--rose)' : 'var(--ink-light)' }}
                onClick={onToggleSave}
              >
                <Icon name="want" size={13} />
              </button>
              {!isOwner && (
                <button className="card-icon-btn" aria-label="Report this listing" onClick={onReport}>
                  <Icon name="flag" size={13} />
                </button>
              )}
            </div>
          </div>
        )}
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
  const [skinType, setSkinType] = useState('');
  const [hairType, setHairType] = useState('');
  const [area, setArea] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const original = Number(originalPrice);
  const yours = Number(price);
  const ceiling = original > 0 ? maxAllowedPrice(original, condition) : Infinity;
  const validPrice = originalPrice && price ? yours < original && yours <= ceiling : true;
  const savings = original > 0 && yours > 0 && yours < original ? Math.round(original - yours) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (photoUrls.length === 0) return setError('At least one photo is required.');
    if (yours >= original) return setError('Your price must be strictly lower than the original price.');
    if (yours > ceiling) return setError(`For this condition, your price can't be more than ${Math.floor(ceiling)} EGP — you're welcome to price it lower.`);
    if (category === 'Clothes' && !size) return setError('Size is required for Clothes listings.');
    if (category === 'Skincare' && !skinType) return setError('Skin type is required for Skincare listings.');
    if (category === 'Haircare' && !hairType) return setError('Hair type is required for Haircare listings.');
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
        skinType: category === 'Skincare' ? skinType : undefined,
        hairType: category === 'Haircare' ? hairType : undefined,
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

      <label>Original price (EGP)</label>
      <input required type="number" min={1} value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />

      <label>Your price (EGP)</label>
      <input required type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
      {original > 0 && Number.isFinite(ceiling) && (
        <p className="discount-hint">
          For this condition, your price can't be more than {Math.floor(ceiling)} EGP.
        </p>
      )}
      {!validPrice && yours >= original && <p className="field-error">Your price must be strictly lower than the original price.</p>}
      {!validPrice && yours > 0 && yours > ceiling && (
        <p className="field-error">That's too close to the original price for this condition — {Math.floor(ceiling)} EGP maximum.</p>
      )}
      {validPrice && savings !== null && <p className="discount-hint">You'll save the buyer {savings} EGP</p>}

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
