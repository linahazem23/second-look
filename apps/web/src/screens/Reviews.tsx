import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Icon } from '../Icon.js';
import { Stars } from './ReviewForms.js';
import { MultiImageUpload } from '../ImageUpload.js';

interface PersonReview {
  id: string;
  starRating: number | null;
  honestListing: boolean | null;
  easyToCommunicate: boolean | null;
  showedUpAsAgreed: boolean | null;
  notes: string | null;
  disputeStatus: string;
}

interface ProductSummary {
  productIdentity: string;
  count: number;
  avgRating: number;
  latestNote: string | null;
  latestPhoto: string | null;
}

interface ProductReview {
  id: string;
  source: 'verified_purchase' | 'community';
  starRating: number | null;
  usageDuration: string | null;
  photos: string[];
  notes: string | null;
}

export function Reviews({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'products' | 'received' | 'given'>('products');
  const [openProduct, setOpenProduct] = useState<string | null>(null);
  const [showLeaveReview, setShowLeaveReview] = useState(false);

  if (openProduct) {
    return (
      <ProductDetail
        productIdentity={openProduct}
        onBack={() => setOpenProduct(null)}
      />
    );
  }

  return (
    <>
      <div className="section-head">
        <button className="back-btn" onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div>
          <h1 style={{ fontSize: 19 }}>Reviews</h1>
          <p>Product reviews from the community, plus your own trust ratings</p>
        </div>
      </div>
      <div className="cat-toggle">
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Products</button>
        <button className={tab === 'received' ? 'active' : ''} onClick={() => setTab('received')}>Received</button>
        <button className={tab === 'given' ? 'active' : ''} onClick={() => setTab('given')}>Left by you</button>
      </div>

      {tab === 'products' ? (
        <ProductList
          showLeaveReview={showLeaveReview}
          onToggleLeaveReview={() => setShowLeaveReview((v) => !v)}
          onOpen={setOpenProduct}
        />
      ) : (
        <PersonReviews tab={tab} />
      )}
    </>
  );
}

function ProductList({
  showLeaveReview,
  onToggleLeaveReview,
  onOpen
}: {
  showLeaveReview: boolean;
  onToggleLeaveReview: () => void;
  onOpen: (productIdentity: string) => void;
}) {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    api.get(`/api/reviews/products${params}`)
      .then((res) => setProducts(res.products))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, [q, refreshKey]);

  return (
    <>
      <div className="search-row" style={{ margin: '0 18px 12px' }}>
        <input placeholder="Search a product or brand…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div style={{ margin: '0 18px 12px' }}>
        <button className="btn-outline" onClick={onToggleLeaveReview}>
          {showLeaveReview ? 'Cancel' : '+ Leave a review'}
        </button>
      </div>
      {showLeaveReview && (
        <CommunityReviewForm
          onDone={() => { onToggleLeaveReview(); setRefreshKey((k) => k + 1); }}
        />
      )}
      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && products.length === 0 && (
        <div className="empty-state">No product reviews yet — be the first to leave one.</div>
      )}
      {products.map((p) => (
        <button key={p.productIdentity} className="plain-card" style={{ width: '100%', textAlign: 'left', display: 'block' }} onClick={() => onOpen(p.productIdentity)}>
          <h3>{p.productIdentity}</h3>
          <div className="stars">{'★'.repeat(Math.round(p.avgRating))}{'☆'.repeat(5 - Math.round(p.avgRating))}</div>
          <div className="sub" style={{ marginTop: 4 }}>{p.count} review{p.count === 1 ? '' : 's'}</div>
          {p.latestNote && <p style={{ fontSize: 12.5, marginTop: 6 }}>{p.latestNote}</p>}
        </button>
      ))}
    </>
  );
}

function CommunityReviewForm({ productIdentity: initialProduct, onDone }: { productIdentity?: string; onDone: () => void }) {
  const [productIdentity, setProductIdentity] = useState(initialProduct ?? '');
  const [starRating, setStarRating] = useState(5);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/reviews/community', { productIdentity, starRating, photoUrls, notes: notes || undefined });
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="post-form" onSubmit={submit}>
      <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 14.5 }}>Leave a review</h3>
      {!initialProduct && (
        <>
          <label>Product or brand</label>
          <input required value={productIdentity} onChange={(e) => setProductIdentity(e.target.value)} placeholder="e.g. Brand X Glow Serum 30ml" />
        </>
      )}
      <label>Rating</label>
      <Stars value={starRating} onChange={setStarRating} />
      <label>Photos (optional)</label>
      <MultiImageUpload value={photoUrls} onChange={setPhotoUrls} />
      <label>Your experience</label>
      <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you think?" />
      {error && <p className="field-error">{error}</p>}
      <div className="form-row">
        <button type="submit" className="btn-solid" disabled={busy || !productIdentity.trim()}>
          <span className="shine" /><span className="label">{busy ? 'Posting…' : 'Post review'}</span>
        </button>
      </div>
    </form>
  );
}

function ProductDetail({ productIdentity, onBack }: { productIdentity: string; onBack: () => void }) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLeaveReview, setShowLeaveReview] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api.get(`/api/reviews/product?productIdentity=${encodeURIComponent(productIdentity)}`)
      .then((res) => { setReviews(res.reviews); setAvgRating(res.avgRating); })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, [productIdentity, refreshKey]);

  return (
    <>
      <div className="section-head">
        <button className="back-btn" onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div>
          <h1 style={{ fontSize: 19 }}>{productIdentity}</h1>
          <p>{avgRating ? `${avgRating.toFixed(1)} average · ${reviews.length} reviews` : 'No ratings yet'}</p>
        </div>
      </div>
      <div style={{ margin: '0 18px 12px' }}>
        <button className="btn-outline" onClick={() => setShowLeaveReview((v) => !v)}>
          {showLeaveReview ? 'Cancel' : '+ Leave a review'}
        </button>
      </div>
      {showLeaveReview && (
        <CommunityReviewForm
          productIdentity={productIdentity}
          onDone={() => { setShowLeaveReview(false); setRefreshKey((k) => k + 1); }}
        />
      )}
      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">{error}</div>}
      {reviews.map((r) => (
        <div className="review-card" key={r.id}>
          <div className="stars">{'★'.repeat(r.starRating ?? 0)}{'☆'.repeat(5 - (r.starRating ?? 0))}</div>
          {r.source === 'verified_purchase' && <span className="verified-tag" style={{ marginLeft: 8 }}>Verified purchase</span>}
          {r.usageDuration && <div className="sub" style={{ marginTop: 6 }}>Used for {r.usageDuration}</div>}
          {r.photos.length > 0 && (
            <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              {r.photos.map((url) => (
                <img key={url} src={url} alt="Review" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8 }} />
              ))}
            </div>
          )}
          {r.notes && <p style={{ fontSize: 12.5, marginTop: 8 }}>{r.notes}</p>}
        </div>
      ))}
    </>
  );
}

function PersonReviews({ tab }: { tab: 'received' | 'given' }) {
  const [received, setReceived] = useState<PersonReview[]>([]);
  const [given, setGiven] = useState<PersonReview[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/reviews/mine')
      .then((res) => { setReceived(res.received); setGiven(res.given); setAvgRating(res.avgRating); })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleDispute(id: string) {
    const note = window.prompt('Explain why you are disputing this review:');
    if (!note) return;
    try {
      await api.post(`/api/reviews/${id}/dispute`, { note });
      setReceived((prev) => prev.map((r) => (r.id === id ? { ...r, disputeStatus: 'disputed' } : r)));
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  const list = tab === 'received' ? received : given;

  return (
    <>
      {tab === 'received' && (
        <p className="discount-hint" style={{ margin: '0 18px 10px' }}>
          {avgRating ? `${avgRating.toFixed(1)} average trust rating from ${received.length} order${received.length === 1 ? '' : 's'}` : 'No trust ratings yet'}
        </p>
      )}
      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && list.length === 0 && <div className="empty-state">Nothing here yet.</div>}

      {list.map((r) => (
        <div className="review-card" key={r.id}>
          <div className="stars">{'★'.repeat(r.starRating ?? 0)}{'☆'.repeat(5 - (r.starRating ?? 0))}</div>
          <div className="sub" style={{ marginTop: 6 }}>
            {r.honestListing && 'Honest listing · '}{r.easyToCommunicate && 'Easy to communicate · '}{r.showedUpAsAgreed && 'Showed up as agreed'}
          </div>
          {r.notes && <p style={{ fontSize: 12.5, marginTop: 8 }}>{r.notes}</p>}
          {tab === 'received' && r.disputeStatus === 'none' && (
            <button className="btn-outline" style={{ marginTop: 10 }} onClick={() => handleDispute(r.id)}>Dispute this review</button>
          )}
          {tab === 'received' && r.disputeStatus === 'disputed' && (
            <span className="verified-tag">Dispute submitted — a moderator will review it</span>
          )}
        </div>
      ))}
    </>
  );
}
