import type { NextConfig } from "next";
import path from "node:path";

// Two ways to build:
//   default            -- the normal Next server build (local dev, `next start`)
//   NEXT_OUTPUT=export -- a fully static site for GitHub Pages. The API base
//                         URL and the site's base path come from
//                         NEXT_PUBLIC_API_BASE_URL / NEXT_PUBLIC_BASE_PATH.
const isExport = process.env.NEXT_OUTPUT === "export";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || undefined;

const nextConfig: NextConfig = {
  ...(isExport
    ? {
        output: "export",
        basePath,
        assetPrefix: basePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
  // The repo root (one level up) has no package-lock.json of its own, which
  // makes Turbopack's workspace-root inference ambiguous. Pin it explicitly
  // to this app so builds and dev don't warn about it.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
