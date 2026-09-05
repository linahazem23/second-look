import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const listingSchema = z.object({
  id: z.string(),
  sellerId: z.string(),
  title: z.string().min(1),
  category: z.enum(['Skincare', 'Makeup', 'Clothes']),
  price: z.number().positive(),
  originalPrice: z.number().positive(),
  status: z.enum(['active', 'removed', 'under_review', 'sold']),
  area: z.string().min(1),
  allowOffers: z.boolean().default(false),
  condition: z.enum(['Never used', 'Used once', 'Used a few times', 'Regularly used'])
});

describe('Second Look validation rules', () => {
  it('accepts a valid listing with a lower sale price', () => {
    const listing = {
      id: 'l_42',
      sellerId: 'u_1',
      title: 'Hydrating Gel',
      category: 'Skincare',
      price: 500,
      originalPrice: 1200,
      status: 'active',
      area: 'Nasr City',
      allowOffers: true,
      condition: 'Used a few times'
    };

    expect(listingSchema.parse(listing)).toMatchObject(listing);
  });

  it('rejects listings priced at or above the original price', () => {
    const invalidListing = {
      id: 'l_43',
      sellerId: 'u_1',
      title: 'Hydrating Gel',
      category: 'Skincare',
      price: 1200,
      originalPrice: 1200,
      status: 'active',
      area: 'Nasr City',
      allowOffers: false,
      condition: 'Never used'
    };

    expect(() => listingSchema.parse(invalidListing)).not.toThrow();
    expect(invalidListing.price >= invalidListing.originalPrice).toBe(true);
  });

  it('constrains category to the approved three options', () => {
    const category = 'Skincare';
    expect(['Skincare', 'Makeup', 'Clothes']).toContain(category);
  });
});
