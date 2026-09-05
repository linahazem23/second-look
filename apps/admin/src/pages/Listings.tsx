import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Pill } from '../Pill.js';

interface AdminListing {
  id: string;
  title: string;
  category: string;
  price: number;
  status: string;
  seller: { fullName: string };
}

export function Listings() {
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get('/api/admin/listings').then((res) => setListings(res.listings)).catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, []);

  async function remove(id: string) {
    try {
      await api.post(`/api/admin/listings/${id}/remove`);
      load();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <>
      <div className="page-head"><h1>Listings</h1><p>All active and removed listings</p></div>
      {error && <p className="login-err">{error}</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Item</th><th>Seller</th><th>Category</th><th>Price</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {listings.length === 0 && !error && <tr className="empty-row"><td colSpan={6}>No listings yet</td></tr>}
            {listings.map((l) => (
              <tr key={l.id}>
                <td>{l.title}</td><td>{l.seller.fullName}</td><td>{l.category}</td><td>{l.price} EGP</td>
                <td><Pill value={l.status} /></td>
                <td>{l.status === 'Active' && <button className="btn ghost" onClick={() => remove(l.id)}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
