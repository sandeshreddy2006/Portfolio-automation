"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { templateInfo } from "@/components/templates/meta";
import { ApiError, portfolios } from "@/lib/api";
import type { PortfolioContent, PortfolioDetail } from "@/lib/portfolio";
import AssistButton from "./assist-button";
import ImageField from "./image-field";
import styles from "../../studio.module.css";

type Load = "loading" | "ready" | "signedout" | "missing" | "error";
type Device = "desktop" | "tablet" | "mobile";
type Notice = { kind: "ok" | "error"; text: string } | null;
type Row = { title?: string; url?: string | null; description?: string; image?: string | null };

const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };
// Set when subdomains are switched on (wildcard DNS), for example "portfolabs.com".
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
const MAX_PROJECTS = 30;
const MAX_LINKS = 20;

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/** Drops fully blank rows and trims text. Returns an error if a row is half filled in. */
function prepare(content: PortfolioContent): { value: PortfolioContent; error?: string } {
  const projects: PortfolioContent["projects"] = [];
  for (const [index, project] of content.projects.entries()) {
    const title = project.title.trim();
    const description = project.description.trim();
    const url = (project.url ?? "").trim();
    if (!title && !description && !url) continue;
    if (!title) return { value: content, error: `Project ${index + 1} needs a title.` };
    projects.push({ title, description, url: url || null, image: project.image || null });
  }
  const links: PortfolioContent["links"] = [];
  for (const [index, link] of content.links.entries()) {
    const label = link.label.trim();
    const url = link.url.trim();
    if (!label && !url) continue;
    if (!label || !url) return { value: content, error: `Link ${index + 1} needs both a label and a web address.` };
    links.push({ label, url });
  }
  return {
    value: { ...content, avatar: content.avatar || null, search_visible: content.search_visible === true, name: content.name.trim(), headline: content.headline.trim(), bio: content.bio.trim(), projects, links },
  };
}

/** What the preview shows while typing: unfinished rows are simply left out. */
function forPreview(content: PortfolioContent): PortfolioContent {
  return {
    ...content,
    name: content.name.trim() || "Your name",
    projects: content.projects.filter((project) => project.title.trim()),
    links: content.links.filter((link) => link.label.trim() && link.url.trim()),
  };
}

export default function Editor({ slug }: { slug: string }) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>("loading");
  const [detail, setDetail] = useState<PortfolioDetail | null>(null);
  const [content, setContent] = useState<PortfolioContent | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [frameReady, setFrameReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [newAddress, setNewAddress] = useState(slug);
  const frame = useRef<HTMLIFrameElement>(null);

  const adopt = useCallback((next: PortfolioDetail) => {
    setDetail(next);
    setContent(next.draft_content);
    setSaved(JSON.stringify(next.draft_content));
  }, []);

  useEffect(() => {
    let cancelled = false;
    portfolios.get(slug).then(
      (next) => { if (!cancelled) { adopt(next); setLoad("ready"); } },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) setLoad("signedout");
        else if (error instanceof ApiError && error.status === 404) setLoad("missing");
        else { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Something went wrong." }); setLoad("error"); }
      },
    );
    return () => { cancelled = true; };
  }, [slug, adopt]);

  const dirty = content !== null && JSON.stringify(content) !== saved;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The preview is a separate page in an iframe, so it gets real device widths.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === "preview-ready") {
        setFrameReady(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!frameReady || !content) return;
    frame.current?.contentWindow?.postMessage({ type: "portfolio-preview", content: forPreview(content) }, window.location.origin);
  }, [content, frameReady, load]);

  function update(patch: Partial<PortfolioContent>) {
    setContent((current) => (current ? { ...current, ...patch } : current));
    setNotice(null);
  }

  async function saveDraft(): Promise<PortfolioDetail | null> {
    if (!content || !detail) return null;
    const { value, error } = prepare(content);
    if (error) { setNotice({ kind: "error", text: error }); return null; }
    if (!value.name) { setNotice({ kind: "error", text: "Add your name first." }); return null; }
    const next = await portfolios.save(slug, value, detail.revision);
    adopt(next);
    return next;
  }

  async function run(action: "save" | "publish" | "unpublish") {
    setBusy(action);
    setNotice(null);
    try {
      if (action === "unpublish") {
        adopt(await portfolios.unpublish(slug));
        setNotice({ kind: "ok", text: "Your portfolio is no longer public." });
      } else {
        const draft = await saveDraft();
        if (!draft) return;
        if (action === "publish") {
          adopt(await portfolios.publish(slug));
          setNotice({ kind: "ok", text: "Published. Your changes are live." });
        } else {
          setNotice({ kind: "ok", text: "Draft saved." });
        }
      }
    } catch (error) {
      setConflict(error instanceof ApiError && error.status === 409 && /another tab/i.test(error.message));
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy("");
    }
  }

  /** Someone saved this portfolio elsewhere. Drop this tab's unsaved edits and load the newest version. */
  async function loadLatest() {
    try {
      adopt(await portfolios.get(slug));
      setConflict(false);
      setNotice({ kind: "ok", text: "Loaded the latest version." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Something went wrong." });
    }
  }

  async function changeAddress() {
    setBusy("rename");
    setNotice(null);
    try {
      const next = await portfolios.rename(slug, newAddress.trim());
      router.replace(`/editor/${next.slug}`);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Something went wrong." });
      setBusy("");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice({ kind: "error", text: "Couldn’t copy. Select the link and copy it manually." });
    }
  }

  if (load === "loading") return <main className={`page-width ${styles.page}`}><p role="status">Loading your portfolio…</p></main>;
  if (load === "signedout") {
    return (
      <main className={`page-width ${styles.page}`}>
        <h1 className={styles.title}>Sign in to edit.</h1>
        <Link className="primary-link" href="/auth">Sign in</Link>
      </main>
    );
  }
  if (load === "missing" || load === "error" || !content || !detail) {
    return (
      <main className={`page-width ${styles.page}`}>
        <h1 className={styles.title}>{load === "missing" ? "We can’t find that portfolio." : "Something went wrong."}</h1>
        {notice && <p className={styles.error} role="alert">{notice.text}</p>}
        <Link className="primary-link" href="/dashboard">Back to your portfolios</Link>
      </main>
    );
  }

  const live = detail.published;
  const statusText = !live ? "Draft — not public yet" : detail.has_unpublished_changes || dirty ? "Live, with changes not yet published" : "Live";

  return (
    <main className={styles.editor} data-tab={tab}>
      <div className={styles.toolbar}>
        <div>
          <Link href="/dashboard" className={styles.back}>← All portfolios</Link>
          <p className={styles.status}>
            <span className={`${styles.dot} ${live ? styles.dotLive : ""}`} aria-hidden="true" />
            {statusText}{dirty ? " · unsaved edits" : ""}
          </p>
        </div>
        <div className={styles.actions}>
          {live && (
            <>
              <button type="button" className={styles.secondary} onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
              <Link href={`/p/${slug}`} target="_blank" className={styles.secondary}>View live</Link>
            </>
          )}
          <button type="button" className={styles.secondary} disabled={!dirty || busy !== ""} onClick={() => run("save")}>
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
          <button type="button" className={styles.primary} disabled={busy !== "" || (live && !dirty && !detail.has_unpublished_changes)} onClick={() => run("publish")}>
            {busy === "publish" ? "Publishing…" : live ? "Publish changes" : "Publish"}
          </button>
        </div>
      </div>

      {notice && (
        <p className={notice.kind === "ok" ? styles.success : styles.error} role={notice.kind === "ok" ? "status" : "alert"}>
          {notice.text}
          {conflict && <> <button type="button" className={styles.linkButton} onClick={loadLatest}>Load the latest version</button></>}
        </p>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Editor view">
        <button type="button" role="tab" aria-selected={tab === "edit"} onClick={() => setTab("edit")}>Edit</button>
        <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>Preview</button>
      </div>

      <div className={styles.split}>
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); run("save"); }}>
          <nav className={styles.sectionNav} aria-label="Jump to a section">
            {[["design", "Design"], ["about", "About you"], ["projects", "Projects"], ["links", "Links"], ["visibility", "Address"]].map(([id, label]) => (
              <a key={id} href={`#sec-${id}`}>{label}</a>
            ))}
          </nav>
          <section id="sec-design" className={styles.group}>
            <h2>Design</h2>
            <div className={styles.templatePicker}>
              {templateInfo.map((template) => (
                <label key={template.id} className={content.template_id === template.id ? styles.templateActive : undefined}>
                  <input type="radio" name="template" value={template.id} checked={content.template_id === template.id}
                    onChange={() => update({ template_id: template.id })} />
                  <span className={styles.swatches} aria-hidden="true">
                    {template.swatches.map((color) => <i key={color} style={{ background: color }} />)}
                  </span>
                  <strong>{template.name}</strong>
                </label>
              ))}
            </div>
          </section>

          <section id="sec-about" className={styles.group}>
            <h2>About you</h2>
            <ImageField label="Profile photo" kind="avatar" value={content.avatar}
              hint="Optional. A clear, square-ish photo works best."
              onChange={(url) => update({ avatar: url })} />
            <label>Name
              <input required maxLength={120} value={content.name} onChange={(event) => update({ name: event.target.value })} />
            </label>
            <label>Headline
              <input maxLength={160} value={content.headline} placeholder="e.g. Product designer & front-end developer"
                onChange={(event) => update({ headline: event.target.value })} />
              <small>One line that says what you do. {content.headline.length}/160</small>
            </label>
            <AssistButton task="headline" text={content.headline} name={content.name}
              onAccept={(text) => update({ headline: text })} />
            <label>Bio
              <textarea rows={7} maxLength={4000} value={content.bio}
                placeholder="Who are you, what do you care about, and what are you working towards? Leave a blank line between paragraphs."
                onChange={(event) => update({ bio: event.target.value })} />
              <small>{content.bio.length}/4000</small>
            </label>
            <AssistButton task="bio" text={content.bio} name={content.name}
              onAccept={(text) => update({ bio: text })} />
          </section>

          <section id="sec-projects" className={styles.group}>
            <h2>Projects <span>({content.projects.length}/{MAX_PROJECTS})</span></h2>
            <p className={styles.hint}>For each one: what did you build, what was your part, and what did you learn?</p>
            {content.projects.map((project: Row, index) => (
              <fieldset key={index} className={styles.row}>
                <legend>Project {index + 1}</legend>
                <label>Title
                  <input maxLength={120} value={project.title ?? ""}
                    onChange={(event) => update({ projects: content.projects.map((item, at) => at === index ? { ...item, title: event.target.value } : item) })} />
                </label>
                <label>Description
                  <textarea rows={4} maxLength={4000} value={project.description ?? ""}
                    onChange={(event) => update({ projects: content.projects.map((item, at) => at === index ? { ...item, description: event.target.value } : item) })} />
                </label>
                <AssistButton task="project" text={project.description ?? ""} name={content.name} title={project.title ?? ""}
                  onAccept={(text) => update({ projects: content.projects.map((item, at) => at === index ? { ...item, description: text } : item) })} />
                <label>Link (optional)
                  <input type="url" inputMode="url" placeholder="https://" value={project.url ?? ""}
                    onChange={(event) => update({ projects: content.projects.map((item, at) => at === index ? { ...item, url: event.target.value } : item) })} />
                </label>
                <ImageField label="Project image (optional)" kind="project" value={project.image}
                  hint="A screenshot or cover image. Wide images look best."
                  onChange={(url) => update({ projects: content.projects.map((item, at) => at === index ? { ...item, image: url } : item) })} />
                <div className={styles.rowActions}>
                  <button type="button" aria-label={`Move project ${index + 1} up`} disabled={index === 0} onClick={() => update({ projects: move(content.projects, index, index - 1) })}>↑</button>
                  <button type="button" aria-label={`Move project ${index + 1} down`} disabled={index === content.projects.length - 1} onClick={() => update({ projects: move(content.projects, index, index + 1) })}>↓</button>
                  <button type="button" className={styles.danger} onClick={() => update({ projects: content.projects.filter((_, at) => at !== index) })}>Remove</button>
                </div>
              </fieldset>
            ))}
            <button type="button" className={styles.secondary} disabled={content.projects.length >= MAX_PROJECTS}
              onClick={() => update({ projects: [...content.projects, { title: "", description: "", url: "", image: null }] })}>
              Add a project
            </button>
          </section>

          <section id="sec-links" className={styles.group}>
            <h2>Links <span>({content.links.length}/{MAX_LINKS})</span></h2>
            {content.links.map((link, index) => (
              <fieldset key={index} className={styles.row}>
                <legend>Link {index + 1}</legend>
                <div className={styles.fieldRow}>
                  <label>Label
                    <input maxLength={120} value={link.label} placeholder="GitHub"
                      onChange={(event) => update({ links: content.links.map((item, at) => at === index ? { ...item, label: event.target.value } : item) })} />
                  </label>
                  <label>Web address
                    <input type="url" inputMode="url" placeholder="https://" value={link.url}
                      onChange={(event) => update({ links: content.links.map((item, at) => at === index ? { ...item, url: event.target.value } : item) })} />
                  </label>
                </div>
                <div className={styles.rowActions}>
                  <button type="button" aria-label={`Move link ${index + 1} up`} disabled={index === 0} onClick={() => update({ links: move(content.links, index, index - 1) })}>↑</button>
                  <button type="button" aria-label={`Move link ${index + 1} down`} disabled={index === content.links.length - 1} onClick={() => update({ links: move(content.links, index, index + 1) })}>↓</button>
                  <button type="button" className={styles.danger} onClick={() => update({ links: content.links.filter((_, at) => at !== index) })}>Remove</button>
                </div>
              </fieldset>
            ))}
            <button type="button" className={styles.secondary} disabled={content.links.length >= MAX_LINKS}
              onClick={() => update({ links: [...content.links, { label: "", url: "" }] })}>
              Add a link
            </button>
          </section>

          <section id="sec-visibility" className={styles.group}>
            <h2>Address and visibility</h2>
            <div className={styles.rename}>
              <label>Web address
                <span className={styles.addressField}>
                  <span aria-hidden="true">/p/</span>
                  <input value={newAddress} minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    title="Lowercase letters, numbers and single hyphens, at least 3 characters"
                    onChange={(event) => setNewAddress(event.target.value.toLowerCase())} />
                </span>
              </label>
              <button type="button" className={styles.secondary} onClick={changeAddress}
                disabled={busy !== "" || dirty || newAddress === slug || newAddress.length < 3}>
                {busy === "rename" ? "Changing…" : "Change address"}
              </button>
              <small>
                {dirty ? "Save your edits first. " : ""}Links you already shared keep working: the old address sends visitors to the new one for 30 days.
              </small>
            </div>
            <label className={styles.check}>
              <input type="checkbox" checked={content.search_visible === true}
                onChange={(event) => update({ search_visible: event.target.checked })} />
              <span>Let search engines like Google find this page
                <small>Off by default. Anyone with your link can still open it either way. Takes effect when you publish.</small>
              </span>
            </label>
            {live && (
              <>
                <p className={styles.hint}>
                  Your portfolio is public at <Link href={`/p/${slug}`} target="_blank">/p/{slug}</Link>
                  {ROOT_DOMAIN && <> and <a href={`https://${slug}.${ROOT_DOMAIN}`} target="_blank" rel="noopener noreferrer">{slug}.{ROOT_DOMAIN}</a></>}.
                </p>
                <button type="button" className={styles.danger} disabled={busy !== ""} onClick={() => run("unpublish")}>
                  {busy === "unpublish" ? "Working…" : "Take it offline"}
                </button>
              </>
            )}
          </section>
        </form>

        <aside className={styles.preview} aria-label="Live preview">
          <div className={styles.previewBar}>
            <span>Live preview</span>
            <div role="group" aria-label="Preview size">
              {(["desktop", "tablet", "mobile"] as const).map((size) => (
                <button key={size} type="button" aria-pressed={device === size} onClick={() => setDevice(size)}>
                  {size[0].toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.previewStage}>
            <iframe ref={frame} title="Portfolio preview" src="/preview-frame" style={{ width: DEVICE_WIDTH[device] }} />
          </div>
        </aside>
      </div>
    </main>
  );
}
