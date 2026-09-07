/**
 * Copy MapLibre's worker bundle into public/ so it can be served as a real
 * static module script.
 *
 * MapLibre resolves its own worker URL from `import.meta.url` and bails out to
 * an empty string when that is not an http(s) URL -- which is exactly what
 * happens once the library is bundled (by Turbopack here). `new Worker("")`
 * then loads the HTML page instead of a script, the worker never starts, and
 * every GeoJSON source silently stays empty: layers exist, filters are
 * correct, and nothing renders.
 *
 * Copying the worker here and pointing setWorkerUrl() at it fixes that. The
 * files are copied from the installed package on every dev/build run rather
 * than committed, so they cannot drift from the version in package.json.
 */

import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const distDir = path.dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));
const outDir = path.join(process.cwd(), "public", "maplibre");

// The worker imports ./maplibre-gl-shared.mjs relative to itself, so both
// files have to land in the same served directory.
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

await mkdir(outDir, { recursive: true });
for (const file of FILES) {
  await copyFile(path.join(distDir, file), path.join(outDir, file));
}
console.log(`copied ${FILES.length} MapLibre worker file(s) to public/maplibre/`);
