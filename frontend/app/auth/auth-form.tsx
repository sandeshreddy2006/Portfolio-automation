"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAccount } from "./use-account";
import GoogleButton from "./google-button";
import ResendCode from "./resend-code";
import CookieControls, { useCookiePreference } from "../cookie-controls";

export type AuthStep = "login" | "register" | "verify" | "link" | "password" | "delete" | "delete-confirm";
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
  if (error === "cookies") return "Allow essential cookies before continuing with Google.";
  if (error === "google-config") return "Google sign-in hasn’t been configured yet.";
  if (error === "email") return "We couldn’t send a verification code. Please wait before trying again.";
  if (error === "unavailable") return "The account service is temporarily unavailable.";
  if (error === "google") return "Google sign-in couldn’t be completed. Please try again.";
  if (error === "link-sign-in") return "Sign in on this site before connecting Google.";
  if (error === "link-mismatch") return "Choose the Google account that uses your Portfolabs email address.";
  return "";
}

export default function AuthForm({ initialStep, googleError, deleted, destination, onStep }: {
  initialStep: AuthStep; googleError?: string; deleted: boolean; destination: string; onStep: (step: AuthStep) => void;
}) {
  const cookiesAllowed = useCookiePreference() === "allowed";
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
  const account = useAccount(deleting);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.detail === "string" ? result.detail : "Something went wrong. Please try again.");
      }
      if (result.step === "deleted") {
        window.location.replace("/?auth=login&status=deleted");
      } else if (result.step === "verify" || result.step === "password" || result.step === "delete-confirm") {
        onStep(result.step);
      } else if (result.step === "signed-in") {
        window.location.replace(destination);
      } else {
        onStep("login");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (deleting && !account) {
    return account === undefined
      ? <p role="status">Loading your account…</p>
      : <p>Sign in to manage your account. <button type="button" className="account-text-link" onClick={() => onStep("login")}>Sign in</button></p>;
  }

  return (
    <>
      <VerificationEnvelope key={resendCount} />
      <h1>{title}</h1>
      <p className="account-description">{description}</p>
      <CookieControls forAccount />
      {deleted && initialStep === "login" && <p className="account-success" role="status">Your Portfolabs account has been deleted.</p>}
      {entry && <GoogleButton disabled={!cookiesAllowed} />}
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
        {creatingPassword && (
          <label className="account-terms">
            <input name="termsAccepted" type="checkbox" value="yes" required />
            <span>I agree to the <Link href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.</span>
          </label>
        )}
        {message && <p className="account-error" role="alert">{message}</p>}
        <button className={deleting ? "primary-link account-delete-button" : "primary-link"} disabled={busy || !cookiesAllowed} type="submit">
          {busy ? "Please wait…" : action}
        </button>
      </form>
      {verifyingEmail && cookiesAllowed && (
        <ResendCode onResent={() => {
          setResendCount((count) => count + 1);
          setMessage("");
        }} />
      )}
      {initialStep === "login" ? (
        <p className="account-switch">New to Portfolabs? <button type="button" onClick={() => onStep("register")}>Create an account</button></p>
      ) : (
        <p className="account-switch">
          {deleting ? <a href="/profile">Return to profile</a>
            : <button type="button" onClick={() => onStep("login")}>{initialStep === "register" ? "Back to sign in" : "Start again"}</button>}
        </p>
      )}
    </>
  );
}
