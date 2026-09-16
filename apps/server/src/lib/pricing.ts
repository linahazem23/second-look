// Funds the escrow/dispute/KYC machinery — charged to the buyer only, never
// deducted from what the seller receives. Lower-value orders get the cheaper
// rate so the fee never feels disproportionate on a small buy.
const BUYER_PROTECTION_FEE_TIER_THRESHOLD = 300;
const BUYER_PROTECTION_FEE_RATE_LOW = 0.03;
const BUYER_PROTECTION_FEE_RATE_HIGH = 0.05;

export function buyerProtectionFeeRate(itemPrice: number): number {
  return itemPrice < BUYER_PROTECTION_FEE_TIER_THRESHOLD ? BUYER_PROTECTION_FEE_RATE_LOW : BUYER_PROTECTION_FEE_RATE_HIGH;
}

export function buyerProtectionFee(itemPrice: number): number {
  return Math.round(itemPrice * buyerProtectionFeeRate(itemPrice) * 100) / 100;
}

// A "used" item priced too close to its original stops reading as a genuine
// resale — so each condition tier has a MINIMUM required discount. A seller
// can always discount further than this (a bigger markdown is always fine);
// this only caps how HIGH the price can be for a given condition.
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
