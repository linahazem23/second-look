// Mirrors the ceiling enforced server-side in listings.routes.ts — a "used" item
// priced too close to its original stops reading as a genuine resale, so each
// condition tier has a minimum required discount. A seller can always discount
// further than this; it only caps how high the price can be.
export const MIN_DISCOUNT_BY_CONDITION: Record<string, number> = {
  NeverUsed: 0.05,
  UsedOnce: 0.07,
  UsedAFewTimes: 0.15,
  RegularlyUsed: 0.18
};

export function maxAllowedPrice(originalPrice: number, condition: string): number {
  const minDiscount = MIN_DISCOUNT_BY_CONDITION[condition] ?? 0.05;
  return originalPrice * (1 - minDiscount);
}
