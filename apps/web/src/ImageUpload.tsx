import React, { useRef, useState } from 'react';
import { getToken } from './api.js';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

export function ImageUpload({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Upload failed');
      onChange(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {value ? (
        <div style={{ position: 'relative', width: 96, height: 96 }}>
          <img src={value} alt="Uploaded" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '0.5px solid var(--line)' }} />
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--ink)', color: '#fff', border: 'none', fontSize: 11, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      ) : (
        <button type="button" className="photo-chip" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : '+ Add photo'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
