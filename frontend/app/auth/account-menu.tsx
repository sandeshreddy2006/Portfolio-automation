"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Account = { name: string; email: string; google_connected: boolean };

export function useAccount(enabled = true) {
  const [account, setAccount] = useState<Account | null>();

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then(setAccount)
      .catch(() => {
        if (!controller.signal.aborted) setAccount(null);
      });
    return () => controller.abort();
  }, [enabled]);

  return account;
}

export function AccountMenu({ googleConnected }: { googleConnected: boolean }) {
  return (
    <details className="account-menu">
      <summary aria-label="Account menu">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="account-menu-items">
        <Link href="/dashboard">My portfolios</Link>
        <Link href="/auth">View profile</Link>
        {googleConnected ? (
          <span className="account-menu-connected">Google connected</span>
        ) : (
          <form action="/api/auth/google/start" method="get">
            <input type="hidden" name="intent" value="link" />
            <button type="submit">Connect Google</button>
          </form>
        )}
        <Link className="account-menu-danger" href="/auth?step=delete">Delete account</Link>
      </div>
    </details>
  );
}

export default function AccountNavigation() {
  const account = useAccount();
  return account
    ? <AccountMenu googleConnected={account.google_connected} />
    : <Link className="sign-in-link" href="/auth">Sign in</Link>;
}
