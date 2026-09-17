import * as THREE from "three";
import type { Project3D } from "./types";
import { studioDimensions } from "./studio";
import { modelContext } from "./modelContext";

/** Reusable, metre-based concept assets. No external textures or model URLs. */
export function buildProjectModel(project: Project3D, options: { fullLength?: boolean } = {}): THREE.Group {
  const dimensions = studioDimensions(project);
  const { width: w, height: h, fullLength } = dimensions;
  const l = options.fullLength ? fullLength : dimensions.length;
  const isSection = !options.fullLength && dimensions.isSection;
  const context = modelContext(project);
  const group = new THREE.Group();
  group.name = project.projectId;
  group.userData = {
    projectId: project.projectId, phase: project.phase,
    cityId: project.cityId, exactAreaName: project.exactAreaName,
    implementationStatus: project.implementationStatus, spatialPrecision: project.spatialPrecision,
    designDescription: project.designDescription, areaType: context.areaType,
    modelVariant: `${context.id}:${context.form}:${context.shelter}`,
    variantBasis: `${context.profile.venueAccessType}; ${context.profile.transferStructure}; ${project.exactAreaName}`,
    evidenceClass: project.evidenceClass, sourceUrl: project.sourceUrl,
    units: "metres", fullLengthM: fullLength, displayedLengthM: l,
    widthM: w, heightM: h, isSection,
    geometryBasis: "Recorded dimension envelope; architectural details illustrative, not surveyed.",
  };
  const permanent = project.phase === "permanent";
  const colors = {
    accent: permanent ? "#348bfa" : "#ffb547",
    structure: permanent ? "#e1e9ef" : "#cbd6de",
    dark: "#243c4c", glass: "#527d90", surface: "#3a4d5a",
  };
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  function material(color: string, metalness = 0.05, roughness = 0.65) {
    const key = `${color}:${metalness}:${roughness}`;
    if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
    return materialCache.get(key)!;
  }
  function box(name: string, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, color: string, metalness = 0.05) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material(color, metalness));
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function cylinder(name: string, x: number, z: number, radius: number, height: number, color: string) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 12), material(color, 0.3));
    mesh.name = name;
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }
  // x is the length axis, y up. All details stay inside the recorded envelope.
  if (project.category === "station") {
    const rail = context.form !== "shuttle";
    const commuter = context.form === "commuter" || context.form === "rail-walkway";
    const platformZ = rail ? w * 0.08 : 0;
    box("Station forecourt", 0, h * 0.015, 0, l, h * 0.03, w, colors.surface);
    box(rail ? "Passenger platform" : "Shuttle passenger island", 0, h * 0.06, platformZ, l * 0.94, h * 0.08, w * 0.48, colors.structure);
    if (rail) {
      for (const z of [-0.38, -0.29]) box("Illustrative rail", 0, h * 0.035, w * z, l * 0.96, h * 0.015, w * 0.012, colors.dark, 0.5);
      for (let i = 0; i < 24; i++) box("Track sleeper", (-0.46 + i * 0.04) * l, h * 0.022, -w * 0.335, l * 0.012, h * 0.01, w * 0.19, colors.dark);
    } else {
      for (let i = 0; i < context.bays; i++) box("Shuttle stopping bay", (-0.38 + 0.76 * i / (context.bays - 1)) * l, h * 0.032, -w * 0.34, l * 0.55 / context.bays, h * 0.004, w * 0.20, colors.accent);
    }
    const roofHeight = permanent ? (commuter ? 0.51 : rail ? 0.63 : 0.45) : 0.85;
    const canopyBays = context.bays;
    for (let i = 0; i < canopyBays; i++) {
      const x = l * (-0.35 + 0.70 * i / (canopyBays - 1));
      box("Platform canopy", x, h * roofHeight, platformZ, l * 0.78 / canopyBays, h * 0.035, w * (context.sheltered ? 0.61 : 0.43), colors.accent, 0.2);
      for (const side of [-1, 1]) cylinder("Canopy column", x, platformZ + side * w * 0.15, Math.min(w * 0.008, 0.3), h * roofHeight, colors.structure);
      box("Waiting bench", x, h * 0.14, platformZ + w * 0.08, l * 0.40 / canopyBays, h * 0.035, w * 0.06, colors.dark);
    }
    box("Tactile platform edge", 0, h * 0.104, platformZ - w * 0.22, l * 0.94, h * 0.008, w * 0.025, "#e0c68d");
    if (context.form === "rail-walkway" && permanent) {
      box("Illustrative aerial walkway", l * 0.31, h * 0.71, 0, l * 0.12, h * 0.08, w * 0.94, colors.structure);
      for (const side of [-1, 1]) box("Walkway balustrade", l * (0.31 + side * 0.059), h * 0.80, 0, l * 0.008, h * 0.12, w * 0.94, colors.glass);
      box("Access tower", l * 0.30, h * 0.43, w * 0.36, l * 0.14, h * 0.86, w * 0.17, colors.glass);
    }
    if (context.portal || context.accessible) {
      const rise = permanent ? 0.29 : 0.11;
      for (let i = 0; i < 8; i++) {
        const stepH = h * rise * (i + 1) / 8;
        box("Illustrative entrance stair", -l * 0.38 + i * l * 0.026, stepH / 2, w * 0.40, l * 0.026, stepH, w * 0.14, colors.structure);
      }
      if (permanent && rail) {
        box("Accessible lift enclosure", -l * 0.13, h * 0.24, w * 0.40, l * 0.08, h * 0.48, w * 0.15, colors.glass);
        const escalator = box("Illustrative escalator", -l * 0.30, h * 0.17, w * 0.28, l * 0.19, h * 0.02, w * 0.06, colors.dark);
        escalator.rotation.z = Math.atan2(h * 0.23, l * 0.19);
      }
    }
    box("Station information totem", l * 0.44, h * 0.49, w * 0.32, l * 0.025, h * 0.98, w * 0.05, colors.accent);
    for (let i = 0; i < 8; i++) cylinder("Queue bollard", l * (-0.30 + i * 0.08), w * 0.28, w * 0.006, h * 0.15, colors.dark);
  } else if (project.category === "toc") {
    box("Control building", 0, h * 0.44, 0, l * 0.94, h * 0.88, w * 0.94, colors.structure);
    for (const side of [-1, 1]) {
      box("Window ribbon", 0, h * 0.61, side * w * 0.472, l * 0.87, h * 0.27, w * 0.004, colors.glass, 0.5);
      for (let i = -4; i <= 4; i++) box("Window divider", i * l * 0.09, h * 0.61, side * w * 0.475, l * 0.008, h * 0.29, w * 0.005, colors.dark);
    }
    box("Roof", 0, h * 0.94, 0, l, h * 0.12, w, colors.dark, 0.25);
    box("Fascia", 0, h * 0.89, w * 0.498, l, h * 0.08, w * 0.004, colors.accent);
    box("Entry glazing", l * 0.472, h * 0.30, 0, l * 0.004, h * 0.60, w * 0.30, colors.glass, 0.45);
  } else if (project.category === "hub") {
    box("Hub paving", 0, h * 0.025, 0, l, h * 0.05, w, colors.structure);
    const rows = context.shelter === "linear" ? [1] : [-1, 1];
    const bays = context.bays;
    const roofSpan = context.shelter === "shade" ? 0.38 : 0.25;
    for (const row of rows) for (let i = 0; i < bays; i++) {
      const x = (-0.36 + i * 0.72 / (bays - 1)) * l;
      const z = row * w * (context.shelter === "sawtooth" && i % 2 ? 0.32 : 0.23);
      box("Shuttle bay island", x, h * 0.065, z, l * 0.72 / bays, h * 0.05, w * 0.24, colors.surface);
      box("Shelter canopy", x, h * 0.92, z, l * 0.74 / bays, h * 0.08, w * roofSpan, colors.accent);
      cylinder("Shelter column", x, z, Math.min(w * 0.006, 0.25), h * 0.91, colors.dark);
      box("Waiting bench", x, h * 0.16, z, l * 0.45 / bays, h * 0.04, w * 0.065, colors.dark);
      box("Bay edge", x, h * 0.095, z - row * w * 0.11, l * 0.72 / bays, h * 0.012, w * 0.012, "#e0c68d");
      box("Bay number totem", x + l * 0.27 / bays, h * 0.40, z, l * 0.012, h * 0.70, w * 0.025, colors.accent);
    }
    box("Accessible circulation", 0, h * 0.055, 0, l * 0.98, h * 0.01, w * 0.09, colors.accent);
    if (context.form === "light-rail" && context.areaType === "rail_shuttle_interchange") {
      for (const z of [-0.46, -0.42]) box("Interchange rail edge", 0, h * 0.065, z * w, l * 0.96, h * 0.02, w * 0.01, colors.dark);
    }
    if (/dispatch|road|curb/i.test(context.profile.dominantBottleneck)) box("Dispatch shelter", 0, h * 0.37, w * 0.42, l * 0.13, h * 0.64, w * 0.12, colors.glass);
  } else if (project.category === "signals") {
    // A proper traffic signal inside a 1 m x 1 m footprint: pole, controller
    // cabinet, vehicle head with backplate and visors, pedestrian head, push
    // button. The permanent variant is taller and adds a second head and a
    // detector at the top.
    const pole = Math.min(w, l) * 0.06;
    cylinder("Signal foundation", 0, 0, Math.min(w, l) * 0.3, h * 0.025, colors.structure);
    cylinder("Signal pole", 0, 0, pole, h * 0.97, colors.dark);
    box("Controller cabinet", 0, h * 0.11, w * 0.30, l * 0.34, h * 0.22, w * 0.24, colors.structure, 0.2);
    box("Cabinet door seam", 0, h * 0.11, w * 0.425, l * 0.30, h * 0.18, w * 0.004, colors.dark);
    const heads = permanent ? [0.80, 0.56] : [0.78];
    for (const top of heads) {
      const headH = h * 0.30;
      const y = h * top - headH / 2;
      box("Signal backplate", 0, y, w * 0.07, l * 0.46, headH * 1.12, w * 0.02, "#1f2a33");
      box("Signal housing", 0, y, w * 0.14, l * 0.30, headH, w * 0.13, "#d9a441");
      const lensR = Math.min(l * 0.09, headH / 8);
      ["#ff5a4f", "#f5c542", "#3fd08c"].forEach((tint, i) => {
        const cy = y + headH * (0.3 - i * 0.3);
        const visor = new THREE.Mesh(new THREE.CylinderGeometry(lensR * 1.15, lensR * 1.15, w * 0.08, 16, 1, true), material("#1f2a33", 0.1));
        visor.name = "Lens visor";
        visor.rotation.x = Math.PI / 2;
        visor.position.set(0, cy + lensR * 0.15, w * 0.22);
        group.add(visor);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(lensR, 20), material(tint, 0.1, 0.3));
        lens.name = "Illustrative signal lens";
        lens.position.set(0, cy, w * 0.26);
        group.add(lens);
      });
    }
    box("Pedestrian signal", 0, h * 0.40, w * -0.16, l * 0.20, h * 0.10, w * 0.10, colors.dark);
    box("Pedestrian indication", 0, h * 0.40, w * -0.215, l * 0.12, h * 0.06, w * 0.004, "#f3f7fb");
    box("Push button", 0, h * 0.20, w * -0.10, l * 0.08, h * 0.03, w * 0.06, colors.accent);
    if (permanent) {
      box("Detector camera", 0, h * 0.965, w * 0.09, l * 0.10, h * 0.04, w * 0.16, colors.dark, 0.4);
    }
  } else if (project.category === "wayfinding") {
    // A double-sided totem: plinth, header band with the phase colour, map
    // panel, three directional blades and a row of pictogram tiles.
    box("Totem plinth", 0, h * 0.02, 0, l * 0.62, h * 0.04, w * 0.42, colors.structure, 0.2);
    box("Totem body", 0, h * 0.50, 0, l * 0.52, h * 0.92, w * 0.10, "#1f2a33");
    box("Header band", 0, h * 0.90, 0, l * 0.54, h * 0.12, w * 0.11, colors.accent);
    for (const side of [-1, 1]) {
      const z = side * w * 0.056;
      box("Map panel", 0, h * 0.62, z, l * 0.42, h * 0.30, w * 0.004, "#f3f7fb");
      box("Map graphic", 0, h * 0.62, z + side * w * 0.002, l * 0.30, h * 0.18, w * 0.002, colors.glass);
      for (let i = 0; i < 3; i++) {
        box("Directional blade", -l * 0.06, h * (0.41 - i * 0.075), z, l * 0.34, h * 0.045, w * 0.004, "#f3f7fb");
        box("Arrow", l * 0.17, h * (0.41 - i * 0.075), z + side * w * 0.002, l * 0.08, h * 0.03, w * 0.002, colors.accent);
      }
      for (let i = 0; i < 4; i++) {
        box("Pictogram tile", -l * 0.19 + i * l * 0.125, h * 0.14, z, l * 0.09, h * 0.06, w * 0.004, colors.accent);
      }
    }
    if (permanent) box("Illuminated cap", 0, h * 0.975, 0, l * 0.56, h * 0.03, w * 0.13, "#f3f7fb", 0.3);
  } else if (project.category === "parkride") {
    // Park-and-ride at 0.2 m: everything is surface. Angled bays in rows,
    // drive aisles, an entry apron with arrows, accessible bays by the
    // shuttle kerb, and a shuttle pickup island.
    const surfaceY = h * 0.48;
    box("Paved footprint", 0, surfaceY, 0, l, h * 0.96, w, "#2b353d");
    const markY = h * 0.985;
    const rowCount = Math.max(2, Math.min(6, Math.floor(w / 24)));
    const rowPitch = (w * 0.78) / rowCount;
    const bayDepth = Math.min(5, rowPitch * 0.38);
    const bayPitch = 2.7;
    const bays = Math.floor((l * 0.78) / bayPitch);
    for (let row = 0; row < rowCount; row++) {
      const zc = -w * 0.39 + rowPitch * (row + 0.5);
      for (const side of [-1, 1]) {
        const z = zc + side * (bayDepth / 2 + 0.2);
        for (let i = 0; i <= bays; i++) {
          const stripe = box("Bay marking", -l * 0.39 + i * bayPitch, markY, z, 0.22, h * 0.02, bayDepth, "#e8f0f4");
          stripe.rotation.y = side * 0.35;
        }
        box("Bay end line", 0, markY, z + side * bayDepth * 0.5, l * 0.78, h * 0.02, 0.2, "#e8f0f4");
      }
      box("Drive aisle centre", 0, markY, zc, l * 0.78, h * 0.02, 0.25, "#9aa7b0");
    }
    // Entry apron and arrows on the short end.
    box("Entry apron", l * 0.45, markY, 0, l * 0.06, h * 0.02, w * 0.30, "#4a5c68");
    for (let i = 0; i < 3; i++) box("Entry arrow", l * 0.43 + i * l * 0.015, markY + h * 0.004, -w * 0.08 + i * w * 0.08, l * 0.02, h * 0.008, 0.25, "#f3f7fb");
    // Shuttle kerb island along the long edge, accessible bays beside it.
    box("Shuttle pickup island", 0, h * 0.72, -w * 0.455, l * 0.55, h * 0.50, w * 0.05, colors.structure);
    box("Island tactile edge", 0, h * 0.985, -w * 0.43, l * 0.55, h * 0.02, 0.4, "#e0c68d");
    for (let i = 0; i < 4; i++) box("Accessible bay", -l * 0.22 + i * 3.6, markY + h * 0.002, -w * 0.385, 3.0, h * 0.012, 5, "#2f6fd6");
    box("Pickup zone marking", 0, markY + h * 0.002, -w * 0.415, l * 0.55, h * 0.01, 0.2, colors.accent);
  } else if (project.category === "tnc") {
    // A managed rideshare hub: pickup lanes along raised kerb islands, lettered
    // bays, a queueing lane with chevrons and a passenger waiting island with
    // a tactile edge. All inside a 0.2 m envelope, so kerbs carry the form.
    const markY = h * 0.985;
    box("Paved footprint", 0, h * 0.48, 0, l, h * 0.96, w, colors.surface);
    const lanes = w >= 40 ? 2 : 1;
    for (let lane = 0; lane < lanes; lane++) {
      const z = lanes === 1 ? 0 : (lane === 0 ? -w * 0.22 : w * 0.22);
      box("Pickup kerb island", 0, h * 0.72, z, l * 0.80, h * 0.50, Math.min(3, w * 0.08), colors.structure);
      box("Island tactile edge", 0, markY, z + Math.min(1.7, w * 0.05), l * 0.80, h * 0.02, 0.35, "#e0c68d");
      const bays = Math.max(3, Math.min(8, Math.floor((l * 0.8) / 7)));
      for (let i = 0; i < bays; i++) {
        const x = -l * 0.36 + (i + 0.5) * (l * 0.72) / bays;
        box("Bay divider", x - (l * 0.36) / bays, markY, z - Math.min(4.2, w * 0.13), 0.12, h * 0.02, Math.min(5.5, w * 0.16), "#cfdce4");
        box("Bay letter block", x, markY + h * 0.002, z - Math.min(4.2, w * 0.13), 1.2, h * 0.012, 1.2, colors.accent);
      }
      box("Pickup lane edge", 0, markY, z - Math.min(7.2, w * 0.22), l * 0.80, h * 0.02, 0.15, "#cfdce4");
    }
    // Queue lane with chevrons across the open side.
    const qz = lanes === 1 ? w * 0.34 : w * 0.44;
    for (let x = -l * 0.42; x < l * 0.42; x += 4) {
      const chevron = box("Queue chevron", x, markY, qz, 2.2, h * 0.02, 0.18, "#dfe9ec");
      chevron.rotation.y = 0.6;
    }
    box("Waiting island", -l * 0.47, h * 0.72, 0, l * 0.05, h * 0.50, w * 0.6, colors.structure);
    box("Waiting island tactile edge", -l * 0.445, markY, 0, 0.35, h * 0.02, w * 0.6, "#e0c68d");
    box("Zone identification", l * 0.47, markY + h * 0.002, 0, l * 0.04, h * 0.012, w * 0.3, colors.accent);
  } else {
    // Linear projects. Each corridor type gets its own surface language so a
    // bus lane, a service route and a bike lane no longer read identically.
    const surfaceY = h * 0.48;
    const markY = h * 0.985;
    const step = Math.max(6, l / 120);
    if (project.category === "buslane") {
      box("Bus lane surface", 0, surfaceY, 0, l, h * 0.96, w, "#7a3b3f");
      box("Lane edge line", 0, markY, w * 0.45, l, h * 0.02, w * 0.04, "#f3f7fb");
      box("Separator kerb", 0, h * 0.5, -w * 0.46, l, h, w * 0.06, colors.structure);
      for (let x = -l * 0.47; x < l * 0.47; x += step) {
        box("BUS ONLY marking", x, markY, 0, Math.min(2.4, step * 0.4), h * 0.02, w * 0.5, "#f3f7fb");
        box("Skip line", x + step / 2, markY, w * 0.45, step * 0.3, h * 0.02, w * 0.04, "#f3f7fb");
      }
    } else if (project.category === "service") {
      box("Route surface", 0, surfaceY, 0, l, h * 0.96, w, colors.surface);
      box("Route ribbon", 0, markY - h * 0.002, 0, l, h * 0.02, w * 0.45, colors.accent);
      for (let x = -l * 0.47; x < l * 0.47; x += step) {
        const chevron = box("Direction chevron", x, markY, 0, Math.min(1.2, w * 0.5), h * 0.02, w * 0.28, "#f3f7fb");
        chevron.rotation.y = 0.55;
      }
      const stopPitch = Math.max(step * 4, l / 12);
      for (let x = -l * 0.42; x < l * 0.45; x += stopPitch) {
        box("Stop pad", x, markY, w * 0.32, Math.min(6, stopPitch * 0.3), h * 0.02, w * 0.3, "#e0c68d");
        box("Stop post", x, h * 0.5, w * 0.44, Math.min(0.3, w * 0.1), h * 0.98, Math.min(0.3, w * 0.1), colors.dark);
      }
    } else if (project.category === "bike") {
      box("Bike lane surface", 0, surfaceY, 0, l, h * 0.96, w, "#2d9387");
      box("Buffer hatch base", 0, markY - h * 0.002, w * 0.40, l, h * 0.02, w * 0.18, "#c9e6e1");
      for (let x = -l * 0.48; x < l * 0.48; x += step * 0.5) {
        const hatch = box("Buffer hatch", x, markY, w * 0.40, 0.15, h * 0.02, w * 0.17, "#2d9387");
        hatch.rotation.y = 0.8;
      }
      box("Lane edge", 0, markY, -w * 0.46, l, h * 0.02, w * 0.05, "#f3f7fb");
      for (let x = -l * 0.46; x < l * 0.47; x += step) {
        box("Bike symbol", x, markY, -w * 0.05, Math.min(1.6, step * 0.3), h * 0.02, w * 0.4, "#f3f7fb");
        box("Direction arrow", x + Math.min(1.4, step * 0.25), markY, -w * 0.05, 0.6, h * 0.02, w * 0.18, "#f3f7fb");
      }
    } else if (project.category === "access") {
      box("Accessible route surface", 0, surfaceY, 0, l, h * 0.96, w, "#8eaaad");
      box("Tactile guidance strip", 0, markY, 0, l, h * 0.02, w * 0.14, "#e0c68d");
      for (let x = -l * 0.48; x < l * 0.48; x += 0.6) box("Guidance rib", x, markY + h * 0.006, 0, 0.25, h * 0.012, w * 0.12, "#c9ad70");
      const padPitch = Math.max(step * 3, l / 10);
      for (let x = -l * 0.43; x < l * 0.45; x += padPitch) {
        box("Microtransit stop pad", x, markY, w * 0.25, Math.min(5, padPitch * 0.3), h * 0.02, w * 0.4, colors.accent);
        box("Kerb ramp", x, markY, -w * 0.38, Math.min(2.5, padPitch * 0.15), h * 0.02, w * 0.2, "#f3f7fb");
      }
    } else {
      // Protected pedestrian corridor.
      box("Paving", 0, surfaceY, 0, l, h * 0.96, w, "#98adb3");
      for (let x = -l / 2 + 1; x < l / 2; x += Math.max(2, l / 180)) box("Paving joint", x, markY, 0, 0.025, h * 0.02, w, "#708b92");
      box("Guidance strip", 0, markY, -w * 0.25, l, h * 0.02, w * 0.065, "#e0c68d");
      box("Protective kerb", 0, h * 0.5, w * 0.47, l, h, w * 0.05, colors.structure);
      for (let x = -l * 0.44; x < l * 0.45; x += Math.max(step * 2, l / 16)) {
        box("Planter", x, h * 0.5, w * 0.36, Math.min(4, step), h * 0.98, w * 0.14, "#3f6b4a");
        box("Crossing band", x + Math.max(step, l / 32), markY, 0, Math.min(3, step * 0.5), h * 0.02, w * 0.9, "#f3f7fb");
      }
    }
    for (const side of [-1, 1]) box("Edge marking", 0, markY, side * w * 0.485, l, h * 0.015, w * 0.02, colors.accent);
  }
  return group;
}

/** Dispose each shared resource once when changing the model or leaving. */
export function disposeObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
      geometries.add(child.geometry);
      const list = Array.isArray(child.material) ? child.material : [child.material];
      list.forEach((material) => materials.add(material));
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
