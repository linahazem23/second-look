import React, { useState } from 'react';
import { Icon } from '../Icon.js';
import { Community } from './Community.js';

type SubView = 'community' | 'momtalk' | null;

// Only ever rendered for a mother — everyone else goes straight to <Community />.
export function CommunityHub() {
  const [view, setView] = useState<SubView>(null);

  if (view === 'community') {
    return (
      <>
        <div className="section-head">
          <button className="back-btn" onClick={() => setView(null)}><Icon name="arrowLeft" size={18} /></button>
          <div><h1 style={{ fontSize: 19 }}>Community</h1></div>
        </div>
        <Community />
      </>
    );
  }

  if (view === 'momtalk') {
    return (
      <>
        <div className="section-head">
          <button className="back-btn" onClick={() => setView(null)}><Icon name="arrowLeft" size={18} /></button>
          <div><h1 style={{ fontSize: 19 }}>Mom Talk</h1></div>
        </div>
        <Community category="MomBaby" title="Mom Talk" />
      </>
    );
  }

  return (
    <>
      <div className="section-head">
        <h1>Community</h1>
        <p>Which space do you want to check out?</p>
      </div>

      <button className="plain-card" style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }} onClick={() => setView('community')}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="community" size={15} /> Community</h3>
        <div className="sub">Tips, product advice, and consultations open to everyone.</div>
      </button>

      <button className="plain-card" style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }} onClick={() => setView('momtalk')}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>🤍 Mom Talk</h3>
        <div className="sub">A space just for moms — hidden from everyone else.</div>
      </button>
    </>
  );
}
