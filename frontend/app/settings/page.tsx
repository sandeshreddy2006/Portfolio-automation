import type { Metadata } from "next";
import Link from "next/link";
import { AuthLink } from "../auth/auth-dialog";
import StudioHeader from "../studio-header";
import styles from "../studio.module.css";

export const metadata: Metadata = { title: "Settings | Portfolabs", robots: { index: false } };

export default function SettingsPage() {
  return (
    <>
      <StudioHeader />
      <main className={`page-width ${styles.page}`}>
        <h1 className={styles.title}>Settings</h1>
        <section className={styles.panel} aria-labelledby="security-settings">
          <h2 id="security-settings">Account security</h2>
          <div className={styles.actions}>
            <AuthLink className={styles.secondary} step="change-password">Change password</AuthLink>
            <AuthLink className={styles.secondary} step="forgot">Reset password by email</AuthLink>
            <Link className={styles.secondary} href="/cookies">Cookie preferences</Link>
          </div>
        </section>
        <section className={styles.panel} aria-labelledby="legal-settings">
          <h2 id="legal-settings">Policies and help</h2>
          <div className={styles.actions}>
            <Link className={styles.secondary} href="/terms">Terms of Service</Link>
            <Link className={styles.secondary} href="/eula">Vercel EULA</Link>
            <Link className={styles.secondary} href="/privacy">Privacy Policy</Link>
            <Link className={styles.secondary} href="/dashboard#faq">FAQs</Link>
            <Link className={styles.secondary} href="/report/bug">Report a bug</Link>
          </div>
        </section>
      </main>
    </>
  );
}
