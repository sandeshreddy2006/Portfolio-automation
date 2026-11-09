"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AccountMenu, useAccount } from "./account-menu";
import ResendCode from "./resend-code";

type Step = "login" | "register" | "verify" | "link" | "password" | "delete" | "delete-confirm";
const minimumPasswordLength = 8;

function passwordStrength(password: string) {
  const characters = Array.from(password);
  if (characters.length === 0) return 0;
  const distinct = new Set(characters).size;
  const commonPattern = /^(password|qwerty|letmein|admin|123456)[0-9!?.]*$/i;
  if (characters.length < minimumPasswordLength || distinct < 5 || commonPattern.test(password)) return 1;
  return characters.length >= 12 && distinct >= 8 ? 3 : 2;
}

function VerificationEnvelope() {
  return (
    <svg className="verification-envelope" aria-hidden="true" viewBox="0 0 128 100" width="112" height="88">
      <ellipse cx="64" cy="55" rx="48" ry="40" fill="#e9efdc" />
      <path d="M26 53 64 23l38 30v29H26z" fill="#465e38" />
      <g className="verification-letter">
        <rect x="36" y="22" width="56" height="53" rx="5" fill="#fffef7" stroke="#92a579" />
        <path d="M46 37h20m-20 8h36" stroke="#698056" strokeWidth="2" strokeLinecap="round" />
        <path d="M47 57h1m6 0h1m6 0h1m6 0h1m6 0h1m6 0h1" stroke="#465e38" strokeWidth="3" strokeLinecap="round" />
      </g>
      <path d="m26 53 38 22 38-22v28a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6z" fill="#daf977" stroke="#465e38" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M27 82l27-13m47 13L74 69" fill="none" stroke="#829b48" strokeWidth="1.5" />
      <path className="verification-spark" d="M104 25v12m-6-6h12M24 30v8m-4-4h8" stroke="#698056" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

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
    action: "Send verification code",
    endpoint: "set-password",
  },
  delete: {
    title: "Delete your account",
    description: "This permanently removes your account and signs you out of all devices. We’ll email you a code to confirm.",
    action: "Send deletion code",
    endpoint: "delete/start",
  },
  "delete-confirm": {
    title: "Confirm account deletion",
    description: "Enter the six-digit code from your email to permanently delete your account. It expires in 10 minutes.",
    action: "Permanently delete account",
    endpoint: "delete/confirm",
  },
};

function googleMessage(error?: string) {
  if (error === "google-config") return "Google sign-in hasn’t been configured yet.";
  if (error === "email") return "We couldn’t send a verification code. Please wait before trying again.";
  if (error === "unavailable") return "The account service is temporarily unavailable.";
  if (error === "google") return "Google sign-in couldn’t be completed. Please try again.";
  if (error === "link-sign-in") return "Sign in on this site before connecting Google.";
  if (error === "link-mismatch") return "Choose the Google account that uses your Portfolabs email address.";
  return "";
}

export default function AuthForm({ initialStep, googleError, deleted }: {
  initialStep: Step; googleError?: string; deleted: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(googleMessage(googleError));
  const [strength, setStrength] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const { title, description, action, endpoint } = steps[initialStep];
  const entry = initialStep === "login" || initialStep === "register";
  const creatingPassword = initialStep === "register" || initialStep === "password";
  const deleting = initialStep === "delete" || initialStep === "delete-confirm";
  const verifyingEmail = initialStep === "verify" || initialStep === "link" || initialStep === "delete-confirm";
  const strengthLabel = ["", "Weak", "Fair", "Strong"][strength];
  const account = useAccount(initialStep === "login" || deleting);
  const showingProfile = initialStep === "login" && account;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/auth/${showingProfile ? "logout" : endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.detail === "string" ? result.detail : "Something went wrong. Please try again.");
      }
      if (result.step === "deleted") {
        window.location.replace("/auth?status=deleted");
      } else if (result.step === "verify" || result.step === "password" || result.step === "delete-confirm") {
        window.location.replace(`/auth?step=${result.step}`);
      } else {
        window.location.replace("/auth");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (deleting && !account) {
    return account === undefined
      ? <p role="status">Loading your account…</p>
      : <p>Sign in to manage your account. <Link href="/auth" className="account-text-link">Sign in</Link></p>;
  }

  if (showingProfile) {
    return (
      <>
        <div className="profile-heading">
          <h1>Your profile</h1>
          <AccountMenu googleConnected={showingProfile.google_connected} />
        </div>
        <dl className="profile-details">
          <div><dt>Name</dt><dd>{showingProfile.name}</dd></div>
          <div><dt>Email</dt><dd>{showingProfile.email}</dd></div>
          <div><dt>Google sign-in</dt><dd>{showingProfile.google_connected ? "Connected" : "Not connected"}</dd></div>
        </dl>
        <form className="account-form" method="post" onSubmit={submit}>
          <button className="primary-link" disabled={busy} type="submit">{busy ? "Signing out…" : "Sign out"}</button>
        </form>
        {message && <p className="account-error" role="alert">{message}</p>}
      </>
    );
  }

  return (
    <>
      {verifyingEmail && <VerificationEnvelope key={resendCount} />}
      <h1>{title}</h1>
      <p className="account-description">{description}</p>
      {deleted && initialStep === "login" && <p className="account-success" role="status">Your Portfolabs account has been deleted.</p>}
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
          <div className="account-password">
            <label htmlFor="account-password">Password</label>
            <input
              id="account-password"
              name="password" type="password" maxLength={128}
              minLength={creatingPassword ? minimumPasswordLength : undefined}
              autoComplete={creatingPassword ? "new-password" : "current-password"}
              aria-describedby={creatingPassword ? "password-guidance" : undefined}
              onChange={creatingPassword ? (event) => {
                const input = event.currentTarget;
                const password = input.value;
                input.setCustomValidity(password && Array.from(password).length < minimumPasswordLength
                  ? `Use at least ${minimumPasswordLength} characters.` : "");
                setStrength(passwordStrength(password));
              } : undefined}
              required
            />
            {creatingPassword && (
              <span className="password-strength" data-strength={strength}>
                <span className="password-strength-bars" aria-hidden="true">
                  {[1, 2, 3].map((bar) => <span key={bar} data-filled={bar <= strength} />)}
                </span>
                <small id="password-guidance">Use at least {minimumPasswordLength} characters.</small>
                <small className="password-strength-status" role="status">
                  {strengthLabel && `Strength: ${strengthLabel}`}
                </small>
              </span>
            )}
          </div>
        )}
        {verifyingEmail && (
          <label>
            Verification code
            <input key={resendCount} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
          </label>
        )}
        {message && <p className="account-error" role="alert">{message}</p>}
        <button className={deleting ? "primary-link account-delete-button" : "primary-link"} disabled={busy} type="submit">
          {busy ? "Please wait…" : action}
        </button>
      </form>
      {verifyingEmail && (
        <ResendCode onResent={() => {
          setResendCount((count) => count + 1);
          setMessage("");
        }} />
      )}
      {initialStep === "login" ? (
        <p className="account-switch">New to Portfolabs? <Link href="/auth?step=register">Create an account</Link></p>
      ) : (
        <p className="account-switch">
          <Link href="/auth">{deleting ? "Cancel and return to profile" : initialStep === "register" ? "Back to sign in" : "Start again"}</Link>
        </p>
      )}
    </>
  );
}
