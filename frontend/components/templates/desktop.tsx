"use client";

import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { initials, paragraphs, safeHref, safeImage, type PortfolioContent } from "@/lib/portfolio";
import { CareerSections } from "./career-sections";
import { UserImage } from "./user-image";
import styles from "./desktop.module.css";

type AppIcon = "about" | "career" | "project" | "links" | "resume";
type DesktopApp = { id: string; label: string; icon: AppIcon; body: ReactNode };
type DesktopWindow = { x: number; y: number; z: number; minimized?: boolean; maximized?: boolean };
type Drag = { id: string; pointer: number; startX: number; startY: number; x: number; y: number; maxX: number; maxY: number };

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const vectors: Partial<Record<string, [number, number]>> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const icons: Record<AppIcon, string> = { about: "☺", career: "▤", project: "▰", links: "↗", resume: "⇩" };
const clamp = (value: number, max: number) => Math.min(Math.max(0, value), Math.max(0, max));

export function Desktop({ content, resumeHref }: { content: PortfolioContent; resumeHref?: string }) {
  const { name, headline, bio, avatar, projects, experience, credentials, links } = content;
  const enhanced = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const prefix = useId();
  const workspace = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLDetailsElement>(null);
  const drag = useRef<Drag | null>(null);
  const stack = useRef(1);
  const pendingFocus = useRef<string>(null);
  const [windows, setWindows] = useState<Record<string, DesktopWindow>>({ about: { x: 0, y: 0, z: 1 } });
  useLayoutEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    document.getElementById(`${prefix}-${id}-window`)?.focus({ preventScroll: matchMedia("(min-width: 761px)").matches });
  }, [prefix, windows]);

  const apps: DesktopApp[] = [{
    id: "about", label: "About me", icon: "about",
    body: (
      <>
        <div className={styles.identity}>
          {safeImage(avatar) ? (
            <UserImage src={avatar} framing={content.avatar_framing} alt={`Photo of ${name}`} className={styles.avatar} />
          ) : <span className={styles.avatar} aria-hidden="true">{initials(name)}</span>}
          <div><h2>{name}</h2>{headline && <p>{headline}</p>}</div>
        </div>
        {paragraphs(bio).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </>
    ),
  }];
  apps.push(...projects.map((project, index): DesktopApp => {
    const href = safeHref(project.url);
    return {
      id: `project-${index}`, label: project.title || `Project ${index + 1}`, icon: "project",
      body: (
        <>
          <UserImage src={project.image} framing={project.image_framing} className={styles.cover} />
          {project.description && <p className={styles.description}>{project.description}</p>}
          {href && <a className={styles.action} href={href} target="_blank" rel="noopener noreferrer">Open project ↗</a>}
        </>
      ),
    };
  }));
  if (experience?.length || credentials?.length) {
    apps.push({
      id: "career", label: "Career", icon: "career",
      body: <CareerSections experience={experience} credentials={credentials} />,
    });
  }
  if (links.length) {
    apps.push({
      id: "links", label: "Links", icon: "links",
      body: (
        <ul className={styles.linkList}>
          {links.map((link, index) => {
            const href = safeHref(link.url);
            return <li key={index}>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a> : link.label}</li>;
          })}
        </ul>
      ),
    });
  }
  if (resumeHref) {
    apps.push({
      id: "resume", label: "Résumé", icon: "resume",
      body: <a className={styles.action} href={resumeHref} download="resume.pdf">Download résumé ⇩</a>,
    });
  }

  const active = apps.filter(({ id }) => windows[id] && !windows[id].minimized)
    .reduce<string | undefined>((top, { id }) => top === undefined || windows[id].z > windows[top].z ? id : top, undefined);

  function changeWindow(id: string, patch: Partial<DesktopWindow>) {
    setWindows((current) => current[id] ? { ...current, [id]: { ...current[id], ...patch } } : current);
  }

  function openApp(id: string) {
    const z = ++stack.current;
    setWindows((current) => {
      const offset = Object.keys(current).length % 5;
      const position = current[id] ?? { x: offset * 22, y: offset * 20 };
      return { ...current, [id]: { ...position, minimized: false, z } };
    });
  }

  function launchApp(id: string) {
    pendingFocus.current = id;
    openApp(id);
  }

  function returnFocus(id: string) {
    const shortcut = document.getElementById(`${prefix}-${id}-shortcut`);
    if (shortcut instanceof HTMLElement) shortcut.focus({ preventScroll: true });
  }

  function closeApp(id: string) {
    setWindows((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    returnFocus(id);
  }

  function minimizeApp(id: string) {
    changeWindow(id, { minimized: true });
    returnFocus(id);
  }

  function bounds(panel: HTMLElement) {
    const desktop = workspace.current;
    return {
      maxX: (desktop?.clientWidth ?? 0) - panel.offsetLeft - panel.offsetWidth - 12,
      maxY: (desktop?.clientHeight ?? 0) - panel.offsetTop - 190,
    };
  }

  function beginDrag(event: PointerEvent<HTMLButtonElement>, id: string) {
    const panel = event.currentTarget.closest<HTMLElement>("[data-window]");
    if (!panel || event.button !== 0 || windows[id].maximized || !matchMedia("(min-width: 761px)").matches) return;
    const { x, y } = windows[id];
    const { maxX, maxY } = bounds(panel);
    drag.current = {
      id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: clamp(x, maxX), y: clamp(y, maxY), maxX, maxY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const item = drag.current;
    if (!item || item.pointer !== event.pointerId) return;
    changeWindow(item.id, {
      x: clamp(item.x + event.clientX - item.startX, item.maxX),
      y: clamp(item.y + event.clientY - item.startY, item.maxY),
    });
  }

  function moveWithKeys(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const vector = vectors[event.key];
    const panel = event.currentTarget.closest<HTMLElement>("[data-window]");
    if (!vector || !panel || windows[id].maximized || !matchMedia("(min-width: 761px)").matches) return;
    event.preventDefault();
    const { maxX, maxY } = bounds(panel);
    const { x, y } = windows[id];
    changeWindow(id, { x: clamp(clamp(x, maxX) + vector[0] * 20, maxX), y: clamp(clamp(y, maxY) + vector[1] * 20, maxY) });
  }

  return (
    <main className={styles.root} data-enhanced={enhanced || undefined}>
      <div className={styles.workspace} ref={workspace}>
        <header className={styles.heading}>
          <h1>{name}<span aria-hidden="true"> / Desktop</span></h1>
          <p>Open an icon to explore.{enhanced && <span className={styles.dragHint}> Drag a title bar to move its window.</span>}</p>
        </header>
        {enhanced && (
          <nav className={styles.shortcuts} aria-label="Desktop apps">
            {apps.map((app) => (
              <button id={`${prefix}-${app.id}-shortcut`} className={styles.shortcut} key={app.id} type="button"
                aria-controls={`${prefix}-${app.id}-window`} onClick={() => launchApp(app.id)}>
                <span className={styles.icon} data-kind={app.icon} aria-hidden="true">{icons[app.icon]}</span>
                <span>{app.label}</span>
              </button>
            ))}
          </nav>
        )}
        <div className={styles.apps}>
          {apps.map((app) => {
            const item = windows[app.id];
            const isActive = app.id === active;
            return (
              <details key={app.id} className={styles.app} open={Boolean(item)}>
                <summary className={styles.shortcut}>
                  <span className={styles.icon} data-kind={app.icon} aria-hidden="true">{icons[app.icon]}</span>
                  <span>{app.label}</span>
                </summary>
                <section id={`${prefix}-${app.id}-window`} className={styles.window} data-window data-active={isActive}
                  data-maximized={item?.maximized || undefined} hidden={item?.minimized} aria-label={app.label} tabIndex={enhanced ? -1 : undefined}
                  style={item && enhanced ? { "--x": `${item.x}px`, "--y": `${item.y}px`, zIndex: item.z } as CSSProperties : undefined}
                  onPointerDown={() => { if (enhanced && !isActive) openApp(app.id); }}
                  onFocus={() => { if (enhanced && !isActive) openApp(app.id); }}
                  onKeyDown={(event) => { if (enhanced && event.key === "Escape") { event.stopPropagation(); closeApp(app.id); } }}>
                  <div className={styles.titlebar}>
                    <span className={styles.staticTitle}>{app.label}</span>
                    <button type="button" className={styles.handle} aria-label={`Move ${app.label} window with arrow keys`}
                      onPointerDown={(event) => beginDrag(event, app.id)} onPointerMove={moveDrag}
                      onLostPointerCapture={() => { drag.current = null; }}
                      onKeyDown={(event) => moveWithKeys(event, app.id)}>{app.label}</button>
                    <div className={styles.controls}>
                      <button type="button" aria-label={`Minimize ${app.label}`} onClick={() => minimizeApp(app.id)}>−</button>
                      <button type="button" className={styles.maximize} aria-label={`${item?.maximized ? "Restore" : "Maximize"} ${app.label}`}
                        onClick={() => changeWindow(app.id, { maximized: !item?.maximized })}>{item?.maximized ? "❐" : "□"}</button>
                      <button type="button" aria-label={`Close ${app.label}`} onClick={() => closeApp(app.id)}>×</button>
                    </div>
                  </div>
                  <div className={styles.body}>{app.body}</div>
                </section>
              </details>
            );
          })}
        </div>
      </div>
      <nav className={styles.taskbar} aria-label="Desktop taskbar">
        <details ref={launcher} className={styles.launcher}>
          <summary><span aria-hidden="true">▦</span> Start</summary>
          <ul>{apps.map((app) => (
            <li key={app.id}><button type="button" onClick={() => {
              if (launcher.current) launcher.current.open = false;
              launchApp(app.id);
            }}><span aria-hidden="true">{icons[app.icon]}</span> {app.label}</button></li>
          ))}</ul>
        </details>
        <div className={styles.tasks} aria-label="Open windows">
          {apps.filter(({ id }) => windows[id]).map((app) => (
            <button type="button" key={app.id} aria-pressed={app.id === active}
              onClick={() => app.id === active ? minimizeApp(app.id) : launchApp(app.id)}>{app.label}</button>
          ))}
        </div>
        <button type="button" className={styles.showDesktop} title="Show desktop" aria-label="Show desktop"
          onClick={() => setWindows((current) => Object.fromEntries(Object.entries(current).map(([id, item]) => [id, { ...item, minimized: true }])))}>▣</button>
      </nav>
    </main>
  );
}
