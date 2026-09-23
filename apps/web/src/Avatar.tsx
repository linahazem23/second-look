import React from 'react';
import { findAvatarPreset } from './avatarPresets.js';
import { displayName } from './identity.js';

interface AvatarUser {
  fullName: string;
  username?: string | null;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
}

/** Uploaded photo takes precedence over a chosen preset; neither falls back to initials. */
export function Avatar({ user, size = 36 }: { user: AvatarUser; size?: number }) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  };

  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={displayName(user)} style={{ ...style, objectFit: 'cover' }} />;
  }

  const preset = findAvatarPreset(user.avatarPreset);
  if (preset) {
    return (
      <div style={{ ...style, background: preset.bg, fontSize: size * 0.55 }} title={preset.label}>
        {preset.emoji}
      </div>
    );
  }

  const initial = displayName(user).charAt(0).toUpperCase();
  return (
    <div style={{ ...style, background: 'var(--rose-soft)', color: 'var(--rose-dark)', fontSize: size * 0.42, fontWeight: 700 }}>
      {initial}
    </div>
  );
}
