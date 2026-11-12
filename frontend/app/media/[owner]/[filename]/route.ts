import type { NextRequest } from "next/server";
import { authCookieHeader } from "@/app/api/auth/backend";
import { backendUrl } from "@/lib/backend";

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: NextRequest, { params }: RouteContext<"/media/[owner]/[filename]">) {
  const { owner, filename } = await params;
  if (!/^u[0-9]+$/.test(owner) || !/^[0-9a-f]{32}\.webp$/.test(filename)) {
    return new Response(null, { status: 404, headers: responseHeaders });
  }

  const url = backendUrl(`/media/${owner}/${filename}`);
  if (!url) return new Response(null, { status: 503, headers: responseHeaders });

  const headers = new Headers();
  const cookies = authCookieHeader(request);
  if (cookies) headers.set("Cookie", cookies);
  try {
    const upstream = await fetch(url, {
      headers, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(25_000),
    });
    if (upstream.status === 404) return new Response(null, { status: 404, headers: responseHeaders });
    if (upstream.ok && upstream.headers.get("content-type") === "image/webp") {
      return new Response(upstream.body, {
        headers: { ...responseHeaders, "Content-Type": "image/webp" },
      });
    }
  } catch {
    // A storage or backend outage should only affect the image.
  }
  return new Response(null, { status: 503, headers: responseHeaders });
}
