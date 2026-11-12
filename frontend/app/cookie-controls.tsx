"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { acceptedCookiePreference, cookiePreferenceName, cookiePreferenceSeconds } from "@/lib/cookie-preference";

const changeEvent = "portfolabs-cookie-preference";
const declinedKey = "portfolabs_cookie_declined_until";
let declinedInMemory = false;

function preference() {
  if (document.cookie.split(/;\s*/).includes(`${cookiePreferenceName}=${acceptedCookiePreference}`)) return "allowed";
  if (declinedInMemory) return "declined";
  try {
    if (Number(localStorage.getItem(declinedKey)) > Date.now()) return "declined";
  } catch {
    // The visitor can still make a choice when browser storage is unavailable.
  }
  return "undecided";
}

function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", notify);
  window.addEventListener("focus", notify);
  return () => {
    window.removeEventListener(changeEvent, notify);
    window.removeEventListener("storage", notify);
    window.removeEventListener("focus", notify);
  };
}

export function useCookiePreference() {
  return useSyncExternalStore(subscribe, preference, () => null);
}

export default function CookieControls({ settings = false, forAccount = false }: { settings?: boolean; forAccount?: boolean }) {
  const current = useCookiePreference();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choose(allow: boolean) {
    setError("");
    const secure = location.protocol === "https:" ? "; Secure" : "";
    if (!allow && current === "allowed") {
      setBusy(true);
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!response.ok) throw new Error();
      } catch {
        setError("We couldn’t clear your sign-in cookies. Please try again.");
        setBusy(false);
        return;
      }
    }

    if (allow || current === "allowed") {
      document.cookie = `${cookiePreferenceName}=${allow ? acceptedCookiePreference : ""}; Path=/; Max-Age=${allow ? cookiePreferenceSeconds : 0}; SameSite=Lax${secure}`;
    }
    declinedInMemory = !allow;
    try {
      if (allow) localStorage.removeItem(declinedKey);
      else localStorage.setItem(declinedKey, String(Date.now() + cookiePreferenceSeconds * 1000));
    } catch {
      // Keep the choice for this visit when local storage is blocked.
    }
    window.dispatchEvent(new Event(changeEvent));
    if (allow && preference() !== "allowed") setError("Your browser blocked cookies. Enable cookies to sign in.");
    setBusy(false);
  }

  if (!settings && (current === null || (current !== "undecided" && (!forAccount || current === "allowed")))) return null;

  return (
    <section className={settings ? "cookie-panel" : forAccount ? "cookie-panel cookie-panel-account" : "cookie-panel cookie-panel-banner"}
      aria-labelledby={settings ? "cookie-settings" : "cookie-notice-title"}>
      <div className="cookie-panel-copy">
        <h2 id={settings ? "cookie-settings" : "cookie-notice-title"}>{settings ? "Your cookie settings" : "Essential cookies"}</h2>
        <p>{settings
          ? "You can browse with cookies off. Turning them off here also signs you out in this browser."
          : <>We use cookies to verify your email and keep you signed in. You can browse without them. <Link href="/cookies" target={forAccount ? "_blank" : undefined} rel={forAccount ? "noopener noreferrer" : undefined}>Cookie policy</Link></>}</p>
        {settings && <p role="status" className="cookie-status">{current === "allowed" ? "Essential cookies allowed" : current === "declined" ? "Cookies declined" : current === "undecided" ? "No choice saved" : ""}</p>}
        {error && <p className="account-error" role="alert">{error}</p>}
      </div>
      <div className="cookie-actions">
        <button type="button" className="cookie-button" disabled={busy || current === null || current === "declined"} onClick={() => void choose(false)}>Decline cookies</button>
        <button type="button" className="cookie-button" disabled={busy || current === null || current === "allowed"} onClick={() => void choose(true)}>Allow essential cookies</button>
      </div>
    </section>
  );
}
