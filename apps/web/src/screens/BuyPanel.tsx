import React, { useState } from 'react';
import { api, friendlyError } from '../api.js';

const DELIVERY_METHODS = [
  { value: 'Meetup', label: 'Meetup', note: 'Arrange to meet in your shared area' },
  { value: 'UberCourier', label: 'Uber Courier', note: 'Book directly with Uber, share the tracking link in chat' },
  { value: 'InDrive', label: 'inDrive Delivery', note: 'Book directly with inDrive, share the tracking link in chat' }
];

export interface BuyListing {
  id: string;
  title: string;
  price: number;
  seller: { id: string; fullName: string };
}

export function BuyPanel({ listing, onClose, onBought }: { listing: BuyListing; onClose: () => void; onBought: (orderId: string) => void }) {
  const [deliveryMethod, setDeliveryMethod] = useState('Meetup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/orders', { listingId: listing.id, deliveryMethod });
      onBought(res.order.id);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="post-form" style={{ margin: '0 18px 16px' }}>
      <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 14.5 }}>Buy "{listing.title}"</h3>
      <div className="sub">{listing.price} EGP &middot; from {listing.seller.fullName}</div>
      <label>Delivery method</label>
      <div className="delivery-pills">
        {DELIVERY_METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            className={`delivery-pill ${deliveryMethod === m.value ? 'active' : ''}`}
            onClick={() => setDeliveryMethod(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="discount-hint">{DELIVERY_METHODS.find((m) => m.value === deliveryMethod)?.note}</p>
      {error && <p className="field-error">{error}</p>}
      <div className="form-row">
        <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-solid" disabled={busy} onClick={handleBuy}>
          <span className="shine" /><span className="label">{busy ? 'Placing order…' : 'Pay & buy'}</span>
        </button>
      </div>
    </div>
  );
}
