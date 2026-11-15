import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, `next dev` writes (and keeps re-writing) an AGENTS.md of its own.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  // Playwright builds to its own folder so it never overwrites the real build. See playwright.config.ts.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
