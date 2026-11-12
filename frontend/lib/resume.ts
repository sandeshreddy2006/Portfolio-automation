import type { PortfolioContent } from "./portfolio";

export type ResumeDetails = Partial<Pick<PortfolioContent, "name" | "headline" | "bio">> &
  Pick<PortfolioContent, "projects" | "links">;

const headings: Record<string, "summary" | "projects" | "other"> = {
  summary: "summary", "professional summary": "summary", profile: "summary",
  "professional profile": "summary", "about me": "summary", objective: "summary",
  projects: "projects", "personal projects": "projects", "selected projects": "projects",
  "academic projects": "projects", "technical projects": "projects",
  experience: "other", "work experience": "other", "professional experience": "other",
  education: "other", skills: "other", "technical skills": "other", certifications: "other",
  awards: "other", publications: "other", interests: "other", languages: "other",
  contact: "other", references: "other", volunteering: "other", activities: "other",
};

const webAddress = /\b(?:https?:\/\/|www\.|(?:github\.com|linkedin\.com|gitlab\.com)\/)[^\s<>"|]+/gi;
const contactDetails = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4})/gi;
const bullet = /^[•●▪◦·*–—-]\s*/u;

function cleanText(text: string) {
  return text.replace(contactDetails, "").replace(webAddress, "")
    .replace(/\s+/g, " ").replace(/^[\s|;,]+|[\s|;,]+$/g, "");
}

function sectionHeading(line: string) {
  return headings[line.replace(/:\s*$/, "").toLowerCase()];
}

function linksFrom(text: string, annotations: string[]) {
  const links: ResumeDetails["links"] = [];
  const seen = new Set<string>();
  for (const value of [...(text.match(webAddress) ?? []), ...annotations]) {
    const trimmed = value.replace(/[.,;:)\]]+$/, "");
    try {
      const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")
          || url.username || url.password || seen.has(url.href)) continue;
      seen.add(url.href);
      const host = url.hostname.replace(/^www\./, "");
      const label = host === "github.com" ? "GitHub" : host === "linkedin.com" ? "LinkedIn" : host;
      links.push({ label: label.slice(0, 120), url: url.href });
      if (links.length === 20) break;
    } catch {
      // Ignore text that only resembles a URL.
    }
  }
  return links;
}

function projectsFrom(lines: string[]) {
  const projects: ResumeDetails["projects"] = [];
  let project: ResumeDetails["projects"][number] | undefined;
  for (const line of lines) {
    const text = cleanText(line.replace(bullet, ""));
    if (!text) continue;

    if (bullet.test(line) || (project && (text.length > 85 || /[.!?]$/.test(text)))) {
      if (project) project.description = [project.description, text].filter(Boolean).join("\n").slice(0, 4000);
      continue;
    }

    const title = text.split(/\s+\|\s+/)[0].slice(0, 120);
    if (!title) continue;
    const link = linksFrom(line, [])[0];
    project = { title, description: "", url: link?.url };
    projects.push(project);
    if (projects.length >= 30) break;
  }
  return projects;
}

export function suggestResumeDetails(text: string, annotations: string[] = []): ResumeDetails {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header: string[] = [];
  const summary: string[] = [];
  const projects: string[] = [];
  let section: "header" | "summary" | "projects" | "other" = "header";

  for (const line of lines) {
    const heading = sectionHeading(line);
    if (heading) {
      section = heading;
    } else if (section === "header") {
      header.push(line);
    } else if (section === "summary") {
      const clean = cleanText(line);
      if (clean) summary.push(clean);
    } else if (section === "projects") {
      projects.push(line);
    }
  }

  const first = header[0] ?? "";
  const name = /^[\p{L}\p{M}.'’ -]+$/u.test(first) && first.split(/\s+/).length <= 5 && first.length >= 3
    ? first.slice(0, 120) : undefined;
  // A headline is only suggested when it looks like a role on the next line.
  const second = header[1] ?? "";
  const headline = name && /\b(developer|engineer|designer|student|analyst|researcher|writer|manager|architect|consultant|specialist|scientist|editor|photographer)\b/i.test(second)
    ? cleanText(second).slice(0, 160) : undefined;

  return {
    name, headline, bio: summary.join(" ").slice(0, 4000) || undefined,
    projects: projectsFrom(projects), links: linksFrom(text, annotations),
  };
}
