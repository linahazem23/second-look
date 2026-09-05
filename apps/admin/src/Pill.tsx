const PREFIX_TONE: [string, 'ok' | 'warn' | 'danger' | 'neutral'][] = [
  ['Blocked', 'danger'],
  ['Restricted', 'danger'],
  ['Removed', 'danger'],
  ['removed', 'danger'],
  ['Disputed', 'danger'],
  ['uphold', 'danger'],
  ['Active', 'ok'],
  ['Good', 'ok'],
  ['PaymentReleased', 'ok'],
  ['Restored', 'ok'],
  ['restored', 'ok'],
  ['overturn', 'ok'],
  ['coached', 'ok'],
  ['approved', 'ok'],
  ['UnderReview', 'warn'],
  ['under_review', 'warn'],
  ['open', 'warn'],
  ['pending', 'warn'],
  ['manual_review', 'warn'],
  ['InEscrow', 'neutral'],
  ['resolved', 'neutral']
];

export function Pill({ value }: { value: string }) {
  const tone = PREFIX_TONE.find(([prefix]) => value.startsWith(prefix))?.[1] ?? 'neutral';
  return <span className={`pill ${tone}`}>{value}</span>;
}
