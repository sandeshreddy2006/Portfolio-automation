import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import Brand from "./brand";
import AccountNavigation from "./auth/account-menu";

const repositoryUrl = "https://github.com/sandeshreddy2006/Portfolio-automation";

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

function RepositoryLink() {
  return <a className="source-link" href={repositoryUrl}>GitHub <Arrow diagonal /></a>;
}

async function RepositoryDetails() {
  await connection();
  const backendUrl =
    process.env.BACKEND_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");

  if (!backendUrl) {
    return null;
  }

  let repository: { description: string };
  try {
    const response = await fetch(new URL("/api/repo", backendUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`Portfolio API returned ${response.status}`);
    }
    repository = await response.json();
  } catch (error) {
    console.error("Could not load repository details", error);
    return null;
  }

  return <p className="repository-detail">{repository.description}</p>;
}

export default function Home() {
  return (
    <div id="top" className="landing">
      <header className="site-header page-width">
        <a className="brand-link" href="#top" aria-label="Portfolabs home">
          <Brand compact />
        </a>
        <nav aria-label="Main navigation">
          <a className="workflow-link" href="#workflow">Workflow</a>
          <Link href="/templates">Templates</Link>
          <RepositoryLink />
          <AccountNavigation />
        </nav>
      </header>

      <main className="page-width">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow intro-label"><span aria-hidden="true" /> A portfolio builder in development</p>
            <h1 id="hero-title">
              <span className="headline-line"><span>Your work.</span></span>
              <span className="headline-line"><span>Live on the web.</span></span>
            </h1>
            <p className="hero-description">
              We’re building a simpler way to turn your projects, story, and links into a portfolio you can share with anyone.
            </p>
            <div className="hero-actions">
              <Link className="primary-link" href="/templates">Browse templates <Arrow /></Link>
            </div>
          </div>
          <PortfolioPreview />
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
      </main>

      <footer className="site-footer page-width">
        <div>
          <Brand />
          <Suspense fallback={null}><RepositoryDetails /></Suspense>
        </div>
        <RepositoryLink />
      </footer>
    </div>
  );
}
