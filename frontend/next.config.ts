import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The repo root (one level up) has no package-lock.json of its own, which
  // makes Turbopack's workspace-root inference ambiguous. Pin it explicitly
  // to this app so builds and dev don't warn about it.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
