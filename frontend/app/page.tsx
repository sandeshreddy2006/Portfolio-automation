import Link from "next/link";
import Brand from "./brand";
import CookieControls from "./cookie-controls";
import { AuthLink } from "./auth/auth-dialog";
import AccountNavigation from "./auth/account-menu";
import { HomeNavigation, HomeSectionLink } from "./home-navigation";
import HomePreview from "./home-preview";
import HomeSections from "./home-sections";

function Arrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path
        d="M4 12h15m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div id="top" className="landing" tabIndex={-1}>
      <header className="home-header">
        <div className="site-header page-width">
          <HomeSectionLink id="top" className="brand-link"><Brand compact /></HomeSectionLink>
          <HomeNavigation />
          <div className="home-account"><AccountNavigation /></div>
        </div>
      </header>

      <main className="page-width">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow intro-label"><span aria-hidden="true" /> Portfolio website builder</p>
            <h1 id="hero-title">
              <span className="headline-line"><span>A website for</span></span>{" "}
              <span className="headline-line"><span>your best work.</span></span>
            </h1>
            <p className="hero-description">
              Choose a template, add your work or import your résumé, and publish a portfolio at your own shareable address.
            </p>
            <div className="hero-actions">
              <AuthLink className="primary-link" step="register" whenSignedIn="/dashboard">Get started <Arrow /></AuthLink>
              <Link className="source-link" href="/templates">Browse templates</Link>
            </div>
          </div>
          <HomePreview />
        </section>

        <HomeSections />

        <section className="cta-band" aria-labelledby="cta-title">
          <h2 id="cta-title">Ready to publish yours?</h2>
          <p>Create an account, pick a design, and have a link to share today.</p>
          <AuthLink className="primary-link" step="register" whenSignedIn="/dashboard">Get started <Arrow /></AuthLink>
        </section>
      </main>

      <footer className="site-footer page-width">
        <div>
          <HomeSectionLink id="top" className="brand-link"><Brand /></HomeSectionLink>
          <p className="repository-detail">Portfolio builder for your work.</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <div>
            <h2>Product</h2>
            <Link href="/templates">Templates</Link>
            <HomeSectionLink id="workflow">How it works</HomeSectionLink>
            <HomeSectionLink id="about">About</HomeSectionLink>
          </div>
          <div>
            <h2>Resources</h2>
            <HomeSectionLink id="faq">FAQ</HomeSectionLink>
            <Link href="/privacy">Privacy</Link>
            <Link href="/cookies">Cookie settings</Link>
            <Link href="/support">Support</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </nav>
      </footer>
      <CookieControls />
    </div>
  );
}
