"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { initials, paragraphs, safeHref, safeImage, type PortfolioContent } from "@/lib/portfolio";
import { UserImage } from "./user-image";
import styles from "./astral-nexus.module.css";

function AstralDragon() {
  const id = useId().replaceAll(":", "");
  return <svg className={styles.dragon} viewBox="0 0 600 600" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={id} x1="130" y1="80" x2="480" y2="510" gradientUnits="userSpaceOnUse"><stop stopColor="#effbff"/><stop offset=".4" stopColor="#91d8ff"/><stop offset="1" stopColor="#8465e9" stopOpacity=".25"/></linearGradient>
    </defs>
    <g stroke={`url(#${id})`} strokeWidth="1.5" strokeLinejoin="round">
      <path className={styles.dragonBody} d="M468 173C396 101 219 149 187 258C157 364 293 448 385 370C452 311 367 239 305 284C250 324 298 374 338 349M338 349C303 402 217 394 187 342C118 232 216 115 342 115L382 90L390 118L424 108L415 136L468 145L489 164L468 173Z" fill={`url(#${id})`} fillOpacity=".09"/>
      <path d="M245 173L151 62L165 170L76 136L154 256L207 240M350 199L443 218L534 279L474 170L521 139L427 152M245 173L165 170L207 240M165 170L154 256M350 199L474 170L443 218M187 258L217 280L190 310L223 337L225 371M217 280L256 262M223 337L260 350M297 157L318 125M334 153L353 119M374 153L390 128M398 166L418 145M287 402L290 431L320 407M334 392L352 416L372 388"/>
      <path d="M448 153L465 157L451 163Z" fill="#d6fbff"/><path d="M469 173L448 182L427 177M418 159L401 173M185 342L146 369L155 337M270 382L253 414L276 408"/>
      <path strokeDasharray="3 10" d="M468 163C367 121 227 173 214 271C200 370 324 413 386 340"/>
    </g>
  </svg>;
}

export function AstralNexus({ content, resumeHref, portfolioKey }: { content: PortfolioContent; resumeHref?: string; portfolioKey?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const intro = useRef<HTMLDialogElement>(null);
  const [motion, setMotion] = useState(true);
  const [boot, setBoot] = useState(true);
  const email = content.trainer_contact_email;
  useEffect(() => {
    if (!portfolioKey || !boot || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dialog = intro.current;
    dialog?.showModal();
    const timer = setTimeout(() => dialog?.close(), 2100);
    return () => clearTimeout(timer);
  }, [portfolioKey, boot]);
  return <div ref={root} className={styles.root} data-motion={motion ? "on" : "off"}
    onPointerMove={(event) => {
      if (event.pointerType !== "mouse" || !motion) return;
      const box = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty("--look-x", `${((event.clientX - box.left) / box.width - .5) * 12}deg`);
      event.currentTarget.style.setProperty("--look-y", `${(event.clientY / window.innerHeight - .5) * -10}deg`);
    }} onPointerLeave={() => { root.current?.style.setProperty("--look-x", "0deg"); root.current?.style.setProperty("--look-y", "0deg"); }}>
    <div className={styles.stars} aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{ left: `${(i * 37.7) % 100}%`, top: `${(i * 23.3) % 100}%`, "--delay": `${i % 7}s` } as CSSProperties}/>)}</div>
    {boot && portfolioKey && <dialog ref={intro} className={styles.intro} aria-label="Astral Nexus intro" onClose={() => setBoot(false)}>
      <div className={styles.portal}/><p>ESTABLISHING CONNECTION</p><strong>{content.name}</strong><button onClick={() => intro.current?.close()}>Skip intro</button>
    </dialog>}
    <header className={styles.nav}>
      <a className={styles.brand} href="#nexus-home"><span aria-hidden="true">✧</span> ASTRAL NEXUS</a>
      <nav aria-label="Portfolio navigation"><a href="#nexus-projects">Projects</a><a href="#nexus-about">About</a><a href="#nexus-contact">Contact</a></nav>
      <button type="button" aria-pressed={!motion} onClick={() => setMotion(!motion)}>{motion ? "Pause motion" : "Resume motion"}</button>
    </header>
    <main className={styles.page}>
      <section className={styles.hero} id="nexus-home" aria-labelledby="nexus-name">
        <div className={styles.heroText}><p className={styles.eyebrow}><span/> A PERSONAL UNIVERSE / EST. NOW</p><h1 id="nexus-name">{content.name}</h1><p className={styles.headline}>{content.headline || "A universe of ideas. A constellation of work."}</p>
          <div className={styles.actions}><a className={styles.primary} href="#nexus-projects">Explore my work <span aria-hidden="true">↗</span></a>{resumeHref && <a href={resumeHref} download="resume.pdf">Download résumé ↓</a>}{email && <a href={`mailto:${encodeURIComponent(email)}`}>Email me</a>}</div>
          <p className={styles.coordinates}>SCROLL TO EXPLORE <span aria-hidden="true">────────── ↓</span></p>
        </div>
        <div className={styles.observatory} aria-label="Animated holographic dragon orbiting a cosmic core" role="img"><div className={styles.scene}><div className={styles.halo}/><div className={styles.core}/><div className={styles.ring}/><div className={styles.ringTwo}/><AstralDragon/><span className={styles.satellite}/></div><span className={styles.sceneLabel}>DRACO / HOLOGRAPHIC ENTITY</span><span className={styles.sceneIndex}>01 — ∞</span></div>
      </section>
      <section className={styles.about} id="nexus-about" aria-labelledby="nexus-about-title"><div className={styles.identity}>{safeImage(content.avatar) ? <UserImage src={content.avatar} framing={content.avatar_framing} alt={`Portrait of ${content.name}`} className={styles.avatar}/> : <span className={styles.initials}>{initials(content.name)}</span>}<div><span className={styles.eyebrow}>IDENTITY / VERIFIED HUMAN</span><h2 id="nexus-about-title">Behind the orbit.</h2><span>{content.name}</span></div><span className={styles.identityMark} aria-hidden="true">✳</span></div><div className={styles.bio}>{paragraphs(content.bio).map((p,i)=><p className="portfolio-formatted-text" key={i}>{p}</p>)}{!content.bio && <p>Discover the work, ideas, and experiences that make up my universe.</p>}</div></section>
      <section className={styles.section} id="nexus-projects" aria-labelledby="nexus-project-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / SELECTED EXPLORATIONS</p><h2 id="nexus-project-title">The project constellation.</h2></div><span className={styles.count}>{String(content.projects.length).padStart(2,"0")} WORLDS</span></div>
        <div className={styles.projects}>{content.projects.map((p,i)=>{const href=safeHref(p.url);return <article className={styles.project} key={i} style={{"--planet-hue": `${195+i*43}`} as CSSProperties}><div className={styles.projectVisual}>{safeImage(p.image) ? <UserImage src={p.image} framing={p.image_framing} alt={`${p.title} preview`} className={styles.cover}/> : <><div className={styles.planet}/><div className={styles.planetOrbit}/></>}<span className={styles.projectNumber}>WORLD {String(i+1).padStart(2,"0")}</span></div><div className={styles.projectBody}><h3>{p.title}</h3>{p.description && <details className={styles.caseStudy}><summary>Read case study <span aria-hidden="true">＋</span></summary><div className="portfolio-formatted-text">{p.description}</div></details>}{href && <a href={href} target="_blank" rel="noopener noreferrer">Open project <span aria-hidden="true">↗</span></a>}</div></article>;})}</div>
        {!content.projects.length && <p className={styles.empty}>New worlds are taking shape. Check back soon.</p>}
      </section>
      {!!content.experience?.length && <section className={styles.section} aria-labelledby="nexus-career"><p className={styles.eyebrow}>02 / FLIGHT PATH</p><h2 id="nexus-career">Every orbit brought me here.</h2><ol className={styles.timeline}>{content.experience.map((job,i)=><li key={i}><span className={styles.timelineStar} aria-hidden="true">✧</span><p className={styles.eyebrow}>{job.dates}</p><h3>{job.role}</h3><p className={styles.company}>{[job.company,job.location].filter(Boolean).join(" · ")}</p><p className="portfolio-formatted-text">{job.description}</p></li>)}</ol></section>}
      {!!content.credentials?.length && <section className={styles.section} aria-labelledby="nexus-artifacts"><p className={styles.eyebrow}>03 / COLLECTED ARTIFACTS</p><h2 id="nexus-artifacts">Proof of the journey.</h2><div className={styles.artifacts}>{content.credentials.map((c,i)=>{const href=safeHref(c.url);return <article key={i}><span className={styles.crystal} aria-hidden="true">◇</span><h3>{c.title}</h3><p>{[c.issuer,c.date].filter(Boolean).join(" · ")}</p>{href && <a href={href} target="_blank" rel="noopener noreferrer">View credential ↗</a>}</article>;})}</div></section>}
      <section className={styles.contact} id="nexus-contact" aria-labelledby="nexus-contact-title"><p className={styles.eyebrow}>TRANSMISSION CHANNEL / OPEN</p><h2 id="nexus-contact-title">Let’s create<br/><em>something stellar.</em></h2><div className={styles.actions}>{email && <a className={styles.primary} href={`mailto:${encodeURIComponent(email)}`}>Send a transmission ↗</a>}{content.links.map((link,i)=>{const href=safeHref(link.url);return href && <a key={i} href={href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>;})}{resumeHref && <a href={resumeHref} download="resume.pdf">Download résumé ↓</a>}</div><div className={styles.signoff}><span>{content.name}</span><span>END OF TRANSMISSION <span aria-hidden="true">✧</span></span></div></section>
    </main>
  </div>;
}
