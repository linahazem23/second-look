// One shared growth curve for every species — adding a species later is just
// new art at the same three stage keys, never new thresholds or logic.
const ADULT_THRESHOLD = 50;
const DELUXE_THRESHOLD = 150;

export function growthStageForFedPoints(fedPoints: number): number {
  if (fedPoints >= DELUXE_THRESHOLD) return 2;
  if (fedPoints >= ADULT_THRESHOLD) return 1;
  return 0;
}
