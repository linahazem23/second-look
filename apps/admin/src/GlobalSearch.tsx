import React, { useState } from 'react';
import { api } from './api.js';
import { Icon } from './Icon.js';

interface SearchResults {
  orders: { id: string }[];
  users: { id: string; fullName: string }[];
  moderationCases: { id: string; reason: string }[];
  reportedListings: { id: string; listing: { title: string } }[];
}

export function GlobalSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);

  async function runSearch(value: string) {
    setQ(value);
    if (!value.trim()) {
      setResults(null);
      setOpen(false);
      return;
    }
    const res = await api.get(`/api/admin/search?q=${encodeURIComponent(value)}`);
    setResults(res);
    setOpen(true);
  }

  const total = results ? results.orders.length + results.users.length + results.moderationCases.length + results.reportedListings.length : 0;

  return (
    <div className="search-wrap">
      <Icon name="search" size={14} />
      <input
        type="text"
        placeholder="Search order #, user, or seller name…"
        value={q}
        onChange={(e) => runSearch(e.target.value)}
        onFocus={() => q && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results && (
        <div id="search-results" className="open">
          {total === 0 && <div className="r"><span className="type">No matches</span></div>}
          {results.orders.map((o) => <div className="r" key={o.id}><span className="type">Order</span> {o.id.slice(0, 8)}</div>)}
          {results.users.map((u) => <div className="r" key={u.id}><span className="type">User</span> {u.fullName}</div>)}
          {results.moderationCases.map((c) => <div className="r" key={c.id}><span className="type">Case</span> {c.reason}</div>)}
          {results.reportedListings.map((r) => <div className="r" key={r.id}><span className="type">Reported listing</span> {r.listing.title}</div>)}
        </div>
      )}
    </div>
  );
}
