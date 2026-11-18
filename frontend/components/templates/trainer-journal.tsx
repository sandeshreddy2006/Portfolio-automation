"use client";

import { Press_Start_2P, VT323 } from "next/font/google";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { encounters, trainerGames } from "@/lib/trainer-journal";
import { paragraphs, safeHref, safeImage, type PortfolioContent, type TrainerGame } from "@/lib/portfolio";
import { CareerSections } from "./career-sections";
import { MiniPortfolio, TrainerEncounter, type TownPortfolio } from "./trainer-encounters";
import { UserImage } from "./user-image";
import styles from "./trainer-journal.module.css";

const pixelTitle = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--trainer-title-font" });
const pixelText = VT323({ subsets: ["latin"], weight: "400", variable: "--trainer-text-font" });

const subscribe = () => () => {};
const client = () => true;
const server = () => false;
const directions: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
};

const treePositions = [[0, 0], [1, 0], [4, 0], [5, 0], [10, 0], [11, 0], [0, 4], [3, 4], [8, 4], [11, 4], [0, 7], [1, 7], [4, 7], [7, 7], [10, 7], [11, 7]];

function mapPoint(x: number, y: number): CSSProperties {
  return { left: `${(x + .5) / 12 * 100}%`, top: `${(y + .5) / 8 * 100}%` };
}

export function TrainerJournal({ content, resumeHref, portfolioKey }: {
  content: PortfolioContent; resumeHref?: string; portfolioKey?: string;
}) {
  const enhanced = useSyncExternalStore(subscribe, client, server);
  const [position, setPosition] = useState<[number, number]>([5, 5]);
  const [night, setNight] = useState(false);
  const [boot, setBoot] = useState(true);
  const [active, setActive] = useState<TrainerGame | "published-site">();
  const [badges, setBadges] = useState<TrainerGame[]>([]);
  const [published, setPublished] = useState<TownPortfolio | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opening = useRef<HTMLDialogElement>(null);
  const entries = trainerGames.flatMap((game) => {
    const project = content.projects.find((item) => item.trainer_game === game);
    return project ? [{ game, portfolioProject: project, ...encounters[game] }] : [];
  });
  const selected = entries.find(({ game }) => game === active);
  const siteOpen = active === "published-site" && published !== null;
  const hasCareer = !!(content.experience?.length || content.credentials?.length);
  const hasContact = !!(content.links.length || content.trainer_contact_email);
  const storageKey = portfolioKey ? `portfolabs:trainer-journal:${portfolioKey}` : null;

  useEffect(() => {
    if (!storageKey) return;
    const timer = window.setTimeout(() => {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(saved)) setBadges(trainerGames.filter((game) => saved.includes(game)));
      } catch { /* The game still works without storage. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    const intro = opening.current;
    if (!boot || !enhanced || !portfolioKey || !intro || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!intro.open) intro.showModal();
    const timer = window.setTimeout(() => intro.close(), 2550);
    return () => window.clearTimeout(timer);
  }, [boot, enhanced, portfolioKey]);

  useEffect(() => {
    if ((selected || siteOpen) && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected, siteOpen]);

  function visit(game: TrainerGame) {
    setPosition(encounters[game].position);
    setActive(game);
  }

  function move(direction: [number, number]) {
    setPosition(([x, y]) => [Math.max(0, Math.min(11, x + direction[0])), Math.max(0, Math.min(7, y + direction[1]))]);
  }

  function interact() {
    if (published && Math.abs(5 - position[0]) + Math.abs(7 - position[1]) <= 1) {
      setActive("published-site");
      return;
    }
    const nearby = entries.find((entry) => Math.abs(entry.position[0] - position[0]) + Math.abs(entry.position[1] - position[1]) <= 1);
    if (nearby) visit(nearby.game);
  }

  function onMapKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      move(direction);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      interact();
    }
  }

  function finish(game: TrainerGame) {
    const next = badges.includes(game) ? badges : [...badges, game];
    setBadges(next);
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Optional persistence. */ }
    }
    dialog.current?.close();
  }

  return (
    <main className={`${styles.root} ${pixelTitle.variable} ${pixelText.variable}`} data-night={night || undefined}>
      {enhanced && boot && portfolioKey && (
        <dialog ref={opening} className={styles.boot} aria-label="Trainer Journal intro" onClose={() => setBoot(false)}>
          <div className={styles.bootStage}>
            <div className={styles.bootLandscape} aria-hidden="true" />
            <div className={styles.bootTitle}>
              <strong>Trainer Journal</strong>
              <span>{content.name}</span>
            </div>
            <span className={`${styles.trainer} ${styles.bootActor}`} aria-hidden="true"><i /><i /></span>
            <button type="button" onClick={() => opening.current?.close()}>Skip intro</button>
          </div>
        </dialog>
      )}
      <div className={styles.scenery} aria-hidden="true" />
      <header className={styles.header}>
        <span className={styles.wordmark}>Trainer Journal</span>
        <nav aria-label="Portfolio shortcuts">
          <a href="#trainer-projects">View portfolio</a>
          {resumeHref && <a href={resumeHref} download="resume.pdf">Download résumé</a>}
          {hasCareer && <a href="#trainer-career">Victory Road</a>}
          {hasContact && <a href="#trainer-contact">Contact</a>}
        </nav>
      </header>
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="trainer-title">
          <div>
            <h1 id="trainer-title">{content.name}</h1>
            {content.headline && <p className={styles.headline}>{content.headline}</p>}
          </div>
          <UserImage src={content.avatar} framing={content.avatar_framing} className={styles.avatar} />
        </section>

        {enhanced && (
          <section className={styles.console} aria-labelledby="trainer-map-title">
            <div className={styles.consoleHead}>
              <h2 id="trainer-map-title">Signal Town</h2>
              <button type="button" aria-pressed={night} onClick={() => setNight(!night)}>{night ? "Switch to day" : "Switch to night"}</button>
            </div>
            <div className={styles.map} tabIndex={0} onKeyDown={onMapKey} aria-label="Town map. Use arrow keys or WASD to walk and Enter near a building to visit.">
              <div aria-hidden="true" className={styles.path} />
              <div aria-hidden="true" className={styles.pond} />
              <div aria-hidden="true" className={styles.plaza} />
              {treePositions.map(([x, y]) => <span key={`${x}-${y}`} aria-hidden="true" className={styles.tree} style={mapPoint(x, y)} />)}
              {entries.map(({ game, title, color, position: [x, y] }) => (
                <button type="button" key={game} className={styles.building} data-game={game} style={{ ...mapPoint(x, y), "--roof": color } as CSSProperties}
                  aria-label={`Enter ${title}`} onClick={() => visit(game)}>
                  <span className={styles.house} aria-hidden="true"><i /><i /><b /></span><span>{title}</span>
                </button>
              ))}
              <span className={styles.trainer} aria-hidden="true" style={mapPoint(...position)}><i /><i /></span>
              {published && <button type="button" className={styles.playerSite} onClick={() => { setPosition([5, 7]); setActive("published-site"); }}><i aria-hidden="true" />Mira’s portfolio</button>}
            </div>
            <div className={styles.consoleFoot}>
              <p>{entries.length ? "Use the arrow keys or tap a building to visit." : "Assign encounters to projects in the editor to open the town’s buildings."}</p>
              <p role="status">{entries.filter(({ game }) => badges.includes(game)).length} / {entries.length} badges earned</p>
            </div>
            {entries.length > 0 && (
              <div className={styles.pad} aria-label="Movement controls">
                <button type="button" aria-label="Walk left" onClick={() => move([-1, 0])}>←</button>
                <button type="button" aria-label="Walk up" onClick={() => move([0, -1])}>↑</button>
                <button type="button" aria-label="Walk down" onClick={() => move([0, 1])}>↓</button>
                <button type="button" aria-label="Walk right" onClick={() => move([1, 0])}>→</button>
                <button type="button" onClick={interact}>Enter nearby</button>
              </div>
            )}
          </section>
        )}

        <section className={styles.journal} id="trainer-projects" aria-labelledby="trainer-project-title">
          <h2 id="trainer-project-title">Trainer League</h2>
          {paragraphs(content.bio).map((paragraph, index) => <p className="portfolio-formatted-text" key={index}>{paragraph}</p>)}
          <div className={styles.entries}>
            {content.projects.map((project, index) => {
              const game = project.trainer_game;
              const encounter = game ? encounters[game] : null;
              const href = safeHref(project.url);
              return (
                <article key={index} className={styles.entry}>
                  <header className={styles.entryHeader}>
                  {encounter && <p className={styles.entryLabel} data-earned={game && badges.includes(game) || undefined}>
                    {game && badges.includes(game) ? `${encounter.badge} badge earned` : encounter.title}
                  </p>}
                  <h3>{project.title}</h3>
                  </header>
                  {safeImage(project.image) ? (
                    <UserImage src={project.image} framing={project.image_framing} className={styles.cover} />
                  ) : (
                    <div className={styles.coverPlaceholder} aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
                  )}
                  <div className={styles.entryBody}>
                  {project.description && <p className="portfolio-formatted-text">{project.description}</p>}
                  {encounter && <p><strong>Signature move</strong> · {encounter.signature}</p>}
                  {encounter && game && badges.includes(game) && <p className={styles.fieldNote}><strong>Field note</strong> · {encounter.fieldNote}</p>}
                  </div>
                  <div className={styles.entryActions}>
                    {enhanced && game && <button type="button" onClick={() => visit(game)}>Play encounter</button>}
                    {href && <a href={href} target="_blank" rel="noopener noreferrer">Open project ↗</a>}
                    {encounter && encounter.repo !== href && <a href={encounter.repo} target="_blank" rel="noopener noreferrer">View source ↗</a>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {hasCareer && <section className={styles.career} id="trainer-career" aria-labelledby="trainer-career-title">
          <h2 id="trainer-career-title">Victory Road</h2>
          <CareerSections experience={content.experience} credentials={content.credentials} />
        </section>}
        {hasContact && (
          <section className={styles.contact} id="trainer-contact" aria-labelledby="trainer-contact-title">
            <h2 id="trainer-contact-title">Contact hub</h2>
            <ul>{content.trainer_contact_email && (
              <li><a href={`mailto:${encodeURIComponent(content.trainer_contact_email).replace("%40", "@")}`}>{content.trainer_contact_email}</a></li>
            )}{content.links.map(({ label, url }, index) => {
              const href = safeHref(url);
              return <li key={index}>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{label} ↗</a> : label}</li>;
            })}</ul>
          </section>
        )}
      </div>
      {(selected || siteOpen) && (
        <dialog ref={dialog} className={styles.dialog} aria-labelledby="encounter-title" onClose={() => setActive(undefined)}>
          <header>
            <div>
              <p className={styles.kicker}>{selected?.portfolioProject.title ?? "Signal Town"}</p>
              <h2 id="encounter-title">{selected?.title ?? "Mira’s portfolio"}</h2>
            </div>
            <button type="button" aria-label="Close encounter" onClick={() => dialog.current?.close()}>×</button>
          </header>
          {selected ? (
            <>
              <p className={styles.guide}><strong>{selected.guide}</strong> “{selected.description}”</p>
              <TrainerEncounter key={selected.game} game={selected.game} finish={() => finish(selected.game)} published={published} publish={setPublished} />
            </>
          ) : published && <MiniPortfolio portfolio={published} />}
        </dialog>
      )}
    </main>
  );
}
