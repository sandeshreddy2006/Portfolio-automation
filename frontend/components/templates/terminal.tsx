import { JetBrains_Mono } from "next/font/google";
import { displayHost, paragraphs, safeHref, slugify, type PortfolioContent } from "@/lib/portfolio";
import styles from "./terminal.module.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--tm-mono" });

function Prompt({ command }: { command?: string }) {
  return (
    <p className={styles.prompt}>
      <span aria-hidden="true">$</span> {command}
      {!command && <span className={styles.cursor} aria-hidden="true" />}
    </p>
  );
}

export function Terminal({ content }: { content: PortfolioContent }) {
  const { name, headline, bio, projects, links } = content;
  const about = paragraphs(bio);

  return (
    <div className={`${styles.root} ${mono.variable}`}>
      <div className={styles.window}>
        <div className={styles.bar} aria-hidden="true">
          <span className={styles.dots}><i /><i /><i /></span>
          <span>{slugify(name)} — zsh</span>
          <span />
        </div>

        <main className={styles.body}>
          <Prompt command="whoami" />
          <h1>{name}</h1>
          {headline && <p className={styles.headline}>{headline}</p>}

          {about.length > 0 && (
            <section aria-label="About">
              <Prompt command="cat about.txt" />
              {about.map((text, index) => (
                <p key={index} className={styles.text}>{text}</p>
              ))}
            </section>
          )}

          {projects.length > 0 && (
            <section aria-label="Projects">
              <Prompt command="ls -l projects/" />
              <ul className={styles.list}>
                {projects.map((project, index) => {
                  const href = safeHref(project.url);
                  return (
                    <li key={index}>
                      <span className={styles.perm} aria-hidden="true">drwxr-xr-x</span>
                      <div>
                        <h2>
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer">{project.title}/</a>
                          ) : (
                            `${project.title}/`
                          )}
                        </h2>
                        {project.description && <p>{project.description}</p>}
                        {href && <small>{displayHost(href)}</small>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {links.length > 0 && (
            <section aria-label="Links">
              <Prompt command="open --links" />
              <ul className={styles.links}>
                {links.map((link, index) => {
                  const href = safeHref(link.url);
                  return (
                    <li key={index}>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer">[{link.label}]</a>
                      ) : (
                        `[${link.label}]`
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <Prompt />
        </main>
      </div>
    </div>
  );
}
