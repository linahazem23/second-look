// A fixed set of area clusters covering greater Cairo/Giza neighborhoods plus every
// other Egyptian governorate's main city. Area must be a controlled vocabulary
// everywhere it's entered (signup, listings, want-requests) — otherwise free-text
// variants ("maadi" vs "Maadi" vs "New Maadi") would never match each other in
// filters, Explore's area clustering, or demand-notification matching.
export const AREA_GROUPS: { group: string; areas: [string, number, number][] }[] = [
  {
    group: 'Cairo & Giza',
    areas: [
      ['Maadi', 29.9603, 31.2569],
      ['Zamalek', 30.0571, 31.2243],
      ['Nasr City', 30.0561, 31.323],
      ['Heliopolis', 30.0808, 31.3272],
      ['Dokki', 30.0382, 31.2126],
      ['Mohandessin', 30.0575, 31.2001],
      ['New Cairo', 30.0074, 31.4913],
      ['6th of October', 29.9097, 30.9746],
      ['Sheikh Zayed', 30.0778, 30.9757],
      ['Downtown Cairo', 30.0444, 31.2357],
      ['Shubra', 30.1105, 31.244],
      ['Giza', 30.0131, 31.2089]
    ]
  },
  {
    group: 'Delta & Canal',
    areas: [
      ['Alexandria', 31.2001, 29.9187],
      ['Port Said', 31.2653, 32.3019],
      ['Suez', 29.9668, 32.5498],
      ['Ismailia', 30.5965, 32.2715],
      ['Mansoura', 31.0409, 31.3785],
      ['Tanta', 30.7865, 30.9985],
      ['Damanhur', 31.0341, 30.4682],
      ['Zagazig', 30.5877, 31.502],
      ['Banha', 30.4667, 31.1833],
      ['Damietta', 31.4165, 31.8133],
      ['Kafr El Sheikh', 31.1107, 30.9388]
    ]
  },
  {
    group: 'Upper Egypt',
    areas: [
      ['Fayoum', 29.3084, 30.8428],
      ['Beni Suef', 29.0661, 31.0994],
      ['Minya', 28.1099, 30.7503],
      ['Asyut', 27.1809, 31.1837],
      ['Sohag', 26.5569, 31.6948],
      ['Qena', 26.1551, 32.716],
      ['Luxor', 25.6872, 32.6396],
      ['Aswan', 24.0889, 32.8998]
    ]
  },
  {
    group: 'Red Sea, Sinai & Western Desert',
    areas: [
      ['Hurghada', 27.2579, 33.8116],
      ['Sharm El Sheikh', 27.9158, 34.33],
      ['Arish', 31.1316, 33.7984],
      ['Marsa Matruh', 31.3543, 27.2373],
      ['Kharga', 25.4515, 30.5467]
    ]
  }
];

export const AREAS = AREA_GROUPS.flatMap((g) => g.areas.map(([name]) => name));

const AREA_COORDS: Record<string, [number, number]> = Object.fromEntries(
  AREA_GROUPS.flatMap((g) => g.areas.map(([name, lat, lon]) => [name, [lat, lon]]))
);

function haversineDistanceKm(a: [number, number], b: [number, number]) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function findNearestArea(lat: number, lon: number): string {
  let best = AREAS[0];
  let bestDist = Infinity;
  for (const area of AREAS) {
    const dist = haversineDistanceKm([lat, lon], AREA_COORDS[area]);
    if (dist < bestDist) {
      bestDist = dist;
      best = area;
    }
  }
  return best;
}
