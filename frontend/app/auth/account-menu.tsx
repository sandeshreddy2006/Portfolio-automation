"use client";

import Link from "next/link";
import { useState } from "react";
import { logout } from "@/lib/api";
import { AuthLink } from "./auth-dialog";
import { useAccount } from "./use-account";

export function AccountMenu() {
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setSigningOut(true);
    setError("");
    try {
      await logout();
      window.location.replace("/");
    } catch {
      setError("Couldn’t sign out. Please try again.");
      setSigningOut(false);
    }
  }

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
        <button type="button" onClick={() => void signOut()} disabled={signingOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        {error && <p className="account-menu-error" role="alert">{error}</p>}
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
