"use client";

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

