import { Press_Start_2P, VT323 } from "next/font/google";
import { displayHost, paragraphs, safeHref, type PortfolioContent } from "@/lib/portfolio";
import styles from "./blocky.module.css";

const pixel = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--bk-pixel" });
const body = VT323({ subsets: ["latin"], weight: "400", variable: "--bk-body" });

export function Blocky({ content }: { content: PortfolioContent }) {
  const { name, headline, bio, projects, links } = content;
  const about = paragraphs(bio);

  return (
    <div className={`${styles.root} ${pixel.variable} ${body.variable}`}>
      <div className={styles.sky} aria-hidden="true">
        <i className={styles.cloud} />
        <i className={styles.cloud} />
        <i className={styles.cloud} />
      </div>

      <header className={styles.hero}>
        <p className={styles.welcome}>Welcome to the world of</p>
        <h1>{name}</h1>
        {headline && <p className={styles.tooltip}>{headline}</p>}
      </header>

      <main className={styles.ground}>
        <div className={styles.inner}>
          {about.length > 0 && (
            <section className={styles.panel} aria-labelledby="bk-about">
              <h2 id="bk-about">Journal</h2>
              {about.map((text, index) => (
                <p key={index}>{text}</p>
              ))}
            </section>
          )}

          {projects.length > 0 && (
            <section aria-labelledby="bk-work">
              <h2 id="bk-work" className={styles.heading}>Advancements ({projects.length})</h2>
              <ul className={styles.grid}>
                {projects.map((project, index) => {
                  const href = safeHref(project.url);
                  return (
                    <li key={index} className={styles.panel}>
                      <span className={`${styles.block} ${styles[`block${index % 6}`]}`} aria-hidden="true" />
                      <div>
                        <h3>{project.title}</h3>
                        {project.description && <p>{project.description}</p>}
                        {href && (
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            {displayHost(href)} ▸
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {links.length > 0 && (
            <section aria-labelledby="bk-links">
              <h2 id="bk-links" className={styles.heading}>Hotbar</h2>
              <ul className={styles.hotbar}>
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
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
