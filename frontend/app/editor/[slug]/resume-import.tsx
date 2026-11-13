"use client";

import { useRef, useState } from "react";
import type { PortfolioContent } from "@/lib/portfolio";
import type { ResumeDetails } from "@/lib/resume";
import styles from "../../studio.module.css";

const collections = ["projects", "experience", "credentials", "links"] as const;

const fields = [
  ["name", "Name"], ["headline", "Headline"], ["bio", "Bio"],
] as const;

export default function ResumeImport({ content, disabled, onApply, onStore }: {
  content: Pick<PortfolioContent, "name" | "headline" | "bio">;
  disabled: boolean;
  onApply: (details: ResumeDetails) => void;
  onStore?: (file: File) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<ResumeDetails | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function read(file: File) {
    setBusy(true);
    setError("");
    setSuggestions(null);
    try {
      if (onStore) await onStore(file);
      const { importResume } = await import("@/lib/resume-pdf");
      const result = await importResume(file);
      if (!result.name && !result.headline && !result.bio && !collections.some((key) => result[key].length)) {
        setError("We couldn’t match any text to portfolio fields. You can fill them in below.");
        return;
      }
      const defaults = fields.filter(([key]) => result[key] && !content[key].trim()).map(([key]) => key);
      setSelected(new Set<string>([
        ...defaults,
        ...collections.flatMap((key) => result[key].map((_, index) => `${key}-${index}`)),
      ]));
      setSuggestions(result);
    } catch (failure) {
      if (failure instanceof Error && failure.name === "PasswordException") {
        setError("Choose a PDF that isn’t password-protected.");
      } else {
        setError(failure instanceof Error && failure.name === "Error"
          ? failure.message : "We couldn’t read this PDF. Try exporting it again.");
      }
    } finally {
      setBusy(false);
    }
  }

  function toggle(key: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function apply() {
    if (!suggestions) return;
    const details: ResumeDetails = {
      projects: suggestions.projects.filter((_, index) => selected.has(`projects-${index}`)),
      experience: suggestions.experience.filter((_, index) => selected.has(`experience-${index}`)),
      credentials: suggestions.credentials.filter((_, index) => selected.has(`credentials-${index}`)),
      links: suggestions.links.filter((_, index) => selected.has(`links-${index}`)),
    };
    for (const [key] of fields) {
      if (selected.has(key)) details[key] = suggestions[key];
    }
    onApply(details);
    setSuggestions(null);
  }

  return (
    <section className={styles.group} aria-labelledby="resume-import-title">
      <h2 id="resume-import-title">Import résumé</h2>
      <p className={styles.hint}>{onStore ? "Upload a PDF up to 4 MB. We store the file privately and read selectable text in your browser." : "Choose a PDF with selectable text, up to 5 MB. Your file stays in your browser."}</p>
      <input hidden ref={input} type="file" accept=".pdf,application/pdf" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void read(file);
      }} />
      <div className={styles.actions}>
        <button className={styles.secondary} type="button" disabled={busy || disabled} onClick={() => input.current?.click()}>
          {busy ? "Reading PDF…" : "Choose PDF"}
        </button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {suggestions && (
        <fieldset className={styles.row}>
          <legend>Review suggested details</legend>
          <p className={styles.hint}>Select what to add. Selecting a name, headline, or bio replaces that field. The other selections are added where space allows.</p>
          <div className={styles.resumeChoices}>
            {fields.map(([key, label]) => suggestions[key] && (
              <label key={key}>
                <input type="checkbox" checked={selected.has(key)} onChange={(event) => toggle(key, event.target.checked)} />
                <span><strong>{label}</strong><small>{suggestions[key]}</small></span>
              </label>
            ))}
            {suggestions.projects.map((project, index) => (
              <label key={`project-${index}`}>
                <input type="checkbox" checked={selected.has(`projects-${index}`)} onChange={(event) => toggle(`projects-${index}`, event.target.checked)} />
                <span><strong>Project · {project.title}</strong>{project.description && <small>{project.description}</small>}{project.url && <small>{project.url}</small>}</span>
              </label>
            ))}
            {suggestions.experience.map(({ role, company, location, dates, description }, index) => (
              <label key={`experience-${index}`}>
                <input type="checkbox" checked={selected.has(`experience-${index}`)} onChange={(event) => toggle(`experience-${index}`, event.target.checked)} />
                <span><strong>Experience · {role}</strong><small>{[company, location, dates, description].filter(Boolean).join(" · ")}</small></span>
              </label>
            ))}
            {suggestions.credentials.map(({ title, issuer, date, url }, index) => (
              <label key={`credentials-${index}`}>
                <input type="checkbox" checked={selected.has(`credentials-${index}`)} onChange={(event) => toggle(`credentials-${index}`, event.target.checked)} />
                <span><strong>License or certification · {title}</strong><small>{[issuer, date, url].filter(Boolean).join(" · ")}</small></span>
              </label>
            ))}
            {suggestions.links.map((link, index) => (
              <label key={`link-${index}`}>
                <input type="checkbox" checked={selected.has(`links-${index}`)} onChange={(event) => toggle(`links-${index}`, event.target.checked)} />
                <span><strong>Link · {link.label}</strong><small>{link.url}</small></span>
              </label>
            ))}
          </div>
          <div className={styles.actions}>
            <button className={styles.primary} type="button" disabled={!selected.size || disabled} onClick={apply}>Apply to draft</button>
            <button className={styles.secondary} type="button" onClick={() => setSuggestions(null)}>Dismiss</button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
