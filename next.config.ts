import type { NextConfig } from "next";

// Uploaded photos (/api/images/<uuid>.webp or /api/images/<site>/<uuid>.webp) come straight from the public Supabase bucket: an external rewrite
// runs no function, so a photo costs no Active CPU on Vercel. The pattern is lib/images.ts's validImagePath, so nothing else in Storage is reachable.
// Without the Supabase URL (a build with no environment) the route app/api/images/[...path] still serves them through a function.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const imagePath = "/api/images/:path((?:[a-z0-9-]+/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(?:jpg|png|webp))";

const nextConfig: NextConfig = {
  async rewrites() {
    if (!supabaseUrl) return [];
    return { beforeFiles: [{ source: imagePath, destination: `${supabaseUrl}/storage/v1/object/public/images/:path` }], afterFiles: [], fallback: [] };
  },
  async headers() {
    // Names are random and never reused, so a photo never changes: browsers and the CDN keep it for a year.
    return [{ source: imagePath, headers: [{ key: "Cache-Control", value: "public, max-age=31536000, s-maxage=31536000, immutable" }] }];
  },
};

export default nextConfig;
