import type { NextRequest } from "next/server";
import { backendUrl } from "@/lib/backend";
import { authCookieHeader, authHeaders } from "../../auth/backend";

type Context = { params: Promise<{ path: string[] }> };

function reply(detail: string, status: number) {
  return Response.json({ detail }, { status, headers: authHeaders });
}

async function forward(request: NextRequest, context: Context) {
  const endpoint = (await context.params).path.join("/");
  const isPost = request.method === "POST";
  if (endpoint !== (isPost ? "assist" : "status")) return reply("Not found.", 404);
  if (isPost && request.headers.get("origin") !== request.nextUrl.origin) return reply("Invalid request origin.", 403);

  const headers = new Headers();
  const cookies = authCookieHeader(request);
  if (cookies) headers.set("Cookie", cookies);

  let body: string | undefined;
  if (isPost) {
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return reply("Expected a JSON request.", 415);
    body = await request.text();
    if (body.length > 16 * 1024) return reply("Request is too large.", 413);
    headers.set("Content-Type", "application/json");
  }

  const url = backendUrl(`/api/ai/${endpoint}`);
  if (!url) return reply("The writing assistant isn’t available right now.", 503);
  try {
    const upstream = await fetch(url, { method: request.method, headers, body, cache: "no-store", signal: AbortSignal.timeout(40_000) });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...authHeaders, "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return reply("The writing assistant isn’t available right now.", 503);
  }
}

export { forward as GET, forward as POST };
