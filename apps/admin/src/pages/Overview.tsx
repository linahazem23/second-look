import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { Pill } from '../Pill.js';

interface OverviewData {
  stats: Record<string, number>;
  ageDistribution: Record<string, number>;
  recentOrders: { id: string; buyer: string; seller: string; item: string; amount: number; escrowStatus: string }[];
}

const STAT_LABELS: Record<string, string> = {
  activeUsers: 'Active users',
  liveListings: 'Live listings',
  ordersThisWeek: 'Orders this week',
  openCases: 'Open moderation cases',
  pendingAppeals: 'Pending appeals',
  pendingReports: 'Reported listings',
  pendingKyc: 'Pending ID verification'
};

export function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/admin/overview').then(setData).catch((err) => setError(friendlyError(err)));
  }, []);

  return (
    <>
      <div className="page-head"><h1>Overview</h1><p>Snapshot of activity across Second Look</p></div>
      {error && <p className="login-err">{error}</p>}
      {!data && !error && <p>Loading…</p>}
      {data && (
        <>
          <div className="stat-grid">
            {Object.entries(STAT_LABELS).map(([key, label]) => (
              <div className="stat-card" key={key}>
                <div className="num">{data.stats[key] ?? 0}</div>
                <div className="label">{label}</div>
              </div>
            ))}
          </div>

          {Object.keys(data.ageDistribution).length > 0 && (
            <div className="panel">
              <div className="panel-title">Age distribution</div>
              <table>
                <tbody>
                  {Object.entries(data.ageDistribution).map(([bucket, count]) => (
                    <tr key={bucket}><td>{bucket}</td><td>{count} users</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="panel">
            <div className="panel-title">Recent orders</div>
            <table>
              <thead><tr><th>Order</th><th>Item</th><th>Buyer</th><th>Seller</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {data.recentOrders.length === 0 && <tr className="empty-row"><td colSpan={6}>No orders yet</td></tr>}
                {data.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id.slice(0, 8)}</td><td>{o.item}</td><td>{o.buyer}</td><td>{o.seller}</td>
                    <td>{o.amount} EGP</td><td><Pill value={o.escrowStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
