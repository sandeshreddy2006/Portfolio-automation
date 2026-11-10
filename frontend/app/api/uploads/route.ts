import type { NextRequest } from "next/server";
import { backendUrl } from "@/lib/backend";
import { authCookieHeader, authHeaders } from "../auth/backend";

// Vercel limits request bodies to about 4.5 MB, so the browser shrinks images first.
const MAX_BYTES = 4 * 1024 * 1024;
const KINDS = new Set(["avatar", "project"]);

function reply(detail: string, status: number) {
  return Response.json({ detail }, { status, headers: authHeaders });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply("Invalid request origin.", 403);
  const kind = request.nextUrl.searchParams.get("kind") ?? "project";
  if (!KINDS.has(kind)) return reply("Unknown image type.", 422);
  const type = request.headers.get("content-type")?.split(";")[0] ?? "";
  if (!type.startsWith("image/")) return reply("Please upload a JPEG, PNG or WebP image.", 415);
  if (Number(request.headers.get("content-length")) > MAX_BYTES) return reply("That image is too large.", 413);

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return reply("That image is too large.", 413);

  const url = backendUrl(`/api/uploads?kind=${kind}`);
  if (!url) return reply("The service is temporarily unavailable.", 503);

  const headers = new Headers({ "Content-Type": type });
  const cookies = authCookieHeader(request);
  if (cookies) headers.set("Cookie", cookies);

  try {
    const upstream = await fetch(url, {
      method: "POST", headers, body, cache: "no-store", signal: AbortSignal.timeout(30_000),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...authHeaders, "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return reply("The service is temporarily unavailable.", 503);
  }
}
