import React, { useEffect, useState } from 'react';

const API_BASE = (import.meta as any).env.VITE_API_BASE ?? 'http://localhost:4000';

interface ConsentInfo {
  minorFullName: string;
  minorAge: number | null;
  guardianName: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted: boolean;
}

async function fetchJson(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || 'Something went wrong.');
  return body;
}

// Public — no Second Look account. Reached only via the one-time link emailed
// to a minor's guardian at signup.
export function GuardianConsent({ token }: { token: string }) {
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [idUrl, setIdUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchJson(`/api/auth/guardian-consent/${token}`)
      .then(setInfo)
      .catch((err) => setLoadError(err.message));
  }, [token]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/auth/guardian-consent/${token}/upload`, { method: 'POST', body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Upload failed');
      setIdUrl(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await fetchJson(`/api/auth/guardian-consent/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreed: true })
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div id="onboarding">
        <div className="ob-body">
          <h1>Link not valid</h1>
          <p className="lead">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div id="onboarding">
        <div className="ob-body"><p className="lead">Loading…</p></div>
      </div>
    );
  }

  if (info.status === 'approved') {
    return (
      <div id="onboarding">
        <div className="ob-body">
          <h1>Already confirmed</h1>
          <p className="lead">You've already confirmed you're {info.minorFullName}'s guardian. Nothing else to do here.</p>
        </div>
      </div>
    );
  }

  if (done || info.submitted) {
    return (
      <div id="onboarding">
        <div className="ob-body">
          <h1>Submitted — thank you</h1>
          <p className="lead">
            A real person on the Second Look safety team will review this shortly. {info.minorFullName}'s account stays
            limited to browsing until then.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="onboarding">
      <div className="ob-body">
        <h1>Confirm you're {info.minorFullName}'s guardian</h1>
        <p className="lead">
          {info.minorFullName}{info.minorAge ? ` (${info.minorAge})` : ''} listed you as her guardian when signing up
          for Second Look, a women-only resale marketplace. To let her buy and sell, we need to confirm you're a real
          adult and okay being the contact point for her account.
        </p>

        <label>Upload a photo of your ID</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        {uploading && <p className="lead" style={{ fontSize: 12 }}>Uploading…</p>}
        {idUrl && <img src={idUrl} alt="Uploaded ID" style={{ marginTop: 8, width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }} />}

        <label className="ob-agree" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I confirm I am {info.minorFullName}'s guardian, I am 18 or older, and I agree to be the safety contact for
            her account if Second Look's team needs to reach someone about it.
          </span>
        </label>

        {error && <p className="ob-err">{error}</p>}

        <div className="ob-footer" style={{ padding: '16px 0 0' }}>
          <button disabled={!idUrl || !agreed || busy} onClick={handleSubmit}>
            {busy ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      </div>
    </div>
  );
}
