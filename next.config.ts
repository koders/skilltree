import type { NextConfig } from "next";

// The Data page sends a whole progress export as one Server Action argument.
// The default 1 MB body cap would stop restores long before the import
// schema's IMPORT_MAX_CHARS (20M chars, src/lib/config.ts); the file travels
// as an escaped JSON string and non-ASCII text is 2–3 bytes per char, hence 2×.
// src/proxy.ts buffers bodies too, and truncates past its own cap, so it matches.
const IMPORT_BODY_LIMIT = "40mb";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // The floating "N" badge sits on top of the tree's legend; build errors still show.
  devIndicators: false,
  // Content is read from disk at request time (src/lib/content/server.ts).
  outputFileTracingIncludes: { "/**": ["./content/**/*"] },
  experimental: {
    serverActions: { bodySizeLimit: IMPORT_BODY_LIMIT },
    proxyClientMaxBodySize: IMPORT_BODY_LIMIT,
  },
};

export default nextConfig;
