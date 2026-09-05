// Coarse keyword screen for harassment/abuse. Flags for human review; never auto-blocks.
const FLAGGED_PATTERNS: RegExp[] = [
  /\b(kill|hurt|threat(en)?|hunt you down)\b/i,
  /\b(scam|fraud|fake product)\b/i,
  /\b(bitch|whore|slut)\b/i,
  /\bharass/i
];

export function detectFlaggedKeyword(message: string): string | null {
  for (const pattern of FLAGGED_PATTERNS) {
    const match = message.match(pattern);
    if (match) return match[0];
  }
  return null;
}
