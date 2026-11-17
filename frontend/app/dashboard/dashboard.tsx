"use client";

import Image from "next/image";
import Link from "next/link";
import { AuthLink } from "../auth/auth-dialog";
import { useAccount } from "../auth/use-account";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type PointerEvent } from "react";
import { templateInfo } from "@/components/templates/meta";
import { ApiError, portfolios, profile } from "@/lib/api";
import { MAX_PORTFOLIOS, type PortfolioSummary, type ProfileContent } from "@/lib/portfolio";
import { fillUsingProfile } from "@/lib/profile";
import styles from "../studio.module.css";
import dashboard from "./dashboard.module.css";

const filters = ["All", "Live", "Drafts"] as const;
type Filter = typeof filters[number];

function tiltPreview(event: PointerEvent<HTMLAnchorElement>) {
  if (event.pointerType !== "mouse" || !matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--tilt-x", `${(0.5 - (event.clientY - bounds.top) / bounds.height) * 9}deg`);
  event.currentTarget.style.setProperty("--tilt-y", `${((event.clientX - bounds.left) / bounds.width - 0.5) * 12}deg`);
}

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
  const account = useAccount();
  const isAdmin = account?.is_admin === true;
  const firstName = account?.name.trim().split(/\s+/)[0];
  const requested = useSearchParams().get("template");
  const wantedTemplate = templateInfo.find((template) => template.id === requested)?.id;
  const [filter, setFilter] = useState<Filter>("All");
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
  const [profileContent, setProfileContent] = useState<ProfileContent>();
  const [useProfile, setUseProfile] = useState(false);
  const [useProfilePhoto, setUseProfilePhoto] = useState(false);
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

  useEffect(() => {
    if (state !== "ready" || !creating) return;
    let active = true;
    profile.get().then(({ content }) => { if (active) setProfileContent(content); }).catch(() => {});
    return () => { active = false; };
  }, [state, creating]);

  const full = !isAdmin && items.length >= MAX_PORTFOLIOS;
  const liveCount = items.filter((item) => item.published).length;
  const latest = items.reduce<PortfolioSummary | undefined>((current, item) =>
    !current || item.updated_at > current.updated_at ? item : current, undefined);
  const featured = templateInfo.find((template) => template.id === (latest?.template_id ?? wantedTemplate)) ?? templateInfo[0];
  const visibleItems = items.filter((item) => filter === "All" || item.published === (filter === "Live"));

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
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const initial = { template_id: templateId, name: name.trim(), headline: "", bio: "", projects: [], links: [] };
      const content = useProfile && profileContent ? fillUsingProfile(initial, profileContent, useProfilePhoto)
        : useProfilePhoto && profileContent ? { ...initial, avatar: profileContent.avatar, avatar_framing: profileContent.avatar_framing } : initial;
      const created = await portfolios.create(slug, content);
      setItems((current) => [created, ...current.filter((item) => item.slug !== created.slug)]);
      setCreating(false);
      setFilter("All");
      setName("");
      setSlug("");
      setSlugEdited(false);
      setUseProfile(false);
      setUseProfilePhoto(false);
      setTemplateId(wantedTemplate ?? templateInfo[0].id);
      router.push(`/editor/${created.slug}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
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
        <AuthLink className="primary-link" destination={wantedTemplate ? `/dashboard?template=${wantedTemplate}` : "/dashboard"}>Sign in or create an account</AuthLink>
      </main>
    );
  }

  return (
    <main className={`page-width ${styles.page}`}>
      {state === "ready" && (
        <section className={`landing hero ${dashboard.hero}`} aria-labelledby="workspace-title">
          <div>
            <p className="eyebrow intro-label"><span aria-hidden="true" /> Your portfolio workspace</p>
            <h1 id="workspace-title">
              <span className="headline-line"><span>{firstName ? "Welcome," : "Make it"}</span></span>
              <span className="headline-line"><span>{firstName ? `${firstName}.` : "yours."}</span></span>
            </h1>
            <p className="hero-description">
              {latest ? <>Pick up where you left off with <strong>{latest.name}</strong>.</> : "Choose a design and give your best work a home."}
            </p>
            <div className="hero-actions">
              {latest ? (
                <Link className="primary-link" href={`/editor/${latest.slug}`}>Continue editing <span aria-hidden="true">↗</span></Link>
              ) : (
                <button type="button" className="primary-link" onClick={() => {
                  setCreating(true);
                  document.getElementById("dashboard-portfolios")?.scrollIntoView();
                }}>Create a portfolio <span aria-hidden="true">↗</span></button>
              )}
              <Link className="source-link" href="/templates">Browse templates <span aria-hidden="true">↗</span></Link>
              <Link className="source-link" href="/profile">Edit profile <span aria-hidden="true">↗</span></Link>
            </div>
          </div>

          <Link className={dashboard.showcaseLink} href={latest ? `/editor/${latest.slug}` : `/templates/${featured.id}`}
            aria-label={latest ? `Open editor for ${latest.name}` : `Preview the ${featured.name} template`}
            onPointerMove={tiltPreview} onPointerLeave={(event) => {
              event.currentTarget.style.removeProperty("--tilt-x");
              event.currentTarget.style.removeProperty("--tilt-y");
            }}>
            <figure className={`preview ${dashboard.showcase}`}>
              <figcaption className="preview-caption">
                <span>{latest ? "Last edited portfolio" : "Explore a template"}</span>
                <span>{latest ? status(latest).label : featured.name}</span>
              </figcaption>
              <div className="preview-stage">
                <div className="preview-orbit" aria-hidden="true" />
                <div className="preview-orbit preview-orbit-inner" aria-hidden="true" />
                <div className={dashboard.tilt}>
                  <div className="preview-window">
                    <div className="window-bar">
                      <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
                      <span>{featured.name} template preview</span>
                    </div>
                    <div className="preview-template">
                      <Image src={`/designs/${featured.id}.webp`} alt="" width={960} height={675}
                        sizes="(max-width: 750px) 80vw, 550px" fetchPriority="high" />
                    </div>
                  </div>
                </div>
              </div>
              <div className={dashboard.showcaseFooter}>
                <span>{latest ? "Open editor" : "View template"}</span>
                <span aria-hidden="true">↗</span>
              </div>
            </figure>
          </Link>
        </section>
      )}
      <div id="dashboard-portfolios" className={`${styles.titleRow} ${dashboard.portfoliosHeading}`}>
        <div>
          {state === "ready"
            ? <h2 className={dashboard.sectionTitle}>Your portfolios</h2>
            : <h1 className={dashboard.sectionTitle}>Your portfolios</h1>}
          {isAdmin ? (
            <p className={styles.lead}>
              <span className={`${styles.badge} ${styles.badgeLive}`}>Admin</span>{" "}
              {items.length} {items.length === 1 ? "portfolio" : "portfolios"} · Unlimited
            </p>
          ) : (
            <>
              <p className={styles.lead}>{items.length} of {MAX_PORTFOLIOS} portfolios used</p>
              <div className={styles.meter} role="img" aria-label={`${items.length} of ${MAX_PORTFOLIOS} portfolios used`}>
                {Array.from({ length: MAX_PORTFOLIOS }, (_, index) => <i key={index} data-on={index < items.length} />)}
              </div>
            </>
          )}
        </div>
        <button type="button" className={styles.primary} disabled={busy || full || state === "error"} onClick={() => setCreating((open) => !open)}>
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

          {profileContent && (
            <>
              <label className={styles.profileCheck}><input type="checkbox" checked={useProfile} onChange={(event) => {
                const checked = event.target.checked;
                setUseProfile(checked);
                if (checked && !name.trim()) {
                  setName(profileContent.name);
                  if (!slugEdited) setSlug(toSlug(profileContent.name));
                }
              }} /> Fill using profile</label>
              {profileContent.avatar && (
                <label className={styles.profileCheck}><input type="checkbox" checked={useProfilePhoto}
                  onChange={(event) => setUseProfilePhoto(event.target.checked)} /> Use my profile photo</label>
              )}
            </>
          )}
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

      {items.length > 0 && (
        <div className={dashboard.filters} role="group" aria-label="Filter portfolios">
          {filters.map((option) => (
            <button key={option} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)}>
              {option} <span>{option === "All" ? items.length : option === "Live" ? liveCount : items.length - liveCount}</span>
            </button>
          ))}
        </div>
      )}
      {items.length > 0 && visibleItems.length === 0 && (
        <p className={styles.note}>No {filter === "Live" ? "live portfolios" : "drafts"} yet.</p>
      )}
      <ul className={dashboard.cards}>
        {visibleItems.map((item) => {
          const badge = status(item);
          const design = templateInfo.find((entry) => entry.id === item.template_id);
          return (
            <li key={item.slug} className={dashboard.card}>
              <Link className={dashboard.cardPreview} href={`/editor/${item.slug}`} aria-label={`Edit ${item.name}`}>
                {design && <Image src={`/designs/${design.id}.webp`} alt="" width={960} height={675}
                  sizes="(max-width: 700px) 90vw, (max-width: 1100px) 45vw, 360px" />}
              </Link>
              <div className={dashboard.cardInfo}>
                <div className={dashboard.cardHeading}>
                  <h3>{item.name}</h3>
                  <span className={`${styles.badge} ${badge.tone}`}>{badge.label}</span>
                </div>
                <p className={styles.meta}>/p/{item.slug} · {design?.name ?? item.template_id}</p>
                <span className={styles.updated}>Edited {timeAgo(item.updated_at)}</span>
              </div>
              <div className={`${styles.actions} ${dashboard.cardActions}`}>
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
