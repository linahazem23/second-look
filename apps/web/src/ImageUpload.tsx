import React, { useRef, useState } from 'react';
import { getToken } from './api.js';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';
const MAX_IMAGES = 6;

export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? 'Upload failed');
  return body.url as string;
}

// Single-photo upload, kept for callers that only ever need one image (e.g. avatars).
export function ImageUpload({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {value ? (
        <div className="photo-thumb">
          <img src={value} alt="Uploaded" />
          <button type="button" className="photo-remove" onClick={() => onChange(null)}>×</button>
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

// Multi-photo upload for listings — every photo renders in the same square crop
// so the grid stays consistent regardless of the source image's shape.
export function MultiImageUpload({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList) {
    const room = MAX_IMAGES - value.length;
    const toUpload = Array.from(files).slice(0, room);
    if (toUpload.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const urls = await Promise.all(toUpload.map(uploadFile));
      onChange([...value, ...urls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  function remove(url: string) {
    onChange(value.filter((u) => u !== url));
  }

  return (
    <div>
      <div className="photo-grid">
        {value.map((url) => (
          <div className="photo-thumb" key={url}>
            <img src={url} alt="Uploaded" />
            <button type="button" className="photo-remove" onClick={() => remove(url)}>×</button>
          </div>
        ))}
        {value.length < MAX_IMAGES && (
          <button type="button" className="photo-chip photo-chip-grid" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? 'Uploading…' : `+ Add photo`}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <p className="discount-hint">{value.length}/{MAX_IMAGES} photos &middot; square crop, matching how they'll appear in listings</p>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
