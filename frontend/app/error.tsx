"use client";

import Link from "next/link";
import Brand from "./brand";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="account-page page-width">
      <Link className="brand-link" href="/" aria-label="Portfolabs home"><Brand compact /></Link>
      <section className="account-panel" aria-labelledby="error-title">
        <h1 id="error-title">Something went wrong.</h1>
        <p>We couldn’t load this page. It’s usually temporary, so please try again.</p>
        <p>
          <button type="button" className="primary-link" onClick={reset}>Try again</button>{" "}
          <Link href="/" className="account-text-link">Back to Portfolabs</Link>
        </p>
      </section>
    </main>
  );
}
