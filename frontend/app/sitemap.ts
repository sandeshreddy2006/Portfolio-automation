import type { MetadataRoute } from "next";
import { getSearchablePortfolios, SITE_URL } from "@/lib/published";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const portfolios = await getSearchablePortfolios();
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/templates`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/cookies`, changeFrequency: "yearly", priority: 0.2 },
    ...portfolios.map(({ slug, published_at }) => ({
      url: `${SITE_URL}/p/${slug}`,
      lastModified: new Date(published_at),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
