import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { backendUrl } from "@/lib/backend";
import { authCookieHeader, authHeaders } from "../../auth/backend";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_BODY = 2 * 1024 * 1024;

type Context = { params: Promise<{ path?: string[] }> };

function reply(detail: string, status: number) {
  return Response.json({ detail }, { status, headers: authHeaders });
}

/** Only the exact routes the app uses are forwarded to the backend. */
function route(path: string[] | undefined, method: string) {
  const [slug, action, extra] = path ?? [];
  if (extra !== undefined || (slug && (slug.length > 64 || !SLUG.test(slug)))) return null;
  if (!slug) return method === "GET" || method === "POST" ? { slug } : null;
  if (!action) return ["GET", "PUT", "DELETE"].includes(method) ? { slug } : null;
  if (method === "PATCH" && action === "address") return { slug, action };
  return method === "POST" && (action === "publish" || action === "unpublish") ? { slug, action } : null;
}

async function forward(request: NextRequest, context: Context) {
  const path = (await context.params).path;
  const match = route(path, request.method);
  if (!match) return reply("Not found.", 404);

  const writes = request.method !== "GET";
  if (writes && request.headers.get("origin") !== request.nextUrl.origin) {
    return reply("Invalid request origin.", 403);
  }

  const headers = new Headers();
  const cookies = authCookieHeader(request);
  if (cookies) headers.set("Cookie", cookies);

  let body: string | undefined;
  if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
    const hasBody = match.action === undefined || match.action === "address";
    if (hasBody) {
      if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
        return reply("Expected a JSON request.", 415);
      }
      body = await request.text();
      if (body.length > MAX_BODY) return reply("Request is too large.", 413);
      headers.set("Content-Type", "application/json");
    }
  }

  const upstreamUrl = backendUrl(`/api/portfolios/${(path ?? []).join("/")}`.replace(/\/$/, ""));
  if (!upstreamUrl) return reply("The service is temporarily unavailable.", 503);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method, headers, body, cache: "no-store", signal: AbortSignal.timeout(25_000),
    });
    // Visitors must see a publish, unpublish or delete right away, so expire the cached page now.
    const changesPublicPage = match.action !== undefined || request.method === "DELETE";
    if (upstream.ok && changesPublicPage && match.slug) {
      revalidateTag(`portfolio:${match.slug}`, { expire: 0 });
      revalidateTag("portfolio-index", { expire: 0 }); // the sitemap lists published, search-visible portfolios
    }
    if (upstream.ok && match.action === "address" && body) {
      // Renaming changes two public addresses: the old one now redirects, the new one shows the page.
      const renamed = (() => { try { return JSON.parse(body).slug; } catch { return null; } })();
      if (typeof renamed === "string" && SLUG.test(renamed)) revalidateTag(`portfolio:${renamed}`, { expire: 0 });
      revalidateTag("portfolio-index", { expire: 0 });
    }
    const outgoing = new Headers(authHeaders);
    const type = upstream.headers.get("content-type");
    if (type) outgoing.set("content-type", type);
    return new Response(upstream.status === 204 ? null : upstream.body, {
      status: upstream.status, headers: outgoing,
    });
  } catch {
    return reply("The service is temporarily unavailable.", 503);
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
