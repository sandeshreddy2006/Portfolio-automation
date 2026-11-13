import { safeHref, type PortfolioContent } from "@/lib/portfolio";
import styles from "./career-sections.module.css";

export function CareerSections({ experience = [], credentials = [] }: Pick<PortfolioContent, "experience" | "credentials">) {
  return (
    <>
      {experience.length > 0 && (
        <section className={styles.section} aria-labelledby="work-experience">
          <h2 id="work-experience">Work experience</h2>
          <ul>
            {experience.map(({ role, company, location, dates, description }, index) => (
              <li key={index}>
                <h3>{role}</h3>
                {(company || location || dates) && <p>{[company, location, dates].filter(Boolean).join(" · ")}</p>}
                {description && <p className={styles.description}>{description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {credentials.length > 0 && (
        <section className={styles.section} aria-labelledby="licenses-and-certifications">
          <h2 id="licenses-and-certifications">Licenses &amp; certifications</h2>
          <ul>
            {credentials.map(({ title, issuer, date, url }, index) => {
              const href = safeHref(url);
              return (
                <li key={index}>
                  <h3>{title}</h3>
                  {(issuer || date) && <p>{[issuer, date].filter(Boolean).join(" · ")}</p>}
                  {href && <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`View credential for ${title}`}>View credential ↗</a>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
