"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Step = "login" | "register" | "verify" | "link" | "password";
type Account = { name: string; email: string };

const steps = {
  login: {
    title: "Sign in",
    description: "Use your email and password or continue with Google.",
    action: "Sign in",
    endpoint: "login",
  },
  register: {
    title: "Create your account",
    description: "We’ll email you a six-digit code to verify your address.",
    action: "Send verification code",
    endpoint: "register",
  },
  verify: {
    title: "Check your email",
    description: "Enter the six-digit code we sent to your email address. It expires in 10 minutes.",
    action: "Verify email",
    endpoint: "verify",
  },
  link: {
    title: "Link your Google account",
    description: "A Portfolabs account already uses this email. Enter the six-digit code we sent to confirm the link.",
    action: "Verify and link",
    endpoint: "verify",
  },
  password: {
    title: "Set a password",
    description: "Choose a password so you can also sign in with your email.",
    action: "Finish setup",
    endpoint: "set-password",
  },
};

function googleMessage(error?: string) {
  if (error === "google-config") return "Google sign-in hasn’t been configured yet.";
  if (error === "email") return "We couldn’t send a verification code. Please wait a minute and try again.";
  if (error === "unavailable") return "The account service is temporarily unavailable.";
  if (error === "google") return "Google sign-in couldn’t be completed. Please try again.";
  return "";
}

export default function AuthForm({ initialStep, googleError }: { initialStep: Step; googleError?: string }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(googleMessage(googleError));
  const { title, description, action, endpoint } = steps[initialStep];
  const entry = initialStep === "login" || initialStep === "register";

  useEffect(() => {
    if (initialStep !== "login") return;
    const controller = new AbortController();
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then(setAccount)
      .catch(() => {});
    return () => controller.abort();
  }, [initialStep]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/auth/${account ? "logout" : endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.detail === "string" ? result.detail : "Something went wrong. Please try again.");
      }
      if (result.step === "verify" || result.step === "password") {
        window.location.replace(`/auth?step=${result.step}`);
      } else {
        window.location.replace("/auth");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (account) {
    return (
      <>
        <h1>Welcome, {account.name}</h1>
        <p className="account-description">You’re signed in as {account.email}.</p>
        <form className="account-form" method="post" onSubmit={submit}>
          <button className="primary-link" disabled={busy} type="submit">{busy ? "Signing out…" : "Sign out"}</button>
        </form>
        {message && <p className="account-error" role="alert">{message}</p>}
      </>
    );
  }

  return (
    <>
      <h1>{title}</h1>
      <p className="account-description">{description}</p>
      {entry && (
        <form action="/api/auth/google/start" method="get">
          <button className="account-google" type="submit">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.7-.4-4H24v7.7h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z"/>
              <path fill="#34A853" d="M24 44c5.5 0 10.2-1.8 13.5-4.6l-6.6-5A12 12 0 0 1 12.8 28H6v5.2A20 20 0 0 0 24 44Z"/>
              <path fill="#FBBC05" d="M12.8 28a12 12 0 0 1 0-8V14.8H6a20 20 0 0 0 0 18.4Z"/>
              <path fill="#EA4335" d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.3 19.3 0 0 0 24 4 20 20 0 0 0 6 14.8l6.8 5.2A12 12 0 0 1 24 12Z"/>
            </svg>
            Continue with Google
          </button>
        </form>
      )}
      <form className="account-form" method="post" onSubmit={submit}>
        {initialStep === "register" && (
          <label>Name<input name="name" autoComplete="name" maxLength={120} required /></label>
        )}
        {entry && (
          <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        )}
        {(entry || initialStep === "password") && (
          <label>
            Password
            <input
              name="password" type="password" maxLength={128}
              minLength={initialStep === "login" ? undefined : 15}
              autoComplete={initialStep === "login" ? "current-password" : "new-password"}
              required
            />
            {initialStep !== "login" && <small>Use at least 15 characters.</small>}
          </label>
        )}
        {(initialStep === "verify" || initialStep === "link") && (
          <label>
            Verification code
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
          </label>
        )}
        {message && <p className="account-error" role="alert">{message}</p>}
        <button className="primary-link" disabled={busy} type="submit">{busy ? "Please wait…" : action}</button>
      </form>
      {initialStep === "login" ? (
        <p className="account-switch">New to Portfolabs? <Link href="/auth?step=register">Create an account</Link></p>
      ) : (
        <p className="account-switch"><Link href="/auth">{initialStep === "register" ? "Back to sign in" : "Start again"}</Link></p>
      )}
    </>
  );
}
