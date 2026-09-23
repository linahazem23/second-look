import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Icon } from '../Icon.js';
import { Avatar } from '../Avatar.js';
import { useAuth } from '../AuthContext.js';
import { displayName } from '../identity.js';

interface GiftPoolSummary {
  id: string;
  targetAmount: number;
  raisedAmount: number;
  listingId: string | null;
  giftDescription: string | null;
  deadline: string;
}

interface BoardMember {
  id: string;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
  avatarPreset: string | null;
  daysUntil: number;
  giftPool: GiftPoolSummary | null;
}

export function BirthdaysHub() {
  const { user } = useAuth();
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPoolId, setOpenPoolId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.get('/api/birthdays')
      .then((res) => setMembers(res.members))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (openPoolId) {
    return <GiftPoolDetail poolId={openPoolId} onBack={() => { setOpenPoolId(null); load(); }} />;
  }

  return (
    <>
      <div className="section-head">
        <h1>Birthdays</h1>
        <p>Celebrate each other — see who's up next, and chip in for a gift.</p>
      </div>
      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && members.length === 0 && (
        <div className="empty-state">No birthdays logged yet — add yours from your profile.</div>
      )}
      {members.map((m) => {
        const isMe = m.id === user?.id;
        const pct = m.giftPool ? Math.min(100, Math.round((m.giftPool.raisedAmount / m.giftPool.targetAmount) * 100)) : 0;
        return (
          <div className="plain-card" key={m.id}>
            <div className="row" style={{ marginTop: 0, gap: 10, alignItems: 'center' }}>
              <Avatar user={m} size={36} />
              <div style={{ flex: 1 }}>
                <h3>{displayName(m)}{isMe ? ' (You)' : ''}</h3>
                <div className="sub">{m.daysUntil === 0 ? '🎂 Today!' : `In ${m.daysUntil} day${m.daysUntil === 1 ? '' : 's'}`}</div>
              </div>
            </div>

            {m.giftPool ? (
              <>
                <div className="sub" style={{ marginTop: 10 }}>
                  {m.giftPool.giftDescription ?? 'A listing she picked'} &middot; {m.giftPool.raisedAmount} / {m.giftPool.targetAmount} EGP raised
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--rose)' }} />
                </div>
                <button className="btn-outline" style={{ marginTop: 10 }} onClick={() => setOpenPoolId(m.giftPool!.id)}>
                  {isMe ? 'View your gift pool' : 'Contribute'}
                </button>
              </>
            ) : (
              isMe && <SetUpPoolForm onDone={load} />
            )}
          </div>
        );
      })}
    </>
  );
}

function SetUpPoolForm({ onDone }: { onDone: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [targetAmount, setTargetAmount] = useState('');
  const [giftDescription, setGiftDescription] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; title: string; price: number }[]>([]);
  const [selectedListing, setSelectedListing] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/api/listings?q=${encodeURIComponent(q)}`).then((res) => setResults(res.listings.slice(0, 5))).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/birthdays/gift-pool', {
        listingId: selectedListing?.id,
        giftDescription: selectedListing ? undefined : (giftDescription.trim() || undefined),
        targetAmount: Number(targetAmount)
      });
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!showForm) {
    return (
      <button className="btn-outline" style={{ marginTop: 10 }} onClick={() => setShowForm(true)}>
        + Set up your gift pool
      </button>
    );
  }

  return (
    <form className="post-form" onSubmit={submit} style={{ marginTop: 10 }}>
      <label>What do you want?</label>
      {selectedListing ? (
        <div className="row" style={{ alignItems: 'center' }}>
          <span className="sub">{selectedListing.title}</span>
          <button type="button" className="switch-link" onClick={() => setSelectedListing(null)}>Change</button>
        </div>
      ) : (
        <>
          <input placeholder="Search a listing you want…" value={q} onChange={(e) => setQ(e.target.value)} />
          {results.map((r) => (
            <button
              type="button"
              key={r.id}
              className="btn-outline"
              style={{ width: '100%', textAlign: 'left', marginTop: 6 }}
              onClick={() => { setSelectedListing(r); setResults([]); setQ(''); }}
            >
              {r.title} — {r.price} EGP
            </button>
          ))}
          <p className="discount-hint">Or just describe it if it's not on Second Look:</p>
          <textarea rows={2} placeholder="e.g. A nice skincare set" value={giftDescription} onChange={(e) => setGiftDescription(e.target.value)} />
        </>
      )}

      <label>Goal amount (EGP)</label>
      <input required type="number" min={1} value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />

      {error && <p className="field-error">{error}</p>}
      <div className="form-row">
        <button type="submit" className="btn-solid" disabled={busy || !targetAmount || (!selectedListing && !giftDescription.trim())}>
          <span className="shine" /><span className="label">{busy ? 'Creating…' : 'Create gift pool'}</span>
        </button>
      </div>
    </form>
  );
}

function GiftPoolDetail({ poolId, onBack }: { poolId: string; onBack: () => void }) {
  const [pool, setPool] = useState<{
    id: string;
    targetAmount: number;
    raisedAmount: number;
    giftDescription: string | null;
    listingId: string | null;
    status: string;
    contributions: { id: string; amount: number; contributor: { fullName: string; username: string | null; avatarUrl: string | null; avatarPreset: string | null } }[];
  } | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  function load() {
    api.get(`/api/birthdays/gift-pool/${poolId}`).then((res) => setPool(res.pool)).catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, [poolId]);

  async function contribute(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post(`/api/birthdays/gift-pool/${poolId}/contribute`, { amount: Number(amount) });
      window.open(res.iframeUrl, '_blank');
      setPolling(true);
      const interval = setInterval(async () => {
        const status = await api.get(`/api/birthdays/gift-pool/contributions/${res.contributionId}`);
        if (status.status === 'paid') {
          clearInterval(interval);
          setPolling(false);
          setAmount('');
          load();
        } else if (status.status === 'failed') {
          clearInterval(interval);
          setPolling(false);
          setError('Payment did not go through.');
        }
      }, 3000);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!pool) return <div className="empty-state">{error || 'Loading…'}</div>;

  const pct = Math.min(100, Math.round((pool.raisedAmount / pool.targetAmount) * 100));

  return (
    <>
      <div className="section-head">
        <button className="back-btn" onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div><h1 style={{ fontSize: 19 }}>Gift pool</h1></div>
      </div>
      <div className="plain-card">
        <h3>{pool.giftDescription ?? 'A listing she picked'}</h3>
        <div className="sub" style={{ marginTop: 6 }}>{pool.raisedAmount} / {pool.targetAmount} EGP raised</div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', marginTop: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--rose)' }} />
        </div>
        {pool.status === 'open' ? (
          <form className="form-row" onSubmit={contribute} style={{ marginTop: 12 }}>
            <input
              style={{ flex: 1, border: '0.5px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
              type="number"
              min={1}
              placeholder="Amount (EGP)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button type="submit" className="btn-solid" disabled={busy || polling || !amount}>
              <span className="shine" /><span className="label">{polling ? 'Confirming…' : busy ? 'Opening…' : 'Contribute'}</span>
            </button>
          </form>
        ) : (
          <div className="verified-tag" style={{ marginTop: 10 }}>{pool.status === 'funded' ? 'Fully funded! 🎉' : 'This pool has closed.'}</div>
        )}
        {error && <p className="field-error">{error}</p>}
      </div>

      <div className="stitch" />
      <div className="section-head" style={{ padding: '0 18px 4px' }}>
        <h1 style={{ fontSize: 15 }}>{pool.contributions.length} contributor{pool.contributions.length === 1 ? '' : 's'}</h1>
      </div>
      {pool.contributions.length === 0 && <div className="empty-state">Be the first to contribute.</div>}
      {pool.contributions.map((c) => (
        <div className="plain-card" key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar user={c.contributor} size={28} />
          <div style={{ flex: 1 }}>{displayName(c.contributor)}</div>
          <strong>{c.amount} EGP</strong>
        </div>
      ))}
    </>
  );
}
