// Mirrors PortfolioContent in backend/app/schemas.py. Keep the two in sync.

export type PortfolioLink = { label: string; url: string };

export type PortfolioProject = {
  title: string;
  description: string;
  url?: string | null;
};

export type PortfolioContent = {
  template_id: string;
  name: string;
  headline: string;
  bio: string;
  projects: PortfolioProject[];
  links: PortfolioLink[];
};

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
