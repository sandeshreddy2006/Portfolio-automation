import Link from "next/link";
import type { ReactNode } from "react";
import Brand from "./brand";
import styles from "./legal.module.css";

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@portfolabs.com";

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className={`page-width ${styles.page}`}>
      <Link className="brand-link" href="/" aria-label="Portfolabs home"><Brand compact /></Link>
      <article className={styles.article}>
        <h1>{title}</h1>
        <p className={styles.updated}>Last updated {updated}</p>
        {children}
        <nav className={styles.links} aria-label="Legal">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/">Home</Link>
        </nav>
      </article>
    </main>
  );
}
