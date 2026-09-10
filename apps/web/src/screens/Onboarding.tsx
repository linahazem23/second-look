import React, { useRef, useState } from 'react';
import { api, friendlyError } from '../api.js';
import { uploadFile } from '../ImageUpload.js';

const GUIDELINE_SLIDES = [
  {
    title: 'Second Look is women-only',
    body: 'Every member is identity-verified. Be part of keeping this space safe and honest.'
  },
  {
    title: 'Chats may be reviewed',
    body: 'For everyone’s safety, our moderation team can review conversations at any time.'
  },
  {
    title: 'Be honest in listings and reviews',
    body: 'Describe items accurately, and only review real, completed orders.'
  },
  {
    title: 'Report, don’t retaliate',
    body: 'If something feels off, report it. Harassment or threats lead to an immediate block.'
  }
];

function DocUploadButton({ label, url, busy, onSelect }: { label: string; url: string | null; busy: boolean; onSelect: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        className="btn-outline"
        style={{ width: '100%' }}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {url ? `✓ ${label} added — tap to replace` : `Upload ${label}`}
      </button>
      {url && <img src={url} alt={label} style={{ marginTop: 8, width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }} />}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function KycGate({ onDone }: { onDone: () => void }) {
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<'id' | 'selfie' | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kycStatus: string; verifiedFemale: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(kind: 'id' | 'selfie', file: File) {
    setUploadingDoc(kind);
    setError(null);
    try {
      const url = await uploadFile(file);
      if (kind === 'id') setIdDocumentUrl(url);
      else setSelfieUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingDoc(null);
    }
  }

  async function handleVerify() {
    if (!idDocumentUrl || !selfieUrl) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/auth/kyc/submit', { idDocumentUrl, selfieUrl });
      setResult(res);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="onboarding">
      <div className="ob-body">
        <div className="ob-icon-circle">
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: 18 }}>ID</span>
        </div>
        <h1>Verify it's you</h1>
        <p className="lead">
          We check a government ID and a live selfie to confirm every member is a real, verified woman. This keeps
          Second Look safe for everyone.
        </p>
        {!result && (
          <>
            <DocUploadButton label="a photo of your ID" url={idDocumentUrl} busy={uploadingDoc === 'id'} onSelect={(f) => handleUpload('id', f)} />
            <DocUploadButton label="a selfie" url={selfieUrl} busy={uploadingDoc === 'selfie'} onSelect={(f) => handleUpload('selfie', f)} />
            <p className="lead" style={{ marginTop: 18, fontSize: 12.5 }}>
              A real person on our team reviews every submission — this usually takes a short while.
            </p>
            {error && <p className="ob-err">{error}</p>}
          </>
        )}
        {result && (
          <p className="lead" style={{ marginTop: 18 }}>
            Your documents were sent for manual review. This usually takes a short while — you can browse in the meantime.
          </p>
        )}
      </div>
      <div className="ob-footer">
        {!result ? (
          <button disabled={busy || !idDocumentUrl || !selfieUrl} onClick={handleVerify}>{busy ? 'Submitting…' : 'Submit for review'}</button>
        ) : (
          <button onClick={onDone}>Continue</button>
        )}
      </div>
    </div>
  );
}

const SKIN_TYPES = ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive'];
const HAIR_TYPES = ['Straight', 'Wavy', 'Curly', 'Coily'];
const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];

export function ProfileQuizGate({ onDone }: { onDone: () => void }) {
  const [skinType, setSkinType] = useState<string | null>(null);
  const [hairType, setHairType] = useState<string | null>(null);
  const [clothingSize, setClothingSize] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!skinType || !hairType) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/auth/profile-quiz', { skinType, hairType, clothingSize: clothingSize ?? undefined });
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="onboarding">
      <div className="ob-body">
        <div className="ob-icon-circle">
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: 18 }}>✦</span>
        </div>
        <h1>Tell us about you</h1>
        <p className="lead">This helps us surface listings and matches that actually fit you.</p>

        <label>Skin type</label>
        <div className="ob-options">
          {SKIN_TYPES.map((t) => (
            <button key={t} className={skinType === t ? 'picked' : ''} onClick={() => setSkinType(t)}>{t}</button>
          ))}
        </div>

        <label style={{ marginTop: 16 }}>Hair type</label>
        <div className="ob-options">
          {HAIR_TYPES.map((t) => (
            <button key={t} className={hairType === t ? 'picked' : ''} onClick={() => setHairType(t)}>{t}</button>
          ))}
        </div>

        <label style={{ marginTop: 16 }}>Clothing size (optional)</label>
        <div className="ob-options" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {CLOTHING_SIZES.map((s) => (
            <button key={s} style={{ flex: '0 0 auto', padding: '8px 14px' }} className={clothingSize === s ? 'picked' : ''} onClick={() => setClothingSize(clothingSize === s ? null : s)}>{s}</button>
          ))}
        </div>
        {error && <p className="ob-err">{error}</p>}
      </div>
      <div className="ob-footer">
        <button disabled={!skinType || !hairType || busy} onClick={handleContinue}>{busy ? 'Saving…' : 'Continue'}</button>
      </div>
    </div>
  );
}

export const HOW_TO_STEPS = [
  'Get verified once (ID + selfie) — this unlocks buying, selling, and posting.',
  'Browse Skincare, Makeup, or Clothes on Home, or check Explore for listings near you.',
  'Found something? Tap Buy to start an order — your payment is held safely until you confirm delivery.',
  'Selling? Tap "+ Sell an item", add photos, a price below the original, and your area.',
  'Chat with the buyer or seller to arrange meetup or delivery — it stays saved on that order.',
  'Something feels wrong? Report it from the listing, the chat, or message Support any time.'
];

export function GuidelinesGate({ onDone }: { onDone: () => void }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [agreedThisSlide, setAgreedThisSlide] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNext() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.post('/api/auth/guidelines/accept-slide', { slideIndex });
      setAgreedThisSlide(false);
      if (res.allFourSlidesComplete) {
        setShowHowTo(true);
      } else {
        setSlideIndex((i) => i + 1);
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (showHowTo) {
    return (
      <div id="onboarding">
        <div className="ob-body">
          <div className="ob-icon-circle">
            <span style={{ fontFamily: 'Fraunces, serif', fontSize: 18 }}>✓</span>
          </div>
          <h1>How Second Look works</h1>
          <ol className="how-to-list">
            {HOW_TO_STEPS.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
          <p className="lead" style={{ marginTop: 16, fontSize: 12.5 }}>
            Need help any time? Open Chat &rarr; Second Look Support to reach us directly.
          </p>
        </div>
        <div className="ob-footer">
          <button onClick={onDone}>Let's go</button>
        </div>
      </div>
    );
  }

  const slide = GUIDELINE_SLIDES[slideIndex];

  return (
    <div id="onboarding">
      <div className="ob-dots">
        {GUIDELINE_SLIDES.map((_, i) => (
          <div key={i} className={i <= slideIndex ? 'on' : ''} />
        ))}
      </div>
      <div className="ob-body">
        <div className="ob-icon-circle">
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: 18 }}>{slideIndex + 1}</span>
        </div>
        <h1>{slide.title}</h1>
        <p className="lead">{slide.body}</p>
        <label className="ob-agree">
          <input type="checkbox" checked={agreedThisSlide} onChange={(e) => setAgreedThisSlide(e.target.checked)} />
          <span>I have read and agree to this guideline.</span>
        </label>
        {error && <p className="ob-err">{error}</p>}
      </div>
      <div className="ob-footer">
        <button disabled={!agreedThisSlide || busy} onClick={handleNext}>
          {slideIndex === GUIDELINE_SLIDES.length - 1 ? "I'm ready" : 'Next'}
        </button>
      </div>
    </div>
  );
}
