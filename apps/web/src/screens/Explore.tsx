import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Icon, categoryIcon } from '../Icon.js';

interface AreaCount { area: string; count: number }
interface Listing {
  id: string; title: string; category: string; price: number; originalPrice: number; percentOff: number; images: string[];
}

function pseudoPosition(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  const x = 15 + (hash % 70);
  const y = 15 + ((hash * 7) % 65);
  return { x: `${x}%`, y: `${y}%` };
}

export function Explore() {
  const [view, setView] = useState<'map' | 'list'>('map');
  const [areas, setAreas] = useState<AreaCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openArea, setOpenArea] = useState<string | null>(null);
  const [areaListings, setAreaListings] = useState<Listing[]>([]);
  const [areaLoading, setAreaLoading] = useState(false);

  useEffect(() => {
    api.get('/api/listings/areas')
      .then((res) => setAreas(res.areas))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!openArea) return;
    setAreaLoading(true);
    api.get(`/api/listings?area=${encodeURIComponent(openArea)}`)
      .then((res) => setAreaListings(res.listings))
      .catch((err) => setError(friendlyError(err)))
      .finally(() => setAreaLoading(false));
  }, [openArea]);

  if (openArea) {
    const count = areas.find((a) => a.area === openArea)?.count ?? areaListings.length;
    return (
      <>
        <div className="section-head">
          <button className="back-btn" onClick={() => setOpenArea(null)}><Icon name="arrowLeft" size={18} /></button>
          <div>
            <h1 style={{ fontSize: 19 }}>{openArea}</h1>
            <p>{count} active listing{count === 1 ? '' : 's'}</p>
          </div>
        </div>
        {areaLoading && <div className="empty-state">Loading…</div>}
        {!areaLoading && (
          <div className="grid">
            {areaListings.map((item) => (
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
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="section-head">
        <h1>Explore</h1>
        <p>Browse listings by neighborhood</p>
      </div>
      <div className="view-toggle">
        <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Map</button>
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
      </div>

      {loading && <div className="empty-state">Loading areas…</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && areas.length === 0 && <div className="empty-state">No active listings anywhere yet.</div>}

      {!loading && !error && view === 'map' && areas.length > 0 && (
        <div className="map-wrap">
          {areas.map((a) => {
            const pos = pseudoPosition(a.area);
            return (
              <button key={a.area} className="pin" style={{ left: pos.x, top: pos.y }} onClick={() => setOpenArea(a.area)}>
                <div className="dot"><span>{a.count}</span></div>
                <div className="label">{a.area}</div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && !error && view === 'list' && areas.map((a) => (
        <button key={a.area} className="area-row" onClick={() => setOpenArea(a.area)}>
          <span>{a.area}</span>
          <span className="count">{a.count} active</span>
        </button>
      ))}
    </>
  );
}
