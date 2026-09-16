import React, { useState } from 'react';
import { Icon } from '../Icon.js';
import { Want } from './Want.js';
import { Demand } from './Demand.js';

type SubView = 'want' | 'demand' | null;

export function WantHub() {
  const [view, setView] = useState<SubView>(null);

  if (view === 'want') {
    return (
      <>
        <div className="section-head">
          <button className="back-btn" onClick={() => setView(null)}><Icon name="arrowLeft" size={18} /></button>
          <div><h1 style={{ fontSize: 19 }}>Want</h1></div>
        </div>
        <Want />
      </>
    );
  }

  if (view === 'demand') {
    return (
      <>
        <div className="section-head">
          <button className="back-btn" onClick={() => setView(null)}><Icon name="arrowLeft" size={18} /></button>
          <div><h1 style={{ fontSize: 19 }}>Demand board</h1></div>
        </div>
        <Demand />
      </>
    );
  }

  return (
    <>
      <div className="section-head">
        <h1>Want &amp; Demand</h1>
        <p>Looking for something, or want to help someone find it?</p>
      </div>

      <button className="plain-card" style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }} onClick={() => setView('want')}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="want" size={15} /> Want</h3>
        <div className="sub">Post what you're looking for, and manage your own posted wants.</div>
      </button>

      <button className="plain-card" style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer' }} onClick={() => setView('demand')}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="demand" size={15} /> Demand board</h3>
        <div className="sub">See what other people nearby are looking for, and offer it if you have it.</div>
      </button>
    </>
  );
}
