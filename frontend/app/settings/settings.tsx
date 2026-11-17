"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { profile } from "@/lib/api";
import { imageFramingStyle } from "@/lib/image";
import { initials, safeImage, type ProfileContent } from "@/lib/portfolio";
import { AuthLink } from "../auth/auth-dialog";
import { useAccount } from "../auth/use-account";
import { useCookiePreference } from "../cookie-controls";
import styles from "./settings.module.css";
import banner from "../workspace-banner.module.css";

const paths = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8v-1a7 7 0 0 1 14 0v1",
  key: "M14 10a5 5 0 1 0-4 4l2 2h3v3h3l2-2-6-7Zm-4-2h.01",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  shield: "M12 3l7 3v5c0 4-3 7-7 10-4-3-7-6-7-10V6zM9 12l2 2 4-4",
  file: "M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2-12a2 2 0 1 1 3 2c-1 .6-1 1-1 2m0 3h.01",
  bug: "M8 10a4 4 0 0 1 8 0v5a4 4 0 0 1-8 0zm1-5-2-2m8 2 2-2M4 9l4 2m8 0 4-2m-16 8 4-2m8 0 4 2m-8-7v8",
} as const;

type Icon = keyof typeof paths;

const sections = [
  ["security", "Account security", "key"],
  ["privacy", "Privacy and policies", "shield"],
  ["help", "Help and feedback", "help"],
] as const;

function subscribeToSection(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}

function currentSection() {
  const hash = window.location.hash.slice(1);
  return sections.find(([id]) => id === hash)?.[0] ?? "security";
}

function Glyph({ icon }: { icon: Icon }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[icon]} />
    </svg>
  );
}

function Row({ icon, title, detail }: { icon: Icon; title: string; detail: string }) {
  return (
    <>
      <span className={styles.tile}><Glyph icon={icon} /></span>
      <span className={styles.rowText}><strong>{title}</strong><span>{detail}</span></span>
      <span className={styles.chevron} aria-hidden="true">›</span>
    </>
  );
}

const links = {
  privacy: [
    ["/cookies", "shield", "Cookie preferences", "See which cookies Portfolabs uses and manage your choice."],
    ["/privacy", "file", "Privacy Policy", "See how we handle your account, résumé, and portfolio data."],
    ["/terms", "file", "Terms of Service", "Review the terms for using and publishing with Portfolabs."],
    ["/eula", "file", "Vercel EULA", "Read the terms for deploying to your own Vercel account."],
  ],
  help: [
    ["faq", "help", "Frequently asked questions", "Find answers about publishing, sharing, and portfolio visibility."],
    ["/support", "mail", "Contact support", "Get help with your account, publishing, or Vercel setup."],
    ["/report/bug", "bug", "Report a bug", "Tell us what happened and how we can reproduce it."],
  ],
} satisfies Record<string, [string, Icon, string, string][]>;

export default function Settings() {
  const account = useAccount();
  const cookie = useCookiePreference();
  const section = useSyncExternalStore(subscribeToSection, currentSection, () => "security");
  const [photo, setPhoto] = useState<(Pick<ProfileContent, "avatar" | "avatar_framing"> & { email: string })>();
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const email = account?.email;
  const avatar = photo && photo.email === email ? safeImage(photo.avatar) : undefined;

  useEffect(() => {
    if (!email) return;
    let active = true;
    profile.get().then(({ content }) => {
      if (active) setPhoto({ email, avatar: content.avatar, avatar_framing: content.avatar_framing });
    }).catch(() => {});
    return () => { active = false; };
  }, [email]);

  const name = account?.name.trim() || account?.email;
  const cookieStatus = cookie === "allowed" ? "Essential cookies allowed" : cookie === "declined" ? "Cookies declined" : cookie === "undecided" ? "No choice saved" : "Checking preference…";

  return (
    <main className={`page-width ${styles.page}`}>
      <header className={`${banner.banner} ${styles.hero}`}>
        <div className={banner.art} aria-hidden="true"><span className={banner.ribbon} /></div>
        <div className={styles.heroCopy}>
          <h1>Settings</h1>
          <p>Manage how you sign in, control your privacy, and get help with Portfolabs.</p>
        </div>
        <div className={styles.account} aria-label="Account overview">
          <div className={styles.identity}>
            <span className={styles.avatar} aria-hidden="true">
              {avatar && avatar !== failedPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" style={photo?.avatar_framing ? imageFramingStyle(photo.avatar_framing) : undefined}
                  onError={() => setFailedPhoto(avatar)} />
              ) : name ? initials(name) : <Glyph icon="profile" />}
            </span>
            <div>
              <h2>{name || (account === undefined ? "Your account" : "You’re signed out")}</h2>
              {account && name !== account.email && <p>{account.email}</p>}
            </div>
          </div>
          <dl>
            <div><dt>Google sign-in</dt><dd>{account ? (account.google_connected ? "Connected" : "Not connected") : "—"}</dd></div>
            <div><dt>This browser</dt><dd>{cookieStatus}</dd></div>
          </dl>
          {account ? <Link className={styles.accountLink} href="/profile">Manage profile <span aria-hidden="true">›</span></Link>
            : account === null && <AuthLink className={styles.accountLink}>Sign in <span aria-hidden="true">›</span></AuthLink>}
        </div>
      </header>
      <div className={styles.body}>
        <aside className={styles.rail} aria-label="Settings navigation">
          <nav className={styles.jump} aria-label="Settings sections">
            {sections.map(([id, label, icon]) => (
              <a key={id} href={`#${id}`} aria-current={section === id ? "location" : undefined}>
                <Glyph icon={icon} /><span>{label}</span>
              </a>
            ))}
          </nav>
          <div className={styles.railActions}>
            <Link href="/dashboard"><Glyph icon="grid" /><span>My portfolios</span><span aria-hidden="true">›</span></Link>
            <Link href="/report/bug"><Glyph icon="bug" /><span>Report a bug</span><span aria-hidden="true">›</span></Link>
          </div>
        </aside>
        <div className={styles.panels}>
          <section id="security" className={styles.panel} aria-labelledby="security-title">
            <h2 id="security-title">Account security</h2>
            <p>Manage your password and connected sign-in methods.</p>
            <div className={styles.rows}>
              <AuthLink className={styles.row} step="change-password"><Row icon="key" title="Change password" detail="Use your current password and a verification code to set a new one." /></AuthLink>
              <AuthLink className={styles.row} step="forgot"><Row icon="mail" title="Reset password by email" detail="Get a verification code when you’ve forgotten your password." /></AuthLink>
              <Link className={styles.row} href="/profile"><Row icon="profile" title="Google connection and profile" detail="Manage the Google account you use to sign in and edit your saved profile." /></Link>
            </div>
          </section>
          {sections.slice(1).map(([id, label]) => (
            <section key={id} id={id} className={styles.panel} aria-labelledby={`${id}-title`}>
              <h2 id={`${id}-title`}>{label}</h2>
              <p>{id === "privacy" ? "Review your preferences and the policies that apply to your account." : "Find answers or tell us what went wrong."}</p>
              <div className={styles.rows}>
                {links[id as keyof typeof links].map(([href, icon, title, detail]) => (
                  <Link className={styles.row} key={href} href={href === "faq" ? (account ? "/dashboard#faq" : "/#faq") : href}>
                    <Row icon={icon} title={title} detail={detail} />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
