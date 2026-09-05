import React, { useEffect, useState } from 'react';
import { api, friendlyError } from '../api.js';

interface GrowthStatus {
  unlocked: boolean;
  referralCode: string;
  verifiedReferralCount: number;
  referralBatchSize: number;
  referralRewardsGranted: number;
  claimableReferralBatches: number;
  videoPromoGrantsUsed: number;
  videoPromoMaxGrants: number;
  videoPromoRemaining: number;
  pendingVideoSubmission: { id: string; videoUrl: string } | null;
  lastVideoSubmission: { id: string; videoUrl: string; status: string; rejectionReason: string | null } | null;
  membershipExpiresAt: string | null;
  isPlusActive: boolean;
}

export function GrowthPanel() {
  const [status, setStatus] = useState<GrowthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function load() {
    api.get('/api/growth/status').then(setStatus).catch((err) => setError(friendlyError(err)));
  }

  useEffect(load, []);

  async function submitVideo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/growth/submit-video', { videoUrl });
      setVideoUrl('');
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function claimReferralReward() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/growth/claim-referral-reward');
      load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    if (!status) return;
    const link = `${window.location.origin}?ref=${status.referralCode}`;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!status) return null;

  if (!status.unlocked) {
    return (
      <div className="plain-card">
        <h3>Grow &amp; earn — locked</h3>
        <div className="sub">Post 3 listings to unlock free Second Look Plus membership, either by sharing a TikTok or referring 3 friends.</div>
      </div>
    );
  }

  return (
    <div className="plain-card">
      <h3>Grow &amp; earn {status.isPlusActive && <span className="match-badge">Plus active</span>}</h3>
      <div className="sub">
        {status.isPlusActive && status.membershipExpiresAt
          ? `Free unlimited boosting until ${new Date(status.membershipExpiresAt).toLocaleDateString()}.`
          : 'No active membership right now — earn a free month below.'}
      </div>

      <div className="stitch" style={{ margin: '14px 0' }} />

      <h3 style={{ fontSize: 13 }}>Option A — Share a TikTok</h3>
      <div className="sub">{status.videoPromoRemaining} of {status.videoPromoMaxGrants} lifetime video rewards left.</div>
      {status.pendingVideoSubmission ? (
        <p className="discount-hint">Pending review: {status.pendingVideoSubmission.videoUrl}</p>
      ) : status.videoPromoRemaining > 0 ? (
        <form onSubmit={submitVideo} style={{ marginTop: 8 }}>
          <input
            required
            type="url"
            placeholder="Paste your TikTok video link"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            style={{ width: '100%', border: '0.5px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, background: 'var(--white)' }}
          />
          <div className="row">
            <button type="submit" className="btn-solid" disabled={busy}><span className="shine" /><span className="label">Submit for review</span></button>
          </div>
        </form>
      ) : (
        <p className="discount-hint">You've used all your video rewards.</p>
      )}
      {status.lastVideoSubmission?.status === 'rejected' && (
        <p className="field-error">Last submission was rejected: {status.lastVideoSubmission.rejectionReason}</p>
      )}

      <div className="stitch" style={{ margin: '14px 0' }} />

      <h3 style={{ fontSize: 13 }}>Option B — Refer 3 friends</h3>
      <div className="sub">
        Your code: <strong>{status.referralCode}</strong>{' '}
        <button type="button" onClick={copyLink} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--rose-dark)', textDecoration: 'underline' }}>
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>
      </div>
      <div className="sub">{status.verifiedReferralCount} verified friend{status.verifiedReferralCount === 1 ? '' : 's'} so far &middot; every {status.referralBatchSize} earns a free month, no limit.</div>
      {status.claimableReferralBatches > 0 && (
        <div className="row">
          <button className="btn-solid" disabled={busy} onClick={claimReferralReward}>
            <span className="shine" /><span className="label">Claim {status.claimableReferralBatches} free month{status.claimableReferralBatches > 1 ? 's' : ''}</span>
          </button>
        </div>
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
