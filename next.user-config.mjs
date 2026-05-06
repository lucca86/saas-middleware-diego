/**
 * User-editable Next.js config consumed by next.config.mjs (auto-generated
 * by v0). Tracked in git on purpose: if the sandbox re-syncs from GitHub
 * while this file is gitignored, the wrapper fails with
 * `Cannot find module 'next.user-config.mjs'` and the dev server crashes.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't block deploys on lint/type errors during preview iterations.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Domains we serve `<Image />` from (R2 CDN, Supabase storage, blob CDN).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "hebbkx1anhila5yf.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "blobs.vusercontent.net" },
    ],
  },
}

export default nextConfig
