import { backendUrl } from "@/lib/backend";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: RouteContext<"/p/[slug]/resume">) {
  const { slug } = await params;
  if (slug.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return new Response(null, { status: 404, headers });
  const url = backendUrl(`/api/public/${slug}/resume`);
  if (!url) return new Response(null, { status: 503, headers });
  try {
    const upstream = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25_000) });
    if (upstream.status === 404) return new Response(null, { status: 404, headers });
    if (upstream.ok && upstream.headers.get("content-type") === "application/pdf") {
      return new Response(upstream.body, { headers: {
        ...headers, "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="resume.pdf"',
      } });
    }
  } catch {
    // The rest of the published portfolio stays available.
  }
  return new Response(null, { status: 503, headers });
}
