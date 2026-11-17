import { displayHost, initials, paragraphs, safeHref, safeImage, type PortfolioContent } from "@/lib/portfolio";
import { CareerSections } from "./career-sections";
import { UserImage } from "./user-image";
import styles from "./storefront.module.css";

export function Storefront({ content }: { content: PortfolioContent }) {
  const { name, headline, bio, avatar, avatar_framing, projects, links, experience, credentials } = content;
  const about = paragraphs(bio);

  return (
    <div className={styles.root} id="storefront-top">
      <header className={styles.header}>
        <a className={styles.brand} href="#storefront-top">{name}</a>
        {projects.length > 0 && (
          <a className={styles.browse} href="#storefront-work">
            <span>All</span>
            <span>Browse projects</span>
            <span aria-hidden="true">→</span>
          </a>
        )}
        {links.length > 0 && <a className={styles.profileLink} href="#storefront-links">Find me online</a>}
      </header>
      <nav className={styles.nav} aria-label="Portfolio sections">
        <a href="#storefront-top">Overview</a>
        {projects.length > 0 && <a href="#storefront-work">Projects</a>}
        {about.length > 0 && <a href="#storefront-about">About</a>}
        {!!experience?.length && <a href="#work-experience">Experience</a>}
        {!!credentials?.length && <a href="#licenses-and-certifications">Certifications</a>}
      </nav>

      <main>
        <section className={styles.hero}>
          <div>
            <h1>{name}</h1>
            {headline && <p>{headline}</p>}
            {projects.length > 0 && <a className={styles.button} href="#storefront-work">Explore projects <span aria-hidden="true">→</span></a>}
          </div>
          {safeImage(avatar) ? (
            <UserImage src={avatar} framing={avatar_framing} alt={`Photo of ${name}`} className={styles.avatar} priority />
          ) : (
            <span className={styles.monogram} aria-hidden="true">{initials(name)}</span>
          )}
        </section>

        <div className={styles.content}>
          {projects.length > 0 && (
            <section className={styles.work} aria-labelledby="storefront-work">
              <h2 id="storefront-work">Selected projects</h2>
              <ul className={styles.grid}>
                {projects.map((project, index) => {
                  const href = safeHref(project.url);
                  return (
                    <li className={styles.card} key={index}>
                      {safeImage(project.image) ? (
                        <UserImage src={project.image} framing={project.image_framing} alt="" className={styles.cover} />
                      ) : (
                        <div className={styles.placeholder} aria-hidden="true">{initials(project.title)}</div>
                      )}
                      <h3>{project.title}</h3>
                      {project.description && <p>{project.description}</p>}
                      {href && (
                        <a className={styles.button} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${project.title} on ${displayHost(href)}`}>
                          View project <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {about.length > 0 && (
            <section aria-labelledby="storefront-about">
              <h2 id="storefront-about">About</h2>
              {about.map((text, index) => <p key={index}>{text}</p>)}
            </section>
          )}
          <CareerSections experience={experience} credentials={credentials} />
          {links.length > 0 && (
            <section aria-labelledby="storefront-links">
              <h2 id="storefront-links">Find me online</h2>
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
      <footer className={styles.footer}><a href="#storefront-top">Back to top</a></footer>
    </div>
  );
}
