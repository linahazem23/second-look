import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Icon } from '../Icon.js';
import { useAuth } from '../AuthContext.js';
import { PET_SPECIES, petImageSrc, petDisplayImage, speciesLabel } from '../petPresets.js';
import { ImageUpload } from '../ImageUpload.js';
import { Toggle } from '../Toggle.js';

interface PetRow {
  id: string;
  species: string;
  name: string;
  photoUrl: string | null;
  growthStage: number;
  fedPoints: number;
  happiness: number;
}

interface InventoryRow {
  itemKey: string;
  quantity: number;
}

interface CatalogItem {
  key: string;
  name: string;
  pointsCost: number;
  kind: string;
  effect: number;
}

const STAGE_LABELS = ['Baby', 'Adult', 'Deluxe'];
const NEXT_THRESHOLD = [50, 150, null] as (number | null)[];

const ITEM_ICONS: Record<string, string> = {
  apple: '🍎',
  treat: '🍬',
  feast: '🍗',
  ball: '⚾',
  plush: '🧸',
  bow: '🎀',
  hat: '🎩',
  crown: '👑'
};

const POINTS_GUIDE: [string, string][] = [
  ['Complete a sale', 'Earn points once payment is released to you as the seller.'],
  ['Leave a review', 'Product or trust reviews after a completed order.'],
  ['Post in Community', 'Ask a question or reply to one — helping counts too.'],
  ['Refer a friend', 'Points land when they sign up with your referral code.'],
  ['Contribute to a gift pool', 'Chip in on someone’s birthday gift and earn the Gift-Giver charm too.']
];

export function Pets({ onBack }: { onBack: () => void }) {
  const { user, refresh } = useAuth();
  const [pets, setPets] = useState<PetRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'pets' | 'shop'>('pets');
  const [showGuide, setShowGuide] = useState(false);

  function load() {
    setLoading(true);
    api.get('/api/pets/mine')
      .then((res) => { setPets(res.pets); setInventory(res.inventory); setCatalog(res.catalog); })
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function invQty(itemKey: string) {
    return inventory.find((i) => i.itemKey === itemKey)?.quantity ?? 0;
  }

  async function useItem(petId: string, itemKey: string) {
    setError(null);
    try {
      await api.post(`/api/pets/${petId}/use-item`, { itemKey });
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function buy(itemKey: string) {
    setError(null);
    try {
      await api.post('/api/pets/shop/buy', { itemKey, quantity: 1 });
      load();
      refresh();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function setPhoto(petId: string, photoUrl: string | null) {
    setError(null);
    try {
      await api.patch(`/api/pets/${petId}/photo`, { photoUrl });
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function useDailyFeed(petId: string) {
    setError(null);
    try {
      await api.post(`/api/pets/${petId}/use-daily-feed`);
      load();
      refresh();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function useDailyWater(petId: string) {
    setError(null);
    try {
      await api.post(`/api/pets/${petId}/use-daily-water`);
      load();
      refresh();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function setRoaming(enabled: boolean) {
    try {
      await api.patch('/api/auth/pets-roaming', { enabled });
      refresh();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <>
      <div className="section-head">
        <button className="back-btn" onClick={onBack}><Icon name="arrowLeft" size={18} /></button>
        <div><h1 style={{ fontSize: 19 }}>Your pets</h1></div>
      </div>
      <div className="cat-toggle">
        <button className={tab === 'pets' ? 'active' : ''} onClick={() => setTab('pets')}>My pets</button>
        <button className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}>Shop &middot; {user?.points ?? 0} pts</button>
      </div>

      {loading && <div className="empty-state">Loading…</div>}
      {error && <p className="field-error" style={{ margin: '0 18px 10px' }}>{error}</p>}

      {tab === 'pets' && !loading && (
        <>
          <div className="plain-card">
            <div className="sub">🍽️ {user?.freeFeedCharges ?? 0} free feed{(user?.freeFeedCharges ?? 0) === 1 ? '' : 's'} &middot; 💧 {user?.freeWaterCharges ?? 0} free water{(user?.freeWaterCharges ?? 0) === 1 ? '' : 's'}</div>
            <div className="sub" style={{ marginTop: 4, fontSize: 11.5 }}>Open the app once a day for a free feed. React to a Community post for free water.</div>
            <div className="toggle-row" style={{ marginTop: 10 }}>
              <Toggle checked={user?.petsRoamingEnabled ?? true} onChange={setRoaming} label="Let your pet roam your screen" />
            </div>
          </div>

          {pets.map((pet) => {
            const nextGoal = NEXT_THRESHOLD[pet.growthStage];
            const pct = nextGoal ? Math.min(100, Math.round((pet.fedPoints / nextGoal) * 100)) : 100;
            return (
              <div className="plain-card" key={pet.id}>
                <div className="row" style={{ marginTop: 0, gap: 12, alignItems: 'center' }}>
                  <img src={petDisplayImage(pet)} alt={speciesLabel(pet.species)} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <h3>{pet.name}</h3>
                    <div className="sub">{speciesLabel(pet.species)} &middot; {STAGE_LABELS[pet.growthStage]} &middot; {pet.happiness}% happy</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  {pet.photoUrl ? (
                    <button className="btn-outline" style={{ fontSize: 11 }} onClick={() => setPhoto(pet.id, null)}>Remove your photo</button>
                  ) : (
                    <>
                      <div className="sub" style={{ marginBottom: 4 }}>Want to use a real photo of your pet instead?</div>
                      <ImageUpload value={null} onChange={(url) => setPhoto(pet.id, url)} />
                    </>
                  )}
                </div>
                {nextGoal && (
                  <>
                    <div className="sub" style={{ marginTop: 8 }}>{pet.fedPoints} / {nextGoal} fed toward {STAGE_LABELS[pet.growthStage + 1]}</div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--rose)' }} />
                    </div>
                  </>
                )}
                <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  {(user?.freeFeedCharges ?? 0) > 0 && (
                    <button className="btn-outline" onClick={() => useDailyFeed(pet.id)}>🍽️ Free feed</button>
                  )}
                  {(user?.freeWaterCharges ?? 0) > 0 && (
                    <button className="btn-outline" onClick={() => useDailyWater(pet.id)}>💧 Free water</button>
                  )}
                  {inventory.length === 0 && <span className="sub">Visit the shop to buy food and toys.</span>}
                  {inventory.map((inv) => (
                    <button key={inv.itemKey} className="btn-outline" onClick={() => useItem(pet.id, inv.itemKey)}>
                      Use {catalog.find((c) => c.key === inv.itemKey)?.name ?? inv.itemKey} ({inv.quantity})
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {pets.length < 2 && (
            <div className="plain-card">
              <h3>Adopt a pet</h3>
              <div className="sub">You can have up to 2 pets.</div>
              <AdoptForm onAdopted={load} />
            </div>
          )}
        </>
      )}

      {tab === 'shop' && !loading && (
        <>
          <div className="plain-card">
            <button
              type="button"
              onClick={() => setShowGuide((v) => !v)}
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <h3>How to earn points</h3>
              <span style={{ color: 'var(--ink-light)', fontSize: 12 }}>{showGuide ? '▲' : '▼'}</span>
            </button>
            {showGuide && (
              <div style={{ marginTop: 10 }}>
                {POINTS_GUIDE.map(([title, body]) => (
                  <div key={title} style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{title}</div>
                    <div className="sub">{body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {catalog.map((item) => (
            <div className="plain-card" key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--blush)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {ITEM_ICONS[item.key] ?? '🎁'}
              </div>
              <div style={{ flex: 1 }}>
                <h3>{item.name}</h3>
                <div className="sub">{item.kind === 'food' ? 'Feeds growth' : 'Boosts happiness'} &middot; you have {invQty(item.key)}</div>
              </div>
              <button className="btn-outline" disabled={(user?.points ?? 0) < item.pointsCost} onClick={() => buy(item.key)}>
                {item.pointsCost} pts
              </button>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function AdoptForm({ onAdopted }: { onAdopted: () => void }) {
  const [species, setSpecies] = useState(PET_SPECIES[0].key);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/pets/adopt', { species, name: name.trim() });
      setName('');
      onAdopted();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '10px 0' }}>
        {PET_SPECIES.map((s) => (
          <button
            type="button"
            key={s.key}
            onClick={() => setSpecies(s.key)}
            style={{
              border: species === s.key ? '2px solid var(--rose)' : '0.5px solid var(--line)',
              borderRadius: 12,
              padding: 6,
              background: 'var(--card)',
              cursor: 'pointer'
            }}
          >
            <img src={petImageSrc(s.key, 0)} alt={s.label} style={{ width: '100%', borderRadius: '50%' }} />
            <div style={{ fontSize: 10.5, marginTop: 4 }}>{s.label}</div>
          </button>
        ))}
      </div>
      <label className="field-label">Name your pet</label>
      <input className="field-input" required value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
      {error && <p className="field-error">{error}</p>}
      <div className="form-row">
        <button type="submit" className="btn-solid" disabled={busy || !name.trim()}>
          <span className="shine" /><span className="label">{busy ? 'Adopting…' : 'Adopt'}</span>
        </button>
      </div>
    </form>
  );
}
