import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/published";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/editor/", "/auth", "/preview-frame", "/report"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
