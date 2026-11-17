import { MAX_RESUME_ENTRIES, type PortfolioContent } from "./portfolio";

export type ResumeDetails = Partial<Pick<PortfolioContent, "name" | "headline" | "bio">> &
  Required<Pick<PortfolioContent, "projects" | "links" | "experience" | "credentials">>;

export type ResumeLine = { text: string; urls?: string[]; indent?: number; paragraphBreak?: boolean };

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
const bullet = /^(?:[•●▪◦‣∙·\uf0b7\uf0a7]\s*|(?:[*–—-]|\d{1,2}[.)])\s+)/u;
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

function descriptionWith(description: string, text: string, line: ResumeLine, previous?: ResumeLine) {
  const marker = bullet.test(line.text) ? "• " : "";
  const wrap = !marker && !line.paragraphBreak && previous?.indent !== undefined && line.indent !== undefined
    && line.indent >= previous.indent + 2;
  const gap = line.paragraphBreak ? "\n\n" : wrap ? " " : "\n";
  return (description ? description + gap + marker + text : marker + text).slice(0, 4000);
}

function continuation(line: ResumeLine, previous?: ResumeLine) {
  return !line.paragraphBreak && line.indent !== undefined && previous?.indent !== undefined
    && line.indent >= previous.indent + 2;
}

function projectsFrom(lines: ResumeLine[]) {
  const projects: ResumeDetails["projects"] = [];
  let project: ResumeDetails["projects"][number] | undefined;
  let previousDescription: ResumeLine | undefined;
  for (const line of lines) {
    const text = cleanText(line.text.replace(bullet, ""));
    const url = urlsFrom(line)[0];
    if (!text || linkLabel.test(text)) {
      if (project && url) project.url ??= url;
      continue;
    }

    const [title, ...description] = text.split(/\s+[-—–|]\s+/);
    const inlineEntry = description.length > 0 && title.length <= 85;
    if (project && (bullet.test(line.text) || continuation(line, previousDescription)
        || (!inlineEntry && (text.length > 85 || /[.!?]$/.test(text))))) {
      project.description = descriptionWith(project.description, text, line, previousDescription);
      if (!continuation(line, previousDescription) || bullet.test(line.text)) previousDescription = line;
      if (url) project.url ??= url;
      continue;
    }

    if (projects.length >= MAX_RESUME_ENTRIES) break;
    project = { title: title.slice(0, 120), description: description.join(" · ").slice(0, 4000), url };
    projects.push(project);
    previousDescription = undefined;
  }
  return projects;
}

const companyWords = /\b(?:pvt|ltd|limited|inc|llc|corp|corporation|company|consulting|services|technologies|solutions|labs|university)\b/i;
const countryCodes = "IN US GB CA AU NZ DE FR SG AE NL JP CN BR IE SE CH IT ES MX ZA KR PK BD LK NP ID MY PH NG KE".split(" ");
const regions = new Intl.DisplayNames(["en"], { type: "region" });
const countryNames = new Set(countryCodes.map((code) => regions.of(code)?.toLowerCase()));

function looksLikeLocation(text: string) {
  const parts = text.split(/,\s*/);
  const last = parts.at(-1)?.trim() ?? "";
  return /^(?:remote|hybrid|on-site|onsite|usa|uk|uae)$/i.test(last)
    || countryNames.has(last.toLowerCase())
    || (parts.length > 1 && /^[A-Z]{2}$/.test(last));
}

function experienceFrom(lines: ResumeLine[]) {
  const experience: ResumeDetails["experience"] = [];
  let job: ResumeDetails["experience"][number] | undefined;
  let previousDescription: ResumeLine | undefined;
  for (const line of lines) {
    const text = cleanText(line.text.replace(bullet, ""));
    if (!text) continue;
    if (job && continuation(line, previousDescription) && !bullet.test(line.text)) {
      job.description = descriptionWith(job.description, text, line, previousDescription);
      continue;
    }
    const dates = text.match(datePattern)?.[0] ?? "";
    const raw = dates ? line.text.replace(dates, "") : line.text;
    const parts = raw.replace(bullet, "").split(/\t+|\s+(?:at|[-—–|·])\s+/i).flatMap((part) => {
      const value = cleanText(part).replace(/^[,|–—-]+|[,|–—-]+$/g, "").trim();
      const match = value.match(/^(.+?),\s*(.+)$/);
      if (!match || looksLikeLocation(value) && !companyWords.test(match[1]) && !roleWords.test(match[1])) return [value];
      return looksLikeLocation(match[2]) || roleWords.test(match[1]) || roleWords.test(match[2])
        ? [match[1], match[2]] : [value];
    }).filter(Boolean);
    const location = parts.find(looksLikeLocation) ?? "";
    const names = parts.filter((part) => part !== location);
    if (!names.length) {
      if (job) {
        job.dates ||= dates;
        job.location ||= location.slice(0, 120);
      }
      continue;
    }
    const roleIndex = names.findIndex((part) => roleWords.test(part) && !companyWords.test(part));
    const isDescription = bullet.test(line.text) && !(dates && roleIndex >= 0 && names.length > 1);
    if (job && (isDescription || (!dates && !location && names.length === 1 && roleIndex < 0
        && !companyWords.test(text) && (text.length > 85 || /[.!?]$/.test(text))))) {
      job.description = descriptionWith(job.description, text, line);
      previousDescription = line;
      continue;
    }
    const role = names[roleIndex >= 0 ? roleIndex : 0];
    const company = names.filter((part) => part !== role).join(", ");
    if (job && !job.company && !job.description && !company) {
      if (!roleWords.test(job.role) && roleIndex >= 0) {
        job.company = job.role;
        job.role = role.slice(0, 120);
      } else if (roleIndex < 0 && roleWords.test(job.role) && !(job.dates && dates && !location)) {
        job.company = role.slice(0, 120);
      } else {
        job = undefined;
      }
      if (job) {
        job.dates ||= dates;
        job.location ||= location.slice(0, 120);
        continue;
      }
    }
    if (experience.length >= MAX_RESUME_ENTRIES) break;
    job = { role: role.slice(0, 120), company: company.slice(0, 120), location: location.slice(0, 120), dates, description: "" };
    experience.push(job);
    previousDescription = undefined;
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
  let blank = false;
  for (const line of lines) {
    const text = line.text.trim();
    const heading = headings.get(text.replace(/:\s*$/, "").toLowerCase().replace(/\s*[/&]\s*/g, " and "));
    if (heading) {
      section = heading;
      blank = false;
    } else if (text || line.urls?.length) {
      const parts = text.split(/\s+(?=[•●▪◦‣∙\uf0b7\uf0a7]\s*)/u);
      parts.forEach((part, index) => sections[section].push({
        ...line, text: part, urls: index === 0 ? line.urls : undefined,
        indent: line.indent ?? line.text.match(/^\s*/)?.[0].length,
        paragraphBreak: index === 0 && (blank || line.paragraphBreak),
      }));
      blank = false;
    } else {
      blank = true;
    }
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
    name, headline, bio: sections.summary.reduce((summary, line, index) => {
      const text = cleanText(line.text.replace(bullet, ""));
      return text ? descriptionWith(summary, text, line, sections.summary[index - 1]) : summary;
    }, "") || undefined,
    projects, experience: experienceFrom(sections.experience), credentials, links,
  };
}
