import type { Metadata } from "next";
import Link from "next/link";
import CookieControls from "../cookie-controls";
import LegalPage, { CONTACT_EMAIL } from "../legal-page";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Cookie Policy | Portfolabs",
  description: "See which cookies Portfolabs uses and manage your cookie settings.",
};

const cookies = [
  { name: "portfolabs_cookie_preference", purpose: "Remembers that you allowed essential cookies on this site.", duration: "180 days" },
  { name: "portfolabs_session", purpose: "Keeps you signed in to your Portfolabs account.", duration: "7 days" },
  { name: "portfolabs_challenge", purpose: "Connects an email verification, password setup, or account deletion step to your browser.", duration: "10 minutes" },
  { name: "portfolabs_oauth", purpose: "Protects the request when you sign in with or connect Google.", duration: "10 minutes" },
];

export default function CookiesPage() {
  return (
    <LegalPage current="/cookies" title="Cookie Policy" updated="12 November 2026">
      <p>Portfolabs uses essential cookies to verify your identity and keep you signed in. We ask before setting them. You can browse templates and public portfolios with cookies off. Signing in, creating an account, or managing a portfolio requires them.</p>
      <CookieControls settings />

      <h2>Cookies we use</h2>
      <p>On our production site, the three sign-in cookie names below begin with <code>__Host-</code>. They are restricted to the site that set them and sent over HTTPS.</p>
      <dl className={styles.cookieList}>
        {cookies.map(({ name, purpose, duration }) => (
          <div key={name}>
            <dt><code>{name}</code></dt>
            <dd>{purpose} Expires after {duration}.</dd>
          </div>
        ))}
      </dl>

      <h2>How we remember a decline</h2>
      <p>When you decline, we save your choice in your browser’s local storage for up to 180 days. This setting stays in your browser. Clearing site data resets your preference.</p>

      <h2>Analytics and third-party services</h2>
      <p>Portfolabs doesn’t set advertising or analytics cookies. If you choose to continue with Google, Google may use its own cookies while you are on its website. <a href="https://policies.google.com/technologies/cookies">Read Google’s cookie policy</a>.</p>

      <h2>Questions</h2>
      <p>See our <Link href="/privacy">Privacy Policy</Link> for how we handle your data, or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
