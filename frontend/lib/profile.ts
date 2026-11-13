import { MAX_RESUME_ENTRIES, type ProfileContent } from "./portfolio";
import type { ResumeDetails } from "./resume";

export function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/** Drops fully blank rows and trims text. Returns an error if a row is half filled in. */
export function prepareProfile<T extends ProfileContent>(content: T): { value: T; error?: string } {
  const projects: ProfileContent["projects"] = [];
  for (const [index, project] of content.projects.entries()) {
    const title = project.title.trim();
    const description = project.description.trim();
    const url = (project.url ?? "").trim();
    if (!title && !description && !url && !project.image) continue;
    if (!title) return { value: content, error: `Project ${index + 1} needs a title.` };
    projects.push({ title, description, url: url || null, image: project.image || null, image_framing: project.image ? project.image_framing ?? null : null });
  }
  const links: ProfileContent["links"] = [];
  for (const [index, link] of content.links.entries()) {
    const label = link.label.trim();
    const url = link.url.trim();
    if (!label && !url) continue;
    if (!label || !url) return { value: content, error: `Link ${index + 1} needs both a label and a web address.` };
    links.push({ label, url });
  }
  const experience = (content.experience ?? []).map(({ role, company, location, dates, description }) => ({
    role: role.trim(), company: company.trim(), location: location?.trim() || undefined, dates: dates.trim(), description: description.trim(),
  })).filter((entry) => Object.values(entry).some(Boolean));
  if (experience.some(({ role }) => !role)) return { value: content, error: "Each work experience entry needs a role." };

  const credentials = (content.credentials ?? []).map(({ title, issuer, date, url }) => ({
    title: title.trim(), issuer: issuer.trim(), date: date.trim(), url: url?.trim() || null,
  })).filter((entry) => Object.values(entry).some(Boolean));
  if (credentials.some(({ title }) => !title)) return { value: content, error: "Each license or certification needs a title." };
  return {
    value: { ...content, avatar: content.avatar || null, avatar_framing: content.avatar ? content.avatar_framing ?? null : null, name: content.name.trim(), headline: content.headline.trim(), bio: content.bio.trim(), projects, links, experience, credentials },
  };
}

export function appendSuggestions<T>(current: T[], suggestions: T[], key: (value: T) => string, limit = MAX_RESUME_ENTRIES) {
  const normalized = (entry: T) => key(entry).trim().toLowerCase();
  const seen = new Set(current.map(normalized));
  const result = [...current];
  for (const suggestion of suggestions) {
    if (result.length >= limit) break;
    const id = normalized(suggestion);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(suggestion);
  }
  return result;
}

export function applyResumeDetails<T extends ProfileContent>(current: T, details: ResumeDetails): T {
  const { projects, links, experience, credentials, ...fields } = details;
  const currentProjects = current.projects.map((project) => {
    const match = projects.find(({ title }) => title.trim().toLowerCase() === project.title.trim().toLowerCase());
    return match?.url && !project.url?.trim() ? { ...project, url: match.url } : project;
  });
  return {
    ...current, ...fields,
    projects: appendSuggestions(currentProjects, projects, ({ title }) => title, MAX_RESUME_ENTRIES),
    links: appendSuggestions(current.links, links, ({ url }) => url.trim().replace(/\/$/, ""), 20),
    experience: appendSuggestions(current.experience ?? [], experience, ({ role, company, dates }) => `${role}|${company}|${dates}`),
    credentials: appendSuggestions(current.credentials ?? [], credentials, ({ title, issuer, date }) => `${title}|${issuer}|${date}`),
  };
}

export function fillUsingProfile<T extends ProfileContent>(current: T, profile: ProfileContent, usePhoto: boolean): T {
  const filled = applyResumeDetails(current, {
    name: current.name.trim() ? current.name : profile.name,
    headline: current.headline.trim() ? current.headline : profile.headline,
    bio: current.bio.trim() ? current.bio : profile.bio,
    projects: profile.projects, links: profile.links,
    experience: profile.experience ?? [], credentials: profile.credentials ?? [],
  });
  return usePhoto && profile.avatar ? { ...filled, avatar: profile.avatar, avatar_framing: profile.avatar_framing } : filled;
}
