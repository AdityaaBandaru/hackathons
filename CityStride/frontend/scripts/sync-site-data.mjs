import { copyFile, mkdir } from "node:fs/promises";
const target = new URL("../src/lib/data/", import.meta.url);
await mkdir(target, { recursive: true });
for (const [source, name] of [
  ["../../backend/app/data/seed/cityProfiles.json", "cityProfiles.json"],
  ["../../backend/app/data/seed/pedestrianAreas.json", "pedestrianAreas.json"],
]) await copyFile(new URL(source, import.meta.url), new URL(name, target));
