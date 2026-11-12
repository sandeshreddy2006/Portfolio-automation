import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { authCookieHeader, authHeaders } from "@/app/api/auth/backend";
import { backendUrl } from "@/lib/backend";

const MAX_PDF = 4 * 1024 * 1024;
const MAX_PROFILE = 2 * 1024 * 1024;

function error(detail: string, status: number) {
  return Response.json({ detail }, { status, headers: authHeaders });
}

async function forward(request: NextRequest, { params }: RouteContext<"/api/profile/[[...path]]">) {
  const path = (await params).path?.join("/") ?? "";
  const method = request.method;
  const resume = path === "resume";
  if (!(resume ? ["GET", "POST", "DELETE"].includes(method) : path === "" && ["GET", "PUT"].includes(method))) {
    return error("Not found.", 404);
  }
  if (method !== "GET" && request.headers.get("origin") !== request.nextUrl.origin) return error("Invalid request origin.", 403);
  const cookies = authCookieHeader(request);
  if (!cookies) return error("Sign in to manage your profile.", 401);
  const url = backendUrl(resume ? "/api/profile/resume" : "/api/profile");
  if (!url) return error("The profile service is temporarily unavailable.", 503);

  const headers = new Headers({ Cookie: cookies });
  let body: ArrayBuffer | undefined;
  if (method === "POST" || method === "PUT") {
    const contentType = resume ? "application/pdf" : "application/json";
    if (request.headers.get("content-type")?.split(";")[0] !== contentType) {
      return error(resume ? "Choose a PDF résumé." : "Expected a JSON request.", 415);
    }
    const limit = resume ? MAX_PDF : MAX_PROFILE;
    if (Number(request.headers.get("content-length")) > limit) return error("The upload is too large.", 413);
    body = await request.arrayBuffer();
    if (body.byteLength > limit) return error("The upload is too large.", 413);
    headers.set("Content-Type", contentType);
  }
  try {
    const upstream = await fetch(url, { method, headers, body, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (upstream.ok && resume && method !== "GET") revalidateTag("portfolios", { expire: 0 });
    const outgoing = new Headers(authHeaders);
    const type = upstream.headers.get("content-type");
    if (type) outgoing.set("Content-Type", type);
    if (upstream.ok && resume && method === "GET") {
      outgoing.set("Content-Disposition", 'attachment; filename="resume.pdf"');
      outgoing.set("X-Content-Type-Options", "nosniff");
    }
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch {
    return error("The profile service is temporarily unavailable.", 503);
  }
}

export { forward as GET, forward as PUT, forward as POST, forward as DELETE };
