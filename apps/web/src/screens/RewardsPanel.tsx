import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.js';
import { api } from '../api.js';

interface CharmRow {
  id: string;
  key: string;
  label: string;
  description: string;
  icon: string;
  earned: boolean;
}

export function RewardsPanel() {
  const { user } = useAuth();
  const [charms, setCharms] = useState<CharmRow[]>([]);

  useEffect(() => {
    api.get('/api/auth/charms').then((res) => setCharms(res.charms)).catch(() => {});
  }, []);

  if (!user || charms.length === 0) return null;

  return (
    <div className="plain-card">
      <h3>Charms</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            {charms.map((c) => (
              <div
                key={c.id}
                title={c.earned ? c.description : `Locked — ${c.description}`}
                style={{
                  width: 62,
                  textAlign: 'center',
                  opacity: c.earned ? 1 : 0.35,
                  filter: c.earned ? 'none' : 'grayscale(1)'
                }}
              >
                <div style={{ fontSize: 24 }}>{c.icon}</div>
                <div style={{ fontSize: 9.5, color: 'var(--ink-light)', marginTop: 2, lineHeight: 1.2 }}>{c.label}</div>
              </div>
            ))}
      </div>
    </div>
  );
}
