"use client";

import Image from "next/image";
import Link from "next/link";
import { AuthLink } from "../auth/auth-dialog";
import { useAccount } from "../auth/use-account";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { templateInfo } from "@/components/templates/meta";
import { ApiError, portfolios, profile } from "@/lib/api";
import { MAX_PORTFOLIOS, type PortfolioSummary, type ProfileContent } from "@/lib/portfolio";
import { fillUsingProfile } from "@/lib/profile";
import styles from "../studio.module.css";
import dashboard from "./dashboard.module.css";
import DashboardPreview from "./dashboard-preview";
import HomeSections from "../home-sections";

const filters = ["All", "Live", "Drafts"] as const;
type Filter = typeof filters[number];

const shortcutPaths = {
  edit: "M4 20l4.5-1 10-10-3.5-3.5-10 10L4 20Zm9.5-13 3.5 3.5M17 4l1-1 3.5 3.5-1 1",
  templates: "M3.5 4.5h7v7h-7zM13.5 4.5h7v4h-7zM3.5 14.5h7v5h-7zM13.5 11.5h7v8h-7z",
  profile: "M5 4.5h14v15H5zM9 4.5v-2m6 2v-2M9 16c0-1.7 1.4-3 3-3s3 1.3 3 3m-1-6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  add: "M5 4h10l4 4v12H5zM15 4v4h4m-11 6h8m-4-4v8",
  admin: "M12 2.5 19 5v5.5c0 4.7-2.9 7.7-7 10.5-4.1-2.8-7-5.8-7-10.5V5l7-2.5Zm0 5v6m-3-3h6",
} as const;

function ShortcutIcon({ kind }: { kind: keyof typeof shortcutPaths }) {
  return (
    <span className={dashboard.shortcutIcon} data-kind={kind} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={shortcutPaths[kind]} />
      </svg>
    </span>
  );
}

function PortfolioSignal({ item, showcase = false }: { item: PortfolioSummary; showcase?: boolean }) {
  const mode = !item.published ? "draft" : item.has_unpublished_changes ? "pending" : "live";
  return (
    <span className={`${dashboard.signal} ${showcase ? dashboard.showcaseSignal : ""}`} data-status={mode}>
      {mode === "live" && <span className={dashboard.airwaves} aria-hidden="true"><i /><i /><i /></span>}
      {status(item)}
    </span>
  );
}

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
  if (!item.published) return "Draft";
  if (item.has_unpublished_changes) return "Unpublished changes";
  return "Live";
}

export default function Dashboard() {
  const router = useRouter();
  const account = useAccount();
  const isAdmin = account?.is_admin === true;
  const displayName = account?.name?.trim() || account?.email?.split("@")[0];
  const firstName = displayName?.split(/\s+/)[0];
  const requested = useSearchParams().get("template");
  const wantedTemplate = templateInfo.find((template) => template.id === requested && (!template.adminOnly || isAdmin))?.id;
  const [filter, setFilter] = useState<Filter>("All");
  const [copied, setCopied] = useState("");
  const [state, setState] = useState<State>("loading");
  const [items, setItems] = useState<PortfolioSummary[]>([]);
  const [message, setMessage] = useState("");
  const menuPrefix = useId();
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioSummary>();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
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

  useEffect(() => {
    const dialog = deleteDialog.current;
    if (deleteTarget && dialog && !dialog.open) dialog.showModal();
  }, [deleteTarget]);

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

  async function remove(event: FormEvent) {
    event.preventDefault();
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await portfolios.remove(deleteTarget.slug);
      deleteDialog.current?.close();
      setItems((current) => current.filter((entry) => entry.slug !== deleteTarget.slug));
      setMessage("");
      document.getElementById("dashboard-portfolios")?.focus();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Couldn’t delete this portfolio. Please try again.");
    } finally {
      setDeleting(false);
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
                <Link className={`primary-link ${dashboard.shortcut} ${dashboard.shortcutPrimary}`} href={`/editor/${latest.slug}`}><ShortcutIcon kind="edit" /> Continue editing</Link>
              ) : (
                <button type="button" className={`primary-link ${dashboard.shortcut} ${dashboard.shortcutPrimary}`} onClick={() => {
                  setCreating(true);
                  document.getElementById("dashboard-portfolios")?.scrollIntoView();
                }}><ShortcutIcon kind="add" /> Create a portfolio</button>
              )}
              <Link className={dashboard.shortcut} href="/templates"><ShortcutIcon kind="templates" /> Browse templates</Link>
              <Link className={dashboard.shortcut} href="/profile"><ShortcutIcon kind="profile" /> Edit profile</Link>
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
                {latest ? <PortfolioSignal item={latest} showcase /> : <span>{featured.name}</span>}
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
                      {latest || displayName ? (
                        <DashboardPreview template={featured.id} name={latest?.name.trim() || displayName || featured.name} eager />
                      ) : (
                        <Image src={`/designs/${featured.id}.webp`} alt="" width={960} height={675}
                          sizes="(max-width: 750px) 80vw, 550px" fetchPriority="high" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className={dashboard.showcaseFooter}>
                <span>{latest ? "Open editor" : "View template"}</span>
                <ShortcutIcon kind={latest ? "edit" : "templates"} />
              </div>
            </figure>
          </Link>
        </section>
      )}
      <div id="dashboard-portfolios" tabIndex={-1} className={`${styles.titleRow} ${dashboard.portfoliosHeading}`}>
        <div>
          {state === "ready"
            ? <h2 className={dashboard.sectionTitle}>Your portfolios</h2>
            : <h1 className={dashboard.sectionTitle}>Your portfolios</h1>}
          {isAdmin ? (
            <p className={styles.lead}>
              <span className={dashboard.adminPass}><ShortcutIcon kind="admin" /> Admin</span>{" "}
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
            {templateInfo.filter((entry) => !entry.adminOnly || isAdmin).map((template) => (
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
          const design = templateInfo.find((entry) => entry.id === item.template_id);
          return (
            <li key={item.slug} className={dashboard.card}>
              <Link className={dashboard.cardPreview} href={`/editor/${item.slug}`} aria-label={`Edit ${item.name}`}>
                {design && <DashboardPreview template={design.id} name={item.name.trim() || displayName || design.name} />}
              </Link>
              <div className={dashboard.cardInfo}>
                <div className={dashboard.cardHeading}>
                  <h3>{item.name}</h3>
                  <PortfolioSignal item={item} />
                </div>
                <div className={dashboard.cardAddress}>
                  <span>/p/{item.slug}</span>
                  {item.published && (
                    <button type="button" aria-label="Copy link" title={copied === item.slug ? "Copied!" : "Copy link"}
                      data-copied={copied === item.slug || undefined} onClick={() => void copyLink(item.slug)}>
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {copied === item.slug ? <path d="m4 10 4 4 8-8" /> : <path d="M7 7h9v9H7zM4 13V4h9" />}
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className={dashboard.cardActions}>
                <span className={dashboard.cardEdited}>Edited {timeAgo(item.updated_at)} · {design?.name ?? item.template_id}</span>
                <div className={dashboard.controls}>
                  {item.published && <Link href={`/p/${item.slug}`} className={dashboard.viewLive} target="_blank">View live <span aria-hidden="true">↗</span></Link>}
                  <Link href={`/editor/${item.slug}`} className={`${styles.primary} ${dashboard.cardEdit}`}>Edit</Link>
                  <button type="button" className={dashboard.more} aria-label="More portfolio actions"
                    popoverTarget={`${menuPrefix}-${item.slug}`} onClick={(event) => {
                      const menu = document.getElementById(`${menuPrefix}-${item.slug}`);
                      const bounds = event.currentTarget.getBoundingClientRect();
                      menu?.style.setProperty("--menu-right", `${window.innerWidth - bounds.right}px`);
                      menu?.style.setProperty("--menu-top", `${bounds.bottom + 52 > window.innerHeight ? bounds.top - 52 : bounds.bottom + 5}px`);
                    }}>
                    <span aria-hidden="true">•••</span>
                  </button>
                  <div id={`${menuPrefix}-${item.slug}`} popover="auto" className={dashboard.moreMenu}>
                    <button type="button" onClick={(event) => {
                      event.currentTarget.parentElement?.hidePopover();
                      setDeleteError("");
                      setDeleteTarget(item);
                    }}>Delete portfolio</button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <span className={dashboard.copyStatus} role="status">{copied ? "Portfolio link copied." : ""}</span>
      {deleteTarget && (
        <dialog ref={deleteDialog} className="auth-dialog" aria-labelledby="delete-portfolio-title"
          aria-describedby="delete-portfolio-description" onClose={() => setDeleteTarget(undefined)}
          onCancel={(event) => { if (deleting) event.preventDefault(); }}>
          <form className={`auth-dialog-content ${dashboard.deleteDialog}`} onSubmit={remove}>
            <span className={dashboard.deleteIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5" />
              </svg>
            </span>
            <h2 id="delete-portfolio-title">Delete portfolio?</h2>
            <p id="delete-portfolio-description">
              <strong>{deleteTarget.name}</strong> will be permanently deleted.
              {deleteTarget.published && " Its public link will stop working."}
            </p>
            <p className={dashboard.deleteAddress}>/p/{deleteTarget.slug}</p>
            {deleteError && <p className={styles.error} role="alert">{deleteError}</p>}
            <div className={`${styles.actions} ${dashboard.deleteActions}`}>
              <button type="button" className={styles.secondary} disabled={deleting} onClick={() => deleteDialog.current?.close()}>Cancel</button>
              <button type="submit" className={`${styles.danger} ${dashboard.deleteConfirm}`} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete portfolio"}
              </button>
            </div>
          </form>
        </dialog>
      )}
      {state === "ready" && <div className={dashboard.resources}><HomeSections /></div>}
    </main>
  );
}
