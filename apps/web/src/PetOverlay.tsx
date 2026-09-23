import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { petImageSrc } from './petPresets.js';

interface Pet {
  id: string;
  species: string;
  growthStage: number;
}

/** Ambient companion — the first adopted pet wanders across the bottom of the screen; tap opens the Pets screen. */
export function PetOverlay({ onOpen }: { onOpen: () => void }) {
  const [pet, setPet] = useState<Pet | null>(null);

  useEffect(() => {
    api.get('/api/pets/mine').then((res) => setPet(res.pets[0] ?? null)).catch(() => {});
  }, []);

  if (!pet) return null;

  return (
    <button className="pet-overlay" onClick={onOpen} aria-label="Open your pets">
      <img src={petImageSrc(pet.species, pet.growthStage)} alt="" />
    </button>
  );
}
