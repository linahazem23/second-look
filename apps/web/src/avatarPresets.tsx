// Original, non-Disney preset avatars — a pastel circle + emoji, not commissioned
// character art. Kept deliberately simple since there's no illustration pipeline.
export interface AvatarPreset {
  key: string;
  label: string;
  emoji: string;
  bg: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { key: 'bunny', label: 'Bunny', emoji: '🐰', bg: '#FBEEF2' },
  { key: 'cat', label: 'Cat', emoji: '🐱', bg: '#F6D9E3' },
  { key: 'fox', label: 'Fox', emoji: '🦊', bg: '#FFE8CC' },
  { key: 'panda', label: 'Panda', emoji: '🐼', bg: '#E9DCE0' },
  { key: 'koala', label: 'Koala', emoji: '🐨', bg: '#D9E8E3' },
  { key: 'owl', label: 'Owl', emoji: '🦉', bg: '#EFE3D0' },
  { key: 'unicorn', label: 'Unicorn', emoji: '🦄', bg: '#E3D9F0' },
  { key: 'penguin', label: 'Penguin', emoji: '🐧', bg: '#D9E3F0' },
  { key: 'deer', label: 'Deer', emoji: '🦌', bg: '#F0E3D9' },
  { key: 'butterfly', label: 'Butterfly', emoji: '🦋', bg: '#F0D9E8' }
];

export function findAvatarPreset(key: string | null | undefined): AvatarPreset | undefined {
  return AVATAR_PRESETS.find((p) => p.key === key);
}
