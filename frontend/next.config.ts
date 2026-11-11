import type { NextConfig } from "next";

/**
 * Browser security policy. It limits where scripts, images, forms and frames may come from, so a
 * mistake elsewhere can't turn into a bigger problem. Production only: development needs looser rules.
 * Inline scripts stay allowed because Next.js adds some, and a per-request nonce would turn every
 * cached page into a slow, uncached one.
 */
function contentSecurityPolicy() {
  // Portfolio images come from the image domain (https). A local backend serves them over http in testing.
  const backend = process.env.BACKEND_URL?.startsWith("http://") ? ` ${new URL(process.env.BACKEND_URL).origin}` : "";
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${backend}`,
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Google sign-in sends the browser to accounts.google.com, which a form's redirect must be allowed to reach.
    "form-action 'self' https://accounts.google.com",
  ].join("; ");
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy() }]
            : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The editor previews portfolios in a same-origin iframe, so only our own pages may frame us.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      // Only globals.css goes through Tailwind. A "*.css" rule also swallows
      // *.module.css files and leaves their class names undefined.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
