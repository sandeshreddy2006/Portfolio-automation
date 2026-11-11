import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { authCookieHeader, authHeaders, backendAuthUrl } from "../backend";

const getRoutes = new Set(["session", "google/start", "google/callback", "verification"]);
const postRoutes = new Set(["register", "login", "verify", "set-password", "logout", "delete/start", "delete/confirm", "verification/resend"]);

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const endpoint = (await context.params).path.join("/");
  const isPost = request.method === "POST";
  if (!(isPost ? postRoutes : getRoutes).has(endpoint)) {
    return Response.json({ detail: "Not found." }, { status: 404, headers: authHeaders });
  }
  if (isPost && request.headers.get("origin") !== request.nextUrl.origin) {
    return Response.json({ detail: "Invalid request origin." }, { status: 403, headers: authHeaders });
  }

  const headers = new Headers();
  const cookies = authCookieHeader(request);
  if (cookies) headers.set("Cookie", cookies);
  if (endpoint === "google/start") headers.set("X-Portfolabs-Origin", request.nextUrl.origin);

  let body: string | undefined;
  if (isPost) {
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
      return Response.json({ detail: "Expected a JSON request." }, { status: 415, headers: authHeaders });
    }
    if (Number(request.headers.get("content-length")) > 4096) {
      return Response.json({ detail: "Request is too large." }, { status: 413, headers: authHeaders });
    }
    body = await request.text();
    if (body.length > 4096) {
      return Response.json({ detail: "Request is too large." }, { status: 413, headers: authHeaders });
    }
    headers.set("Content-Type", "application/json");
  }

  try {
    const upstreamUrl = backendAuthUrl(endpoint);
    if (!upstreamUrl) throw new Error("Missing backend URL");
    if (endpoint.startsWith("google/")) upstreamUrl.search = request.nextUrl.search;
    const upstream = await fetch(upstreamUrl, {
      method: request.method, headers, body,
      redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(25_000),
    });
    // A deleted account's public pages must stop being served right away, not when the cache expires.
    if (upstream.ok && endpoint === "delete/confirm") {
      revalidateTag("portfolios", { expire: 0 });
      revalidateTag("portfolio-index", { expire: 0 });
    }
    const outgoing = new Headers(authHeaders);
    for (const name of ["content-type", "location", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) outgoing.append("Set-Cookie", cookie);
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch {
    if (endpoint.startsWith("google/")) {
      return new Response(null, { status: 303, headers: { ...authHeaders, Location: "/auth?error=unavailable" } });
    }
    return Response.json({ detail: "The account service is temporarily unavailable." }, { status: 503, headers: authHeaders });
  }
}

export { forward as GET, forward as POST };
