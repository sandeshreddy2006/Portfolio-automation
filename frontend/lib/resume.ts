import { MAX_RESUME_ENTRIES, type PortfolioContent } from "./portfolio";

export type ResumeDetails = Partial<Pick<PortfolioContent, "name" | "headline" | "bio">> &
  Required<Pick<PortfolioContent, "projects" | "links" | "experience" | "credentials">>;

export type ResumeLine = { text: string; urls?: string[] };

type Section = "summary" | "projects" | "experience" | "credentials" | "other";
const headings = new Map<string, Section>([
  ...["summary", "professional summary", "profile", "professional profile", "about me", "objective"].map((name) => [name, "summary"] as const),
  ...["projects", "personal projects", "selected projects", "academic projects", "technical projects"].map((name) => [name, "projects"] as const),
  ...["experience", "work experience", "professional experience", "employment", "employment history", "work history", "career history", "relevant experience", "internships"].map((name) => [name, "experience"] as const),
  ...["certifications", "certificates", "credentials", "professional certifications", "licenses", "licences", "licenses and certifications", "licences and certifications", "certifications and licenses", "certifications and licences", "licenses and certificates", "licences and certificates"].map((name) => [name, "credentials"] as const),
  ...["education", "skills", "technical skills", "awards", "publications", "interests", "languages", "contact", "references", "volunteering", "activities"].map((name) => [name, "other"] as const),
]);

const webAddress = /\b(?:https?:\/\/|www\.)[^\s<>"|]+|(?<![@\w.-])(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s<>"|]*/gi;
const contactDetails = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4})/gi;
const bullet = /^[•●▪◦·*–—-]\s*/u;
const datePattern = /\b(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+|(?:0?[1-9]|1[0-2])[/.])?(?:19|20)\d{2}(?:\s*(?:[-–—]|to)\s*(?:(?:[A-Za-z]{3,9}\.?\s+|\d{1,2}[/.])?(?:19|20)\d{2}|present|current|now))?\b/i;
const roleWords = /\b(developer|engineer|designer|student|analyst|researcher|writer|manager|architect|consultant|specialist|scientist|editor|photographer|intern|director|associate|coordinator|lead|assistant|technician)\b/i;
const linkLabel = /^(?:source(?: code)?|github|gitlab|repository|live (?:demo|site)|demo|website|link|view (?:project|credential|certificate)|credential url)\s*:?$/i;

function cleanText(text: string) {
  return text.replace(contactDetails, "").replace(webAddress, "")
    .replace(/\s+/g, " ").replace(/^[\s|;,]+|[\s|;,]+$/g, "");
}

function urlsFrom({ text, urls = [] }: ResumeLine) {
  return [...(text.match(webAddress) ?? []).map((url) => url.replace(/[.,;:)\]]+$/, "")), ...urls].flatMap((value) => {
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      return ["http:", "https:"].includes(url.protocol) && url.hostname.includes(".")
        && !url.username && !url.password && url.href.length <= 2083 ? [url.href] : [];
    } catch {
      return [];
    }
  });
}

function descriptionWith(description: string, text: string) {
  return [description, text].filter(Boolean).join("\n").slice(0, 4000);
}

function projectsFrom(lines: ResumeLine[]) {
  const projects: ResumeDetails["projects"] = [];
  let project: ResumeDetails["projects"][number] | undefined;
  for (const line of lines) {
    const text = cleanText(line.text.replace(bullet, ""));
    const url = urlsFrom(line)[0];
    if (!text || linkLabel.test(text)) {
      if (project && url) project.url ??= url;
      continue;
    }

    const [title, ...description] = text.split(/\s+[-—–|]\s+/);
    const inlineEntry = description.length > 0 && title.length <= 85;
    if (project && !inlineEntry && (bullet.test(line.text) || text.length > 85 || /[.!?]$/.test(text))) {
      project.description = descriptionWith(project.description, text);
      if (url) project.url ??= url;
      continue;
    }

    if (projects.length >= MAX_RESUME_ENTRIES) break;
    project = { title: title.slice(0, 120), description: description.join(" · ").slice(0, 4000), url };
    projects.push(project);
  }
  return projects;
}

function experienceFrom(lines: ResumeLine[]) {
  const experience: ResumeDetails["experience"] = [];
  let job: ResumeDetails["experience"][number] | undefined;
  for (const line of lines) {
    const text = cleanText(line.text.replace(bullet, ""));
    if (!text) continue;
    const dates = text.match(datePattern)?.[0] ?? "";
    const details = dates ? text.replace(dates, "").replace(/^[\s,|–—-]+|[\s,|–—-]+$/g, "") : text;
    if (job && dates && !details) {
      job.dates ||= dates;
      continue;
    }
    const bulletedDescription = bullet.test(line.text) && !(dates && roleWords.test(details) && /\s(?:at|[-—–|])\s/i.test(details));
    if (job && (bulletedDescription || (!dates && (text.length > 85 || /[.!?]$/.test(text))))) {
      job.description = descriptionWith(job.description, text);
      continue;
    }
    const [first, ...rest] = details.split(/\s+(?:at|[-—–|])\s+|,\s+/i);
    const companyFirst = rest.length === 1 && !roleWords.test(first) && roleWords.test(rest[0]);
    const role = companyFirst ? rest[0] : first;
    const company = companyFirst ? first : rest.join(", ");
    if (!role) continue;
    if (job && !job.company && !job.description && !company && !(job.dates && dates)) {
      if (!roleWords.test(job.role) && roleWords.test(role)) {
        job.company = job.role;
        job.role = role.slice(0, 120);
      } else {
        job.company = role.slice(0, 120);
      }
      job.dates ||= dates;
      continue;
    }
    if (experience.length >= MAX_RESUME_ENTRIES) break;
    job = { role: role.slice(0, 120), company: company.slice(0, 120), dates, description: "" };
    experience.push(job);
  }
  return experience;
}

function credentialsFrom(lines: ResumeLine[]) {
  const credentials: ResumeDetails["credentials"] = [];
  let credential: ResumeDetails["credentials"][number] | undefined;
  for (const [index, line] of lines.entries()) {
    const text = cleanText(line.text.replace(bullet, ""));
    const url = urlsFrom(line)[0];
    if (!text || linkLabel.test(text)) {
      if (credential && url) credential.url ??= url;
      continue;
    }
    const date = text.match(datePattern)?.[0] ?? "";
    const details = date ? text.replace(date, "").replace(/[\s,|–—-]+$/g, "") : text;
    if (credential && /^(?:issued by|issuer:|issued:?$|expires:?$)/i.test(details)) {
      if (date) credential.date ||= date;
      const issuer = details.replace(/^(?:issued by|issuer:)\s*/i, "");
      if (issuer !== details) credential.issuer ||= issuer.slice(0, 120);
      if (url) credential.url ??= url;
      continue;
    }
    if (!details && credential) {
      credential.date ||= date;
      if (url) credential.url ??= url;
      continue;
    }
    if (!details) continue;
    if (credentials.length >= MAX_RESUME_ENTRIES) break;
    const [title, ...issuer] = details.split(/\s+[-|–—]\s+|,\s+/);
    const next = lines[index + 1]?.text ?? "";
    const nextDate = next.match(datePattern)?.[0];
    if (credential && !credential.issuer && !credential.date && !issuer.length && !date
      && !bullet.test(line.text) && nextDate && /^(?:issued:?\s*)?$/i.test(next.replace(nextDate, "").trim())) {
      credential.issuer = title.slice(0, 120);
      if (url) credential.url ??= url;
      continue;
    }
    credential = { title: title.slice(0, 120), issuer: issuer.join(", ").slice(0, 120), date, url };
    credentials.push(credential);
  }
  return credentials;
}

export function suggestResumeDetails(input: string | ResumeLine[], unplacedLinks: ResumeLine[] = []): ResumeDetails {
  const lines: ResumeLine[] = typeof input === "string" ? input.split(/\r?\n/).map((text) => ({ text })) : input;
  const sections: Record<Section | "header", ResumeLine[]> = {
    header: [], summary: [], projects: [], experience: [], credentials: [], other: [],
  };
  let section: Section | "header" = "header";
  for (const line of lines) {
    const text = line.text.trim();
    const heading = headings.get(text.replace(/:\s*$/, "").toLowerCase().replace(/\s*[/&]\s*/g, " and "));
    if (heading) section = heading;
    else if (text || line.urls?.length) sections[section].push({ ...line, text });
  }

  const first = sections.header[0]?.text ?? "";
  const name = /^[\p{L}\p{M}.'’ -]+$/u.test(first) && first.split(/\s+/).length <= 5 && first.length >= 3
    ? first.slice(0, 120) : undefined;
  const second = sections.header[1]?.text ?? "";
  const headline = name && roleWords.test(second)
    ? cleanText(second).slice(0, 160) : undefined;
  const projects = projectsFrom(sections.projects);
  const credentials = credentialsFrom(sections.credentials);
  const attached = new Set([...projects, ...credentials].map(({ url }) => url));
  const links = [...new Set([...lines, ...unplacedLinks].flatMap(urlsFrom))].filter((url) => !attached.has(url)).slice(0, 20).map((url) => {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const label = host === "github.com" ? "GitHub" : host === "linkedin.com" ? "LinkedIn" : host;
    return { label: label.slice(0, 120), url };
  });

  return {
    name, headline, bio: sections.summary.map(({ text }) => cleanText(text)).filter(Boolean).join(" ").slice(0, 4000) || undefined,
    projects, experience: experienceFrom(sections.experience), credentials, links,
  };
}
