/**
 * The 11 host-region IDs are fixed by the seed bundle, so the city evidence
 * route is pre-rendered for exactly those IDs -- which is what a static
 * export (GitHub Pages) needs, and means an unknown ID is a plain 404 rather
 * than a page that would ask the API and be told the same thing.
 */
const HOST_REGION_IDS = [
  "atlanta", "boston", "dallas", "houston", "kansas-city", "los-angeles",
  "miami", "nynj", "philadelphia", "seattle", "sf-bay",
];

export const dynamicParams = false;

export function generateStaticParams() {
  return HOST_REGION_IDS.map((cityId) => ({ cityId }));
}

export default function CityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
