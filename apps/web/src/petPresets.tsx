// Real illustrated art (Canva-generated, original — not stock or licensed characters),
// one shared growth-stage system across every species: baby -> adult -> deluxe,
// selected by how many points have been spent feeding a pet. Adding a new species
// later is just three new image files at these same paths, not new code.
export interface PetSpeciesInfo {
  key: string;
  label: string;
}

export const PET_SPECIES: PetSpeciesInfo[] = [
  { key: 'puppy', label: 'Puppy' },
  { key: 'kitten', label: 'Kitten' },
  { key: 'otter', label: 'Otter' },
  { key: 'duckling', label: 'Duckling' },
  { key: 'hamster', label: 'Hamster' },
  { key: 'turtle', label: 'Turtle' },
  { key: 'dolphin', label: 'Dolphin' },
  { key: 'frog', label: 'Frog' }
];

const STAGE_KEYS = ['baby', 'adult', 'deluxe'] as const;

export function petImageSrc(species: string, growthStage: number): string {
  const stage = STAGE_KEYS[Math.max(0, Math.min(2, growthStage))];
  return `/pets/${species}-${stage}.jpg`;
}

export function speciesLabel(species: string): string {
  return PET_SPECIES.find((s) => s.key === species)?.label ?? species;
}

// A member's own uploaded photo takes precedence over the illustrated
// species/stage art — same precedence order as Avatar.tsx's avatarUrl over avatarPreset.
export function petDisplayImage(pet: { photoUrl?: string | null; species: string; growthStage: number }): string {
  return pet.photoUrl ?? petImageSrc(pet.species, pet.growthStage);
}
