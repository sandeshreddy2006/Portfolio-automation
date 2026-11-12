import Image from "next/image";
import Link from "next/link";
import { templateInfo } from "@/components/templates/meta";
import Brand from "./brand";
import CookieControls from "./cookie-controls";
import { AuthLink } from "./auth/auth-dialog";
import AccountNavigation from "./auth/account-menu";
import { HomeNavigation, HomeSectionLink } from "./home-navigation";
import HomePreview from "./home-preview";

const workflow = [
  {
    title: "Pick a design",
    description: "Choose a template that fits the way you want to show your work.",
  },
  {
    title: "Make it yours",
    description: "Import a résumé or add your bio, projects, and links by hand.",
  },
  {
    title: "Publish your site",
    description: "Go live at a dedicated URL when you’re ready to share.",
  },
  {
    title: "Share it anywhere",
    description: "Share your link on applications, profiles, and anywhere people can find your work.",
  },
];

const icons = {
  preview: "M3 5h18v12H3zM8 21h8M12 17v4",
  photo: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  file: "M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5",
} as const;

const features: { icon: keyof typeof icons; title: string; description: string }[] = [
  { icon: "preview", title: "See it as you build it", description: "A live preview updates as you type, on desktop, tablet and phone sizes." },
  { icon: "photo", title: "Profile and project images", description: "Add a profile photo and give each project its own image." },
  { icon: "link", title: "A link that lasts", description: "Republish updates at the same address. If you rename it, your previous link redirects for 30 days." },
  { icon: "lock", title: "Private until you say so", description: "Drafts stay private. Search engines are asked to skip your page unless you choose otherwise." },
  { icon: "file", title: "Résumé import", description: "Start with a PDF and review suggested details before adding them to your draft." },
  { icon: "layers", title: "One for every goal", description: "Make up to five portfolios, such as one for design jobs and another for code." },
];

const questions = [
  {
    question: "Who can see my portfolio?",
    answer: "Anyone with the link, once you publish it. Drafts are always private. By default, search engines are asked not to list your page, and you can change that in the editor.",
  },
  {
    question: "Can I change my link later?",
    answer: "Yes. Pick a new address in the editor and the old link keeps sending visitors to the new one for 30 days, so nothing you already shared breaks.",
  },
  {
    question: "What happens when I edit a published portfolio?",
    answer: "Your edits stay private as a draft until you press Publish again. Visitors see the new version straight away after you do.",
  },
  {
    question: "Do I need to know how to code?",
    answer: "No. You choose a design, fill in your details, and we build the page for you.",
  },
  {
    question: "Can I delete everything?",
    answer: "Yes. You can delete a portfolio at any time, or delete your whole account from the account menu, which removes your portfolios and uploaded images.",
  },
];

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

        <section id="designs" tabIndex={-1} className="section" aria-labelledby="designs-title">
          <div className="section-heading">
            <h2 id="designs-title">Portfolio designs</h2>
            <p>Explore six templates, from editorial to playful. Open any design to see a full preview.</p>
          </div>
          <ul className="design-grid">
            {templateInfo.map((template) => (
              <li key={template.id}>
                <Link href={`/templates/${template.id}`} className="design-card">
                  <Image
                    src={`/designs/${template.id}.webp`}
                    alt={`${template.name} template preview`}
                    width={960}
                    height={675}
                    sizes="(max-width: 700px) 80vw, (max-width: 1100px) 45vw, 400px"
                  />
                  <span className="design-meta">
                    <strong>{template.name}</strong>
                    <small>{template.tagline}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section id="features" tabIndex={-1} className="section" aria-labelledby="features-title">
          <div className="section-heading">
            <h2 id="features-title">Tools to build and share your portfolio</h2>
          </div>
          <ul className="feature-grid">
            {features.map(({ icon, title, description }) => (
              <li key={title}>
                <span className="feature-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                    <path d={icons[icon]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="workflow" tabIndex={-1} className="section workflow" aria-labelledby="workflow-title">
          <div className="section-heading">
            <h2 id="workflow-title">How it works</h2>
          </div>
          <ol className="workflow-steps">
            {workflow.map(({ title, description }, index) => (
              <li key={title}>
                <span className="step-number" aria-hidden="true">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="about" tabIndex={-1} className="section about" aria-labelledby="about-title">
          <div className="section-heading">
            <h2 id="about-title">About Portfolabs</h2>
            <p>We built Portfolabs to make it easier to turn the projects you’ve already done into a website you can share. It’s for students, developers, designers, and anyone who wants a home for their work.</p>
          </div>
          <div className="about-team">
            <h3>Developers</h3>
            <ul>
              <li><span aria-hidden="true">SP</span> Sandesh Reddy Patlolla</li>
              <li><span aria-hidden="true">SN</span> Suhas Nethi</li>
            </ul>
          </div>
        </section>

        <section id="faq" tabIndex={-1} className="section faq" aria-labelledby="faq-title">
          <div className="section-heading">
            <h2 id="faq-title">Frequently asked questions</h2>
          </div>
          <div className="faq-list">
            {questions.map(({ question, answer }) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

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
            <Link href="/terms">Terms</Link>
          </div>
        </nav>
      </footer>
      <CookieControls />
    </div>
  );
}
