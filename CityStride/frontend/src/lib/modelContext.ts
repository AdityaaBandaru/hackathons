import profiles from "./data/cityProfiles.json";
import areas from "./data/pedestrianAreas.json";
import type { Project3D } from "./types";
export const planningAreas = areas;
export type ModelForm = "rail-walkway" | "commuter" | "metro" | "light-rail" | "shuttle";
/** Illustrative design vocabulary inferred exclusively from supplied context. */
export function modelContext(project: Project3D) {
  const profile = profiles.find((p) => p.cityId === project.cityId);
  const area = areas.find((a) => a.areaId === project.areaId && a.cityId === project.cityId);
  if (!profile) throw new Error(`No city context for ${project.projectId}.`);
  const cityText = `${profile.venueAccessType} ${profile.transferStructure} ${profile.dominantBottleneck}`;
  const anchorText = `${project.exactAreaName} ${area?.areaType ?? ""}`;
  const recipes = [
    { match: /Meadowlands/, id: "meadowlands-transfer", bays: 6, shelter: "paired", portal: true },
    { match: /Foxborough/, id: "foxboro-event-rail", bays: 4, shelter: "linear", portal: true },
    { match: /Arlington/, id: "arlington-curb-transfer", bays: 5, shelter: "sawtooth", portal: false },
    { match: /METRORail/, id: "houston-rail-crossing", bays: 7, shelter: "paired", portal: false },
    { match: /Truman/, id: "arrowhead-bus-dispatch", bays: 8, shelter: "sawtooth", portal: false },
    { match: /Inglewood/, id: "inglewood-connector", bays: 3, shelter: "interchange", portal: false },
    { match: /Miami Gardens/, id: "miami-shaded-transfer", bays: 9, shelter: "shade", portal: false },
    { match: /rail terminus/, id: "philadelphia-terminal-egress", bays: 5, shelter: "linear", portal: true },
    { match: /Santa Clara/, id: "santa-clara-vta-queue", bays: 4, shelter: "interchange", portal: false },
    { match: /next to Link/, id: "seattle-link-access", bays: 6, shelter: "linear", portal: false },
    { match: /two nearby rail/, id: "atlanta-station-distribution", bays: 3, shelter: "paired", portal: true },
  ];
  const recipe = recipes.find((r) => r.match.test(cityText));
  if (!recipe) throw new Error(`Unsupported city context for ${project.projectId}.`);
  let form: ModelForm = "shuttle";
  if (/Meadowlands Rail Station/.test(anchorText)) form = "rail-walkway";
  else if (/event_rail_station/.test(anchorText)) form = "commuter";
  else if (/light_rail_station|rail_shuttle_interchange/.test(anchorText)) form = "light-rail";
  else if (/metro_terminal|rail_station_walkshed/.test(anchorText)) form = "metro";
  return { ...recipe, form, areaType: area?.areaType ?? "unspecified", profile,
    sheltered: /heat|shade|shelter/i.test(`${cityText} ${project.designDescription}`),
    accessible: /accessible|circulation|entry|platform/i.test(project.designDescription) };
}
