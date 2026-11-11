import { NextResponse, type NextRequest } from "next/server";

// A portfolio is also reachable at <address>.portfolabs.com. Only the home page of a
// subdomain is rewritten to /p/<address>; assets and API routes work as normal.
const RESERVED = new Set(["www", "api", "app", "assets", "mail", "admin", "auth", "dashboard", "editor"]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function proxy(request: NextRequest) {
  const root = process.env.ROOT_DOMAIN;
  if (!root) return NextResponse.next();

  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (!host.endsWith(`.${root}`)) return NextResponse.next();

  const subdomain = host.slice(0, -(root.length + 1));
  if (!SLUG.test(subdomain) || subdomain.length > 64 || RESERVED.has(subdomain)) return NextResponse.next();

  return NextResponse.rewrite(new URL(`/p/${subdomain}`, request.url));
}

export const config = { matcher: "/" };
