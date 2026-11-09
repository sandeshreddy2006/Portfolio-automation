import type { Metadata } from "next";
import Link from "next/link";
import { templates } from "@/components/templates";
import styles from "./templates.module.css";

export const metadata: Metadata = {
  title: "Templates · Portfolio Automation",
  description: `${templates.length} portfolio designs to choose from.`,
};

export default function TemplatesPage() {
  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/">← Portfolio Automation</Link>
        <span>{templates.length} templates</span>
      </header>

      <section className={styles.intro}>
        <h1>Pick a design.</h1>
        <p>Each template is built for a different kind of person and a different kind of work. Open one to test it on desktop and mobile.</p>
      </section>

      <ul className={styles.gallery}>
        {templates.map((template, index) => (
          <li key={template.id}>
            <Link href={`/templates/${template.id}`} className={styles.card}>
              <div className={styles.thumb}>
                <iframe src={`/templates/${template.id}/frame/full`} title="" aria-hidden="true" tabIndex={-1} loading="lazy" />
              </div>
              <div className={styles.meta}>
                <span className={styles.count}>{String(index + 1).padStart(2, "0")}</span>
                <h2>{template.name}</h2>
                <p>{template.tagline}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
