// Mirrors PortfolioContent in backend/app/schemas.py. Keep the two in sync.

export type PortfolioLink = { label: string; url: string };

export type PortfolioProject = {
  title: string;
  description: string;
  url?: string | null;
  /** URL of an image uploaded through /api/uploads. */
  image?: string | null;
};

export type PortfolioContent = {
  template_id: string;
  name: string;
  avatar?: string | null;
  /** Whether search engines may list the public page. Off unless the owner opts in. */
  search_visible?: boolean;
  headline: string;
  bio: string;
  projects: PortfolioProject[];
  links: PortfolioLink[];
};

// Mirrors PortfolioSummary / PortfolioDetail in backend/app/schemas.py.
export type PortfolioSummary = {
  slug: string;
  /** Counts saves of the draft; sent back with each save so two tabs can't overwrite each other. */
  revision: number;
  template_id: string;
  name: string;
  published: boolean;
  has_unpublished_changes: boolean;
  published_at: string | null;
  updated_at: string;
};

export type PortfolioDetail = PortfolioSummary & {
  draft_content: PortfolioContent;
  published_content: PortfolioContent | null;
};

export const MAX_PORTFOLIOS = 5;

/** Only http(s) URLs may reach an href. Anything else renders as plain text. */
export function safeHref(url?: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}

/** Image sources: http(s) URLs, or a site-relative path (used by the built-in sample images). */
export function safeImage(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return safeHref(url);
}

export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "you";
}
