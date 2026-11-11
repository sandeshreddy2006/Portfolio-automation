import { cacheLife, cacheTag } from "next/cache";
import { backendUrl } from "./backend";
import type { PortfolioContent } from "./portfolio";

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.portfolabs.com";

export type Published = { slug: string; published_content: PortfolioContent; published_at: string };

/** Cached until the owner publishes, unpublishes or deletes (see app/api/portfolios). */
export async function getPublished(slug: string): Promise<Published | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`portfolio:${slug}`, "portfolios");

  const url = backendUrl(`/api/public/${slug}`);
  if (!url) throw new Error("BACKEND_URL is not configured");
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Portfolio API returned ${response.status}`);
  return response.json();
}

/** Where a renamed address now lives, so links shared before the rename keep working. */
export async function getRedirectTarget(slug: string): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`portfolio:${slug}`, "portfolios");

  const url = backendUrl(`/api/public/${slug}/redirect`);
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return response.ok ? ((await response.json()).to as string) : null;
  } catch {
    return null;
  }
}

/** Published portfolios whose owners opted in to search engines. */
export async function getSearchablePortfolios(): Promise<{ slug: string; published_at: string }[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("portfolio-index");

  const url = backendUrl("/api/public");
  if (!url) return [];
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return response.ok ? await response.json() : [];
  } catch {
    return [];
  }
}
