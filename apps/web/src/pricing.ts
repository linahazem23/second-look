// Mirrors the floor enforced server-side in listings.routes.ts — a barely-used
// item discounted too steeply (once the buyer protection fee lands on top)
// stops feeling like a real commitment to buy.
export const MAX_DISCOUNT_BY_CONDITION: Record<string, number> = {
  NeverUsed: 0.05,
  UsedOnce: 0.07,
  UsedAFewTimes: 0.15,
  RegularlyUsed: 0.18
};

export function minAllowedPrice(originalPrice: number, condition: string): number {
  const maxDiscount = MAX_DISCOUNT_BY_CONDITION[condition] ?? 0.05;
  return originalPrice * (1 - maxDiscount);
}
