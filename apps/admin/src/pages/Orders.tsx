import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Pill } from '../Pill.js';

interface AdminOrder {
  id: string;
  amount: number;
  deliveryMethod: string;
  escrowStatus: string;
  listing: { title: string };
  buyer: { fullName: string };
  seller: { fullName: string };
  trackingLinks: { url: string }[];
}

export function Orders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/admin/orders').then((res) => setOrders(res.orders)).catch((err) => setError(friendlyError(err)));
  }, []);

  return (
    <>
      <div className="page-head"><h1>Orders</h1><p>Escrow status and delivery method per order</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Order</th><th>Item</th><th>Buyer</th><th>Seller</th><th>Amount</th><th>Delivery</th><th>Tracking</th><th>Status</th></tr></thead>
          <tbody>
            {orders.length === 0 && !error && <tr className="empty-row"><td colSpan={8}>No orders yet</td></tr>}
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.id.slice(0, 8)}</td><td>{o.listing.title}</td><td>{o.buyer.fullName}</td><td>{o.seller.fullName}</td>
                <td>{o.amount} EGP</td><td>{o.deliveryMethod}</td>
                <td>{o.trackingLinks.length > 0 ? 'On file' : '—'}</td>
                <td><Pill value={o.escrowStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
