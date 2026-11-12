"use client";

import Link from "next/link";
import { AuthLink } from "./auth-dialog";
import { useAccount } from "./use-account";

export function AccountMenu() {
  return (
    <details className="account-menu">
      <summary aria-label="Account menu">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="account-menu-items">
        <Link href="/dashboard">My portfolios</Link>
        <Link href="/profile">View profile</Link>
        <Link href="/cookies">Cookie settings</Link>
        <AuthLink className="account-menu-danger" step="delete">Delete account</AuthLink>
      </div>
    </details>
  );
}

export default function AccountNavigation() {
  const account = useAccount();
  return account
    ? <AccountMenu />
    : <AuthLink className="sign-in-link">Sign in</AuthLink>;
}
