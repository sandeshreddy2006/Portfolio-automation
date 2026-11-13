import type { NextRequest } from "next/server";
import { authCookieHeader, authHeaders } from "@/app/api/auth/backend";
import { backendUrl } from "@/lib/backend";

const slug = /^[a-z0-9-]{3,64}$/;
const providerId = /^[a-zA-Z0-9_-]{1,120}$/;

function allowed(path: string[], method: string) {
  if (path.join("/") === "vercel/callback") return method === "GET";
  if (path[0] === "vercel" && path[1] === "connections" && path.length === 3) {
    return method === "DELETE" && providerId.test(path[2]);
  }
  if (path[0] !== "portfolios" || !slug.test(path[1] ?? "")) return false;
  const action = path.slice(2).join("/");
  return (method === "GET" && ["", "vercel/status"].includes(action))
    || (method === "DELETE" && action === "domain")
    || (method === "POST" && ["domain", "domain/verify", "vercel/connect", "vercel/deploy"].includes(action));
}

async function forward(request: NextRequest, { params }: RouteContext<"/api/hosting/[...path]">) {
  const { path } = await params;
  const method = request.method;
  const reply = (detail: string, status: number) => Response.json({ detail }, { status, headers: authHeaders });
  if (!allowed(path, method)) return reply("Not found.", 404);
  if (method !== "GET" && request.headers.get("origin") !== request.nextUrl.origin) return reply("Invalid request origin.", 403);
  const callback = path.join("/") === "vercel/callback";
  const cookies = authCookieHeader(request);
  if (!cookies) {
    if (callback) return new Response(null, { status: 303, headers: { ...authHeaders, Location: "/auth" } });
    return reply("Sign in to manage hosting.", 401);
  }
  const url = backendUrl(`/api/hosting/${path.join("/")}`);
  if (!url) return reply("The hosting service is temporarily unavailable.", 503);
  url.search = request.nextUrl.search;
  const headers = new Headers({ Cookie: cookies, "X-Portfolabs-Origin": request.nextUrl.origin });
  let body: string | undefined;
  if (method === "POST" && ["domain", "vercel/deploy"].includes(path.slice(2).join("/"))) {
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return reply("Expected JSON.", 415);
    if (Number(request.headers.get("content-length")) > 2048) return reply("Request is too large.", 413);
    body = await request.text();
    if (body.length > 2048) return reply("Request is too large.", 413);
    headers.set("Content-Type", "application/json");
  }
  try {
    const upstream = await fetch(url, { method, headers, body, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(55_000) });
    if (callback) {
      const location = upstream.headers.get("location");
      const safe = location && (/^\/(?:editor\/[a-z0-9-]+|dashboard|auth)(?:[?#]|$)/.test(location)
        || new URL(location, request.nextUrl.origin).origin === "https://vercel.com");
      return new Response(null, { status: 303, headers: { ...authHeaders, Location: safe ? location : "/dashboard?vercel=failed" } });
    }
    const contentType = upstream.headers.get("content-type");
    return new Response(upstream.status === 204 ? null : upstream.body, {
      status: upstream.status, headers: { ...authHeaders, ...(contentType ? { "Content-Type": contentType } : {}) },
    });
  } catch {
    return reply("The hosting service is temporarily unavailable.", 503);
  }
}

export { forward as GET, forward as POST, forward as DELETE };
