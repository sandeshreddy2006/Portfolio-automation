import { initials, paragraphs, safeHref, safeImage, type PortfolioContent } from "@/lib/portfolio";
import { CareerSections } from "./career-sections";
import { UserImage } from "./user-image";
import styles from "./cinema.module.css";

export function Cinema({ content }: { content: PortfolioContent }) {
  const { name, headline, bio, avatar, avatar_framing, projects, links, experience, credentials } = content;
  const [featured] = projects;
  const about = paragraphs(bio);
  const featuredUrl = safeHref(featured?.url);

  return (
    <div className={styles.root} id="cinema-top">
      <div className={styles.intro} aria-hidden="true">
        <div className={styles.introLight} />
        <span className={styles.introMark}>{initials(name)}</span>
      </div>
      <header className={styles.header}>
        <a className={styles.brand} href="#cinema-top">{name}</a>
        <nav className={styles.nav} aria-label="Portfolio sections">
          {projects.length > 0 && <a href="#cinema-work">Projects</a>}
          {about.length > 0 && <a href="#cinema-about">About</a>}
          {!!experience?.length && <a href="#work-experience">Experience</a>}
          {links.length > 0 && <a href="#cinema-links">Links</a>}
        </nav>
        {safeImage(avatar) && <UserImage src={avatar} framing={avatar_framing} alt={`Photo of ${name}`} className={styles.avatar} priority />}
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="cinema-title">
          <UserImage src={featured?.image} framing={featured?.image_framing} alt="" className={styles.backdrop} priority />
          <div className={styles.heroContent}>
            <h1 id="cinema-title">{name}</h1>
            {headline && <p className={styles.headline}>{headline}</p>}
            {featured && (
              <>
                <p className={styles.featured}>Featured project <strong>{featured.title}</strong></p>
                <div className={styles.actions}>
                  {featuredUrl && (
                    <a className={styles.primary} href={featuredUrl} target="_blank" rel="noopener noreferrer">
                      Open project <span aria-hidden="true">↗</span>
                    </a>
                  )}
                  <a className={styles.secondary} href="#cinema-work">Browse projects</a>
                </div>
              </>
            )}
          </div>
        </section>

        {projects.length > 0 && (
          <section className={styles.shelf} aria-labelledby="cinema-work">
            <h2 id="cinema-work">Projects</h2>
            <ul className={styles.rail} tabIndex={0} aria-label="Scrollable project list">
              {projects.map((project, index) => {
                const href = safeHref(project.url);
                return (
                  <li className={styles.card} key={index}>
                    <div className={styles.poster}>
                      {safeImage(project.image) ? (
                        <UserImage src={project.image} framing={project.image_framing} alt="" className={styles.cover} />
                      ) : (
                        <span className={styles.monogram} aria-hidden="true">{initials(project.title)}</span>
                      )}
                    </div>
                    <div className={styles.details}>
                      <h3>{project.title}</h3>
                      {project.description && <p>{project.description}</p>}
                      {href && <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${project.title}`}>Open project <span aria-hidden="true">↗</span></a>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className={styles.content}>
          {about.length > 0 && (
            <section aria-labelledby="cinema-about">
              <h2 id="cinema-about">About</h2>
              {about.map((text, index) => <p key={index}>{text}</p>)}
            </section>
          )}
          <CareerSections experience={experience} credentials={credentials} />
          {links.length > 0 && (
            <section aria-labelledby="cinema-links">
              <h2 id="cinema-links">Find me online</h2>
              <ul className={styles.links}>
                {links.map((link, index) => {
                  const href = safeHref(link.url);
                  return <li key={index}>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{link.label}</a> : link.label}</li>;
                })}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
