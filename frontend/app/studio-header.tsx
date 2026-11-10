"use client";

import Link from "next/link";
import AccountNavigation from "./auth/account-menu";
import Brand from "./brand";

export default function StudioHeader() {
  return (
    <header className="site-header page-width">
      <Link className="brand-link" href="/" aria-label="Portfolabs home">
        <Brand compact />
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/dashboard">My portfolios</Link>
        <Link href="/templates">Templates</Link>
        <AccountNavigation />
      </nav>
    </header>
  );
}
