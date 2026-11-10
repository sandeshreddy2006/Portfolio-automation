import { Fraunces, Inter } from "next/font/google";
import { displayHost, paragraphs, safeHref, type PortfolioContent } from "@/lib/portfolio";
import { UserImage } from "./user-image";
import styles from "./editorial.module.css";

const serif = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--ed-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--ed-sans" });

export function Editorial({ content }: { content: PortfolioContent }) {
  const { name, avatar, headline, bio, projects, links } = content;
  const about = paragraphs(bio);

  return (
    <div className={`${styles.root} ${serif.variable} ${sans.variable}`}>
      <header className={styles.top}>
        <span>{name}</span>
        <span>Portfolio</span>
      </header>

      <main>
        <section className={styles.hero}>
          <UserImage src={avatar} alt={`Photo of ${name}`} className={styles.avatar} priority />
          <h1>{name}</h1>
          {headline && <p className={styles.lede}>{headline}</p>}
        </section>

        {about.length > 0 && (
          <section className={styles.about} aria-labelledby="ed-about">
            <h2 id="ed-about">About</h2>
            <div className={styles.columns}>
              {about.map((text, index) => (
                <p key={index}>{text}</p>
              ))}
            </div>
          </section>
        )}

        {projects.length > 0 && (
          <section className={styles.work} aria-labelledby="ed-work">
            <h2 id="ed-work">Selected work</h2>
            <ol>
              {projects.map((project, index) => {
                const href = safeHref(project.url);
                return (
                  <li key={index}>
                    <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <UserImage src={project.image} alt="" className={styles.cover} />
                      <h3>{project.title}</h3>
                      {project.description && <p>{project.description}</p>}
                      {href && (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {displayHost(href)} <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </main>

      {links.length > 0 && (
        <footer className={styles.footer}>
          <h2>Elsewhere</h2>
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
        </footer>
      )}
    </div>
  );
}
