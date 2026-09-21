import React, { useState } from 'react';
import { Icon } from '../Icon.js';
import { Reviews } from './Reviews.js';

type SubView = 'reviews' | 'momreviews' | null;

// Only ever rendered for a mother — everyone else goes straight to <Reviews />.
export function ReviewsHub() {
  const [view, setView] = useState<SubView>(null);

  if (view === 'reviews') {
    return (
      <>
        <div className="section-head">
          <button className="back-btn" onClick={() => setView(null)}><Icon name="arrowLeft" size={18} /></button>
          <div><h1 style={{ fontSize: 19 }}>Reviews</h1></div>
        </div>
        <Reviews />
      </>
    );
  }

  if (view === 'momreviews') {
    return (
      <>
        <div className="section-head">
          <button className="back-btn" onClick={() => setView(null)}><Icon name="arrowLeft" size={18} /></button>
          <div><h1 style={{ fontSize: 19 }}>Mom Reviews</h1></div>
        </div>
        <Reviews category="MomBaby" title="Mom Reviews" />
      </>
    );
  }

  return (
    <>
      <div className="section-head">
        <h1>Reviews</h1>
        <p>Which reviews do you want to check out?</p>
      </div>

      <button className="plain-card" style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }} onClick={() => setView('reviews')}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="star" size={15} /> Reviews</h3>
        <div className="sub">Product reviews and trust ratings, open to everyone.</div>
      </button>

      <button className="plain-card" style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }} onClick={() => setView('momreviews')}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>🤍 Mom Reviews</h3>
        <div className="sub">Mom & Baby product reviews — hidden from everyone else.</div>
      </button>
    </>
  );
}
