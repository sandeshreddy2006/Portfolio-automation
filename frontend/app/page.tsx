import Image from "next/image";
import Link from "next/link";
import { templateInfo } from "@/components/templates/meta";
import Brand from "./brand";
import AccountNavigation from "./auth/account-menu";

const workflow = [
  {
    title: "Pick a design",
    description: "Choose a template that fits the way you want to show your work.",
  },
  {
    title: "Make it yours",
    description: "Add your bio, projects, and links. Preview how they look together.",
  },
  {
    title: "Publish your site",
    description: "Go live at a dedicated URL when you’re ready to share.",
  },
  {
    title: "Share it anywhere",
    description: "Get the link on screen and by email. Keep the same URL when you update your work.",
  },
];

const icons = {
  preview: "M3 5h18v12H3zM8 21h8M12 17v4",
  photo: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5",
} as const;

const features: { icon: keyof typeof icons; title: string; description: string }[] = [
  { icon: "preview", title: "See it as you build it", description: "A live preview updates as you type, on desktop, tablet and phone sizes." },
  { icon: "photo", title: "Your face, your work", description: "Add a profile photo and an image for each project. We shrink and clean them for you." },
  { icon: "link", title: "A link that lasts", description: "Edit and republish any time and the link stays the same. Change it, and the old one still works." },
  { icon: "lock", title: "Private until you say so", description: "Drafts stay private. Search engines are asked to skip your page unless you choose otherwise." },
  { icon: "sparkle", title: "Help with the words", description: "Stuck on your bio? Ask for a suggestion, then keep it, change it or ignore it." },
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

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path
        d={diagonal ? "M6 18 18 6M7 6h11v11" : "M4 12h15m-6-6 6 6-6 6"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PortfolioPreview() {
  return (
    <figure className="preview">
      <figcaption className="preview-caption">
        <span>01 / Example portfolio</span>
        <span className="preview-mode"><i aria-hidden="true" /> Concept preview</span>
      </figcaption>
      <div className="preview-stage" aria-hidden="true">
        <div className="preview-orbit preview-orbit-outer" />
        <div className="preview-orbit preview-orbit-inner" />
        <div className="preview-window">
          <div className="window-bar">
            <span className="window-dots"><i /><i /><i /></span>
            <span>/p/alex-morgan</span>
            <span className="window-arrow">↗</span>
          </div>
          <div className="sample">
            <div className="sample-top"><span>Alex Morgan</span><span>Work / 01</span></div>
            <div className="sample-copy">
              <span>Designer &amp; developer</span>
              <strong>Making digital<br />things feel human.</strong>
            </div>
            <div className="sample-art">
              <svg viewBox="0 0 300 120" fill="none" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="sample-line" x1="24" y1="94" x2="274" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#a5c254" stopOpacity=".28" />
                    <stop offset=".55" stopColor="#d8fa73" />
                    <stop offset="1" stopColor="#d8fa73" stopOpacity=".45" />
                  </linearGradient>
                </defs>
                <g stroke="url(#sample-line)" strokeWidth=".75" className="sample-wave">
                  {Array.from({ length: 13 }, (_, line) => (
                    <path key={line} d={`M-10 ${68 + line * 4} C 48 ${116 - line * 5}, 85 ${-45 + line * 7}, 156 ${35 + line * 3} S 234 ${112 - line * 4}, 312 ${14 + line * 8}`} />
                  ))}
                </g>
              </svg>
              <span>01 — Selected work</span>
            </div>
          </div>
        </div>
        <span className="preview-tag"><i /> Ready to share</span>
      </div>
    </figure>
  );
}

export default function Home() {
  return (
    <div id="top" className="landing">
      <header className="site-header page-width">
        <a className="brand-link" href="#top" aria-label="Portfolabs home">
          <Brand compact />
        </a>
        <nav aria-label="Main navigation">
          <a className="workflow-link" href="#designs">Designs</a>
          <a className="workflow-link" href="#workflow">How it works</a>
          <a className="workflow-link" href="#faq">FAQ</a>
          <AccountNavigation />
        </nav>
      </header>

      <main className="page-width">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow intro-label"><span aria-hidden="true" /> Portfolio builder · 6 designs</p>
            <h1 id="hero-title">
              <span className="headline-line"><span>Your work.</span></span>
              <span className="headline-line"><span>Live on the web.</span></span>
            </h1>
            <p className="hero-description">
              Pick a design, add your projects and story, and publish a portfolio you can share with anyone, in one sitting.
            </p>
            <div className="hero-actions">
              <Link className="primary-link" href="/dashboard">Start building <Arrow /></Link>
              <Link className="source-link" href="/templates">Browse templates</Link>
            </div>
          </div>
          <PortfolioPreview />
        </section>

        <section id="designs" className="section" aria-labelledby="designs-title">
          <div className="section-heading">
            <p className="eyebrow"><span aria-hidden="true" /> The designs</p>
            <h2 id="designs-title">Six looks. One that’s yours.</h2>
            <p>From calm and editorial to loud and playful. Open any of them and try it with your own words.</p>
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

        <section className="section" aria-labelledby="features-title">
          <div className="section-heading">
            <p className="eyebrow"><span aria-hidden="true" /> What you get</p>
            <h2 id="features-title">Everything a portfolio needs. Nothing it doesn’t.</h2>
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

        <section id="workflow" className="workflow" aria-labelledby="workflow-title">
          <div className="workflow-heading">
            <p className="eyebrow"><span aria-hidden="true" /> The workflow</p>
            <h2 id="workflow-title">From a template to a live link.</h2>
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

        <section id="faq" className="section faq" aria-labelledby="faq-title">
          <div className="section-heading">
            <p className="eyebrow"><span aria-hidden="true" /> Questions</p>
            <h2 id="faq-title">Good to know.</h2>
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
          <Link className="primary-link" href="/dashboard">Start building <Arrow /></Link>
        </section>
      </main>

      <footer className="site-footer page-width">
        <div>
          <Brand />
          <p className="repository-detail">Build a portfolio you’re proud to share.</p>
        </div>
        <nav className="legal-links" aria-label="Legal">
          <Link href="/templates">Templates</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </footer>
    </div>
  );
}
