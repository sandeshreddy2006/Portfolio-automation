import { Space_Grotesk, Space_Mono } from "next/font/google";
import { displayHost, paragraphs, safeHref, type PortfolioContent } from "@/lib/portfolio";
import { UserImage } from "./user-image";
import styles from "./brutalist.module.css";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--br-display" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--br-mono" });

export function Brutalist({ content }: { content: PortfolioContent }) {
  const { name, avatar, headline, bio, projects, links } = content;
  const about = paragraphs(bio);

  return (
    <div className={`${styles.root} ${display.variable} ${mono.variable}`}>
      <main className={styles.wrap}>
        <header className={styles.hero}>
          <UserImage src={avatar} alt={`Photo of ${name}`} className={styles.avatar} priority />
          <p className={styles.tag}>Portfolio</p>
          <h1>{name}</h1>
          {headline && <p className={styles.headline}>{headline}</p>}
        </header>

        {about.length > 0 && (
          <section className={styles.about} aria-label="About">
            {about.map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </section>
        )}

        {projects.length > 0 && (
          <section aria-labelledby="br-work">
            <h2 id="br-work" className={styles.band}>
              Work <span>({projects.length})</span>
            </h2>
            <div className={styles.cards}>
              {projects.map((project, index) => {
                const href = safeHref(project.url);
                return (
                  <article key={index} className={styles.card}>
                    <span className={styles.num}>{String(index + 1).padStart(2, "0")}</span>
                    <UserImage src={project.image} alt="" className={styles.cover} />
                    <h3>{project.title}</h3>
                    {project.description && <p>{project.description}</p>}
                    {href && (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {displayHost(href)} →
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {links.length > 0 && (
          <section aria-labelledby="br-links">
            <h2 id="br-links" className={styles.band}>Contact</h2>
            <ul className={styles.buttons}>
              {links.map((link, index) => {
                const href = safeHref(link.url);
                return (
                  <li key={index}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>
                    ) : (
                      <span>{link.label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
