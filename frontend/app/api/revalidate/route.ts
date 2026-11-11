import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { SLUG } from "@/lib/published";

// Called by backend/moderate.py so a taken-down portfolio disappears immediately.
const digest = (value: string) => createHash("sha256").update(value).digest();

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = request.headers.get("x-revalidate-secret") ?? "";
  if (!secret || secret.length < 16 || !timingSafeEqual(digest(secret), digest(given))) {
    return Response.json({ detail: "Not found." }, { status: 404 });
  }

  const { slug } = await request.json().catch(() => ({ slug: null }));
  if (typeof slug !== "string" || slug.length > 64 || !SLUG.test(slug)) {
    return Response.json({ detail: "Invalid address." }, { status: 422 });
  }
  revalidateTag(`portfolio:${slug}`, { expire: 0 });
  revalidateTag("portfolio-index", { expire: 0 });
  return Response.json({ revalidated: true });
}
