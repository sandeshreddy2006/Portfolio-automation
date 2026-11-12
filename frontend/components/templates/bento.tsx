import { CareerSections } from "./career-sections";
import { Space_Grotesk } from "next/font/google";
import { displayHost, initials, paragraphs, safeHref, type PortfolioContent } from "@/lib/portfolio";
import { UserImage } from "./user-image";
import styles from "./bento.module.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--bn-sans" });

export function Bento({ content }: { content: PortfolioContent }) {
  const { name, avatar, headline, bio, projects, links } = content;
  const about = paragraphs(bio);

  return (
    <div className={`${styles.root} ${grotesk.variable}`}>
      <main className={styles.grid}>
        <header className={`${styles.card} ${styles.intro}`}>
          <p className={styles.kicker}>Hello, I&apos;m</p>
          <h1>{name}</h1>
          {headline && <p className={styles.headline}>{headline}</p>}
        </header>

        <div className={`${styles.card} ${styles.avatar}`} aria-hidden={avatar ? undefined : "true"}>
          {avatar ? (
            <UserImage src={avatar} framing={content.avatar_framing} alt={`Photo of ${name}`} className={styles.photo} priority />
          ) : (
            <span>{initials(name)}</span>
          )}
        </div>

        {about.length > 0 && (
          <section className={`${styles.card} ${styles.about}`} aria-label="About">
            <h2>About</h2>
            {about.map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </section>
        )}

        {projects.map((project, index) => {
          const href = safeHref(project.url);
          return (
            <article key={index} className={`${styles.card} ${styles.project} ${styles[`tone${index % 5}`]}`}>
              <UserImage src={project.image} framing={project.image_framing} alt="" className={styles.cover} />
              <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
              <h2>{project.title}</h2>
              {project.description && <p>{project.description}</p>}
              {href && (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {displayHost(href)} <span aria-hidden="true">↗</span>
                </a>
              )}
            </article>
          );
        })}

        {links.length > 0 && (
          <nav className={`${styles.card} ${styles.links}`} aria-label="Links">
            <h2>Find me</h2>
            <ul>
              {links.map((link, index) => {
                const href = safeHref(link.url);
                return (
                  <li key={index}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {link.label} <span aria-hidden="true">↗</span>
                      </a>
                    ) : (
                      link.label
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <CareerSections experience={content.experience} credentials={content.credentials} />
      </main>
    </div>
  );
}
