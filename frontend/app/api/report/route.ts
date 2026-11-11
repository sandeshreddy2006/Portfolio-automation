import type { NextRequest } from "next/server";
import { backendUrl } from "@/lib/backend";
import { authHeaders } from "../auth/backend";
import { SLUG } from "@/lib/published";

function reply(detail: string, status: number) {
  return Response.json({ detail }, { status, headers: authHeaders });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply("Invalid request origin.", 403);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return reply("Expected a JSON request.", 415);
  const text = await request.text();
  if (text.length > 8 * 1024) return reply("Request is too large.", 413);

  let payload: { slug?: unknown; reason?: unknown; details?: unknown; contact?: unknown };
  try {
    payload = JSON.parse(text);
  } catch {
    return reply("Expected a JSON request.", 415);
  }
  const { slug, ...report } = payload;
  if (typeof slug !== "string" || slug.length > 64 || !SLUG.test(slug)) return reply("Portfolio not found.", 404);

  const url = backendUrl(`/api/public/${slug}/report`);
  if (!url) return reply("Reporting isn’t available right now.", 503);
  try {
    const upstream = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report),
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...authHeaders, "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return reply("Reporting isn’t available right now.", 503);
  }
}
