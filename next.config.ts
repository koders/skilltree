import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // The floating "N" badge sits on top of the tree's legend; build errors still show.
  devIndicators: false,
  // Content is read from disk at request time (src/lib/content/server.ts).
  outputFileTracingIncludes: { "/**": ["./content/**/*"] },
};

export default nextConfig;
