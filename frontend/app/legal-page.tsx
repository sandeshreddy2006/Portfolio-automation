import Link from "next/link";
import type { ReactNode } from "react";
import Brand from "./brand";
import styles from "./legal.module.css";

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "portfolabs@gmail.com";

const legalLinks = [
  { href: "/terms", label: "Terms" },
  { href: "/eula", label: "Vercel EULA" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/support", label: "Support" },
  { href: "/docs/vercel", label: "Vercel Guide" },
];

export default function LegalPage({ title, updated, current, children }: { title: string; updated: string; current?: string; children: ReactNode }) {
  return (
    <main className={`page-width legal-page ${styles.page}`}>
      <Link className="brand-link" href="/" aria-label="Portfolabs home"><Brand compact /></Link>
      <nav className={styles.links} aria-label="Legal">
        {legalLinks.map(({ href, label }) => (
          <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      <article className={styles.article}>
        <h1>{title}</h1>
        <p className={styles.updated}>Last updated {updated}</p>
        {children}
      </article>
    </main>
  );
}
