import React, { useEffect, useState } from 'react';
import { AREA_GROUPS, findNearestArea } from './constants.js';

/**
 * Detects the current neighborhood cluster from live geolocation. Falls back to a
 * manual dropdown of the same fixed cluster list if location access is denied,
 * unavailable, or times out — the area value itself is always one of AREAS either way.
 */
export function LocationAreaField({ value, onChange, allowAny }: { value: string; onChange: (area: string) => void; allowAny?: boolean }) {
  const [status, setStatus] = useState<'detecting' | 'detected' | 'manual'>('detecting');

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('manual');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(findNearestArea(pos.coords.latitude, pos.coords.longitude));
        setStatus('detected');
      },
      () => setStatus('manual'),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'detecting') {
    return <p className="discount-hint">Detecting your location…</p>;
  }

  if (status === 'detected') {
    return (
      <p className="discount-hint">
        📍 Near {value}
        <button type="button" onClick={() => setStatus('manual')} style={{ background: 'none', border: 'none', padding: 0, marginLeft: 8, fontSize: 11, color: 'var(--ink-light)', textDecoration: 'underline' }}>
          Change
        </button>
      </p>
    );
  }

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {allowAny && <option value="">Any area</option>}
      {!allowAny && <option value="" disabled>Select your area</option>}
      {AREA_GROUPS.map((g) => (
        <optgroup key={g.group} label={g.group}>
          {g.areas.map(([name]) => <option key={name} value={name}>{name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
