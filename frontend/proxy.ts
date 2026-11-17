import { NextResponse, type NextRequest } from "next/server";
import { backendUrl } from "@/lib/backend";
import { authCookieHeader, authHeaders } from "./app/api/auth/backend";

const RESERVED = new Set(["www", "api", "app", "assets", "mail", "admin", "auth", "dashboard", "editor"]);
const SLUG = /^[a-z0-9-]{3,64}$/;
const PUBLIC_FILE = /^\/(?:_next\/static\/|media\/|icon\.svg$|apple-icon\.png$|brand\/envelope-cursor\.svg$|favicon\.ico$)/;

function missing(status = 404) {
  return new NextResponse(status === 404 ? "Portfolio not found." : "Portfolio temporarily unavailable.", {
    status, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}

function platformHost(host: string, root: string) {
  const app = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.portfolabs.com").hostname;
  const extra = (process.env.PORTFOLABS_APP_HOSTS ?? "").split(",").map((item) => item.trim().toLowerCase());
  return host === app || (root !== "" && host === root) || host === "www.portfolabs.com" || host === "portfolabs.com"
    || host.endsWith(".vercel.app") || host === "localhost" || host === "127.0.0.1" || extra.includes(host);
}

async function signedInHome(request: NextRequest) {
  if (request.method !== "GET" || request.nextUrl.pathname !== "/" || request.nextUrl.searchParams.has("auth")) return null;
  const cookie = authCookieHeader(request);
  if (!/(?:^|; )(?:__Host-)?portfolabs_session=/.test(cookie)) return null;
  const endpoint = backendUrl("/api/auth/session");
  if (!endpoint) return null;

  try {
    const response = await fetch(endpoint, {
      headers: { Cookie: cookie }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(2500),
    });
    if (response.ok && (await response.json())?.id) {
      return NextResponse.redirect(new URL("/dashboard", request.url), { headers: authHeaders });
    }
  } catch {
    // The homepage stays available if the account service is down.
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const root = process.env.ROOT_DOMAIN?.toLowerCase() ?? "";
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase().replace(/\.$/, "");
  const path = request.nextUrl.pathname;
  const isPlatform = platformHost(host, root);

  if (root && host.endsWith(`.${root}`)) {
    const subdomain = host.slice(0, -(root.length + 1));
    if (path === "/" && SLUG.test(subdomain) && !RESERVED.has(subdomain)) {
      return NextResponse.rewrite(new URL(`/p/${subdomain}`, request.url));
    }
    if (!isPlatform) return NextResponse.next();
  }

  if (isPlatform) return (await signedInHome(request)) ?? NextResponse.next();
  if (process.env.PORTFOLABS_CUSTOM_DOMAINS !== "1") return NextResponse.next();
  if (!host || (request.method !== "GET" && request.method !== "HEAD")) return missing();
  if (PUBLIC_FILE.test(path)) return NextResponse.next();
  if (path !== "/" && path !== "/resume" && !/^\/p\/[a-z0-9-]+\/resume$/.test(path)) return missing();

  const lookup = backendUrl(`/api/hosting/resolve?host=${encodeURIComponent(host)}`);
  if (!lookup) return missing(503);
  try {
    const response = await fetch(lookup, { cache: "no-store", signal: AbortSignal.timeout(4500), redirect: "error" });
    if (response.status === 404) return missing();
    if (!response.ok) return missing(503);
    const { slug } = await response.json();
    if (typeof slug !== "string" || !SLUG.test(slug)) return missing();
    if (path === `/p/${slug}/resume`) return NextResponse.next();
    if (path !== "/" && path !== "/resume") return missing();
    const target = request.nextUrl.clone();
    target.pathname = `/p/${slug}${path === "/resume" ? "/resume" : ""}`;
    return NextResponse.rewrite(target);
  } catch {
    return missing(503);
  }
}

export const config = { matcher: "/:path*" };
