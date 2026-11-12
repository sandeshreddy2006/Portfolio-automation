import { CareerSections } from "./career-sections";
import { Sora } from "next/font/google";
import { displayHost, initials, paragraphs, safeHref, type PortfolioContent } from "@/lib/portfolio";
import { UserImage } from "./user-image";
import styles from "./aurora.module.css";

const sora = Sora({ subsets: ["latin"], variable: "--au-sans" });

export function Aurora({ content }: { content: PortfolioContent }) {
  const { name, avatar, headline, bio, projects, links } = content;
  const about = paragraphs(bio);

  return (
    <div className={`${styles.root} ${sora.variable}`}>
      <div className={styles.glow} aria-hidden="true"><i /><i /><i /></div>

      <main className={styles.content}>
        <header className={styles.hero}>
          {avatar ? (
            <UserImage src={avatar} framing={content.avatar_framing} alt={`Photo of ${name}`} className={styles.photo} priority />
          ) : (
            <div className={styles.badge} aria-hidden="true">{initials(name)}</div>
          )}
          <h1>{name}</h1>
          {headline && <p className={styles.headline}>{headline}</p>}
          {links.length > 0 && (
            <ul className={styles.pills} aria-label="Links">
              {links.map((link, index) => {
                const href = safeHref(link.url);
                return (
                  <li key={index}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">{link.label}</a>
                    ) : (
                      <span>{link.label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </header>

        {about.length > 0 && (
          <section className={`${styles.glass} ${styles.about}`} aria-label="About">
            {about.map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </section>
        )}

        {projects.length > 0 && (
          <section aria-labelledby="au-work">
            <h2 id="au-work" className={styles.heading}>Selected work</h2>
            <div className={styles.cards}>
              {projects.map((project, index) => {
                const href = safeHref(project.url);
                return (
                  <article key={index} className={`${styles.glass} ${styles.card}`}>
                    <UserImage src={project.image} framing={project.image_framing} alt="" className={styles.cover} />
                    <span className={styles.num}>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{project.title}</h3>
                    {project.description && <p>{project.description}</p>}
                    {href && (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {displayHost(href)} <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
        <CareerSections experience={content.experience} credentials={content.credentials} />
      </main>
    </div>
  );
}
