import Link from "next/link";
import Brand from "./brand";

export default function NotFound() {
  return (
    <main className="account-page page-width">
      <Link className="brand-link" href="/" aria-label="Portfolabs home"><Brand compact /></Link>
      <section className="account-panel" aria-labelledby="not-found-title">
        <h1 id="not-found-title">Nothing here yet.</h1>
        <p>This page doesn’t exist, or the portfolio hasn’t been published.</p>
        <p><Link href="/" className="account-text-link">Back to Portfolabs</Link></p>
      </section>
    </main>
  );
}
