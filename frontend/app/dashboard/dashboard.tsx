"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { templateInfo } from "@/components/templates/meta";
import { ApiError, portfolios } from "@/lib/api";
import { MAX_PORTFOLIOS, type PortfolioSummary } from "@/lib/portfolio";
import styles from "../studio.module.css";

type State = "loading" | "signedout" | "ready" | "error";

function toSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/** "3 hours ago". The server sends UTC; SQLite omits the time zone, so one is added when missing. */
function timeAgo(value: string) {
  const then = new Date(/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`).getTime();
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  const units: [number, string][] = [[86400 * 30, "month"], [86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [size, name] of units) {
    if (seconds >= size) { const count = Math.floor(seconds / size); return `${count} ${name}${count === 1 ? "" : "s"} ago`; }
  }
  return "just now";
}

function status(item: PortfolioSummary) {
  if (!item.published) return { label: "Draft", tone: styles.badgeDraft };
  if (item.has_unpublished_changes) return { label: "Unpublished changes", tone: styles.badgeChanged };
  return { label: "Live", tone: styles.badgeLive };
}

export default function Dashboard() {
  const router = useRouter();
  const requested = useSearchParams().get("template");
  const wantedTemplate = templateInfo.find((template) => template.id === requested)?.id;
  const [copied, setCopied] = useState("");
  const [state, setState] = useState<State>("loading");
  const [items, setItems] = useState<PortfolioSummary[]>([]);
  const [message, setMessage] = useState("");
  // Arriving from a template page ("Use this template") opens the form with that design already chosen.
  const [creating, setCreating] = useState(wantedTemplate !== undefined);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [templateId, setTemplateId] = useState(wantedTemplate ?? templateInfo[0].id);

  useEffect(() => {
    let cancelled = false;
    portfolios.list().then(
      (list) => { if (!cancelled) { setItems(list); setState("ready"); } },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) setState("signedout");
        else { setMessage(error instanceof Error ? error.message : "Something went wrong."); setState("error"); }
      },
    );
    return () => { cancelled = true; };
  }, []);

  const full = items.length >= MAX_PORTFOLIOS;

  async function copyLink(slug: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
      setCopied(slug);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setMessage("Could not copy. Open the portfolio and copy the address from the browser.");
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await portfolios.create(slug, {
        template_id: templateId, name: name.trim(), headline: "", bio: "", projects: [], links: [],
      });
      router.push(`/editor/${slug}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function remove(item: PortfolioSummary) {
    if (!window.confirm(`Delete “${item.name}” (/p/${item.slug})? This can’t be undone.`)) return;
    try {
      await portfolios.remove(item.slug);
      setItems((current) => current.filter((entry) => entry.slug !== item.slug));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  if (state === "loading") return <main className={`page-width ${styles.page}`}><p role="status">Loading your portfolios…</p></main>;

  if (state === "signedout") {
    return (
      <main className={`page-width ${styles.page}`}>
        <h1 className={styles.title}>Sign in to build your portfolio.</h1>
        <p className={styles.lead}>Your portfolios are saved to your account, so you can edit and republish them at the same link.</p>
        <Link className="primary-link" href="/auth">Sign in or create an account</Link>
      </main>
    );
  }

  return (
    <main className={`page-width ${styles.page}`}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Your portfolios</h1>
          <p className={styles.lead}>{items.length} of {MAX_PORTFOLIOS} portfolios used</p>
          <div className={styles.meter} role="img" aria-label={`${items.length} of ${MAX_PORTFOLIOS} portfolios used`}>
            {Array.from({ length: MAX_PORTFOLIOS }, (_, index) => <i key={index} data-on={index < items.length} />)}
          </div>
        </div>
        <button type="button" className={styles.primary} disabled={full || state === "error"} onClick={() => setCreating((open) => !open)}>
          {creating ? "Cancel" : "New portfolio"}
        </button>
      </div>

      {message && <p className={styles.error} role="alert">{message}</p>}
      {full && <p className={styles.note}>You’ve reached the limit of {MAX_PORTFOLIOS}. Delete one to make a new one.</p>}

      {creating && !full && (
        <form className={styles.panel} onSubmit={create}>
          <div className={styles.fieldRow}>
            <label>
              Your name
              <input required maxLength={120} value={name} placeholder="Alex Morgan"
                onChange={(event) => { setName(event.target.value); if (!slugEdited) setSlug(toSlug(event.target.value)); }} />
            </label>
            <label>
              Web address
              <span className={styles.addressField}>
                <span aria-hidden="true">/p/</span>
                <input required minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} placeholder="alex-morgan"
                  title="Lowercase letters, numbers and single hyphens, at least 3 characters"
                  onChange={(event) => { setSlug(event.target.value.toLowerCase()); setSlugEdited(true); }} />
              </span>
            </label>
          </div>

          <fieldset className={styles.templates}>
            <legend>Choose a design (you can change it later)</legend>
            {templateInfo.map((template) => (
              <label key={template.id} className={templateId === template.id ? styles.templateActive : undefined}>
                <input type="radio" name="template" value={template.id} checked={templateId === template.id}
                  onChange={() => setTemplateId(template.id)} />
                <span className={styles.swatches} aria-hidden="true">
                  {template.swatches.map((color) => <i key={color} style={{ background: color }} />)}
                </span>
                <strong>{template.name}</strong>
                <small>{template.tagline}</small>
              </label>
            ))}
          </fieldset>

          <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Creating…" : "Create and start editing"}</button>
        </form>
      )}

      {state === "ready" && items.length === 0 && !creating && (
        <div className={styles.empty}>
          <svg aria-hidden="true" viewBox="0 0 120 90" width="120" height="90" fill="none">
            <rect x="14" y="10" width="92" height="64" rx="8" fill="#fff" stroke="#b9bfa9" strokeWidth="2" />
            <path d="M14 26h92" stroke="#b9bfa9" strokeWidth="2" />
            <circle cx="24" cy="18" r="2.5" fill="#b9bfa9" /><circle cx="33" cy="18" r="2.5" fill="#b9bfa9" /><circle cx="42" cy="18" r="2.5" fill="#b9bfa9" />
            <rect x="26" y="38" width="44" height="8" rx="4" fill="#daf977" />
            <rect x="26" y="52" width="68" height="5" rx="2.5" fill="#e3e6d7" /><rect x="26" y="62" width="50" height="5" rx="2.5" fill="#e3e6d7" />
          </svg>
          <h2>No portfolios yet</h2>
          <p>Pick a design, add your projects, and get a link you can share.</p>
          <button type="button" className={styles.primary} onClick={() => setCreating(true)}>Create your first portfolio</button>
        </div>
      )}

      <ul className={styles.list}>
        {items.map((item) => {
          const badge = status(item);
          return (
            <li key={item.slug} className={styles.card}>
              <div className={styles.cardMain}>
                <span className={styles.cardSwatch} aria-hidden="true"
                  style={{ background: `linear-gradient(135deg, ${(templateInfo.find((entry) => entry.id === item.template_id)?.swatches ?? ["#ddd", "#bbb"]).join(", ")})` }}>
                  {item.name.trim()[0]?.toUpperCase()}
                </span>
                <div>
                  <h2>{item.name}</h2>
                  <p className={styles.meta}>/p/{item.slug} · {templateInfo.find((entry) => entry.id === item.template_id)?.name ?? item.template_id}</p>
                  <span className={`${styles.badge} ${badge.tone}`}>{badge.label}</span>
                  <span className={styles.updated}> Edited {timeAgo(item.updated_at)}</span>
                </div>
              </div>
              <div className={styles.actions}>
                <Link href={`/editor/${item.slug}`} className={styles.primary}>Edit</Link>
                {item.published && <Link href={`/p/${item.slug}`} className={styles.secondary} target="_blank">View live</Link>}
                {item.published && <button type="button" className={styles.secondary} onClick={() => copyLink(item.slug)}>{copied === item.slug ? "Copied!" : "Copy link"}</button>}
                <button type="button" className={styles.danger} onClick={() => remove(item)}>Delete</button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
