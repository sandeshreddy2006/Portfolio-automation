"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, profile } from "@/lib/api";
import type { ProfileContent, ProfileDetails } from "@/lib/portfolio";
import { applyResumeDetails, prepareProfile } from "@/lib/profile";
import { AuthLink } from "../auth/auth-dialog";
import GoogleButton from "../auth/google-button";
import ImageField from "../editor/[slug]/image-field";
import PortfolioFields from "../editor/[slug]/portfolio-fields";
import ResumeImport from "../editor/[slug]/resume-import";
import styles from "../studio.module.css";

export default function Profile() {
  const [details, setDetails] = useState<ProfileDetails>();
  const [content, setContent] = useState<ProfileContent>();
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    profile.get().then((result) => {
      if (!active) return;
      setDetails(result);
      setContent(result.content);
    }).catch((failure: unknown) => {
      if (!active) return;
      if (failure instanceof ApiError && failure.status === 401) setSignedOut(true);
      else setError(failure instanceof Error ? failure.message : "Couldn’t load your profile.");
    });
    return () => { active = false; };
  }, []);

  const dirty = Boolean(details && content && JSON.stringify(details.content) !== JSON.stringify(content));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(patch: Partial<ProfileContent>) {
    setContent((current) => current && { ...current, ...patch });
    setMessage("");
    setError("");
  }

  async function save() {
    if (!content) return;
    setMessage("");
    setError("");
    const prepared = prepareProfile(content);
    if (prepared.error || !prepared.value.name) {
      setError(prepared.error ?? "Enter your name.");
      return;
    }
    setBusy(true);
    try {
      const result = await profile.save(prepared.value);
      setDetails(result);
      setContent(result.content);
      setMessage("Profile saved.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t save your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function storeResume(file: File) {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new Error("Choose a PDF résumé.");
    if (file.size === 0 || file.size > 4 * 1024 * 1024) throw new Error("Choose a PDF up to 4 MB.");
    if (details?.resume_id && !window.confirm("Replace this résumé? Existing public download links will be turned off.")) {
      throw new Error("The current résumé was kept.");
    }
    setBusy(true);
    try {
      const resume_id = await profile.uploadResume(file);
      setDetails((current) => current && { ...current, resume_id });
      setMessage("Résumé stored privately.");
    } finally {
      setBusy(false);
    }
  }

  async function removeResume() {
    if (!window.confirm("Remove this résumé and disable its public download links?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await profile.removeResume();
      setDetails((current) => current && { ...current, resume_id: null });
      setMessage("Résumé removed.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t remove the résumé.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!response.ok) throw new Error();
      window.location.replace("/");
    } catch {
      setError("Couldn’t sign out. Please try again.");
    }
  }

  if (!details || !content) {
    return (
      <main className={`page-width ${styles.page}`}>
        <h1 className={styles.title}>Your profile</h1>
        {signedOut ? <AuthLink className="primary-link" destination="/profile">Sign in</AuthLink>
          : error ? <p role="alert" className={styles.error}>{error}</p>
          : <p role="status">Loading your profile…</p>}
      </main>
    );
  }

  return (
    <main className={`page-width ${styles.page}`}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Your profile</h1>
          <p className={styles.lead}>Save your details once and reuse them when you build a portfolio.</p>
        </div>
        <button type="button" className={styles.primary} disabled={busy || !dirty} onClick={() => void save()}>Save profile</button>
      </div>
      {message && <p className={styles.note} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={`${styles.form} ${styles.profileForm}`}>
        <section className={styles.group}>
          <h2>Account</h2>
          <p>{details.email}</p>
          <GoogleButton connect connected={details.google_connected} disabled={busy} />
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => void signOut()}>Sign out</button>
            <AuthLink className={styles.danger} step="delete">Delete account</AuthLink>
          </div>
        </section>
        <section className={styles.group}>
          <h2>Portfolio details</h2>
          <ImageField label="Profile photo" kind="avatar" template="editorial" value={content.avatar}
            framing={content.avatar_framing} disabled={busy}
            onChange={(avatar, avatar_framing) => update({ avatar, avatar_framing })} />
          <label>Name<input value={content.name} maxLength={120} onChange={(event) => update({ name: event.target.value })} /></label>
          <label>Headline<input value={content.headline} maxLength={160} onChange={(event) => update({ headline: event.target.value })} /></label>
          <label>Bio<textarea value={content.bio} maxLength={4000} rows={5} onChange={(event) => update({ bio: event.target.value })} /></label>
        </section>
        <ResumeImport content={content} disabled={busy} onStore={storeResume} onApply={(suggestions) => {
          setContent((current) => current && applyResumeDetails(current, suggestions));
          setMessage("Résumé suggestions added. Save your profile when you’re ready.");
        }} />
        {details.resume_id && (
          <section className={styles.group}>
            <h2>Stored résumé</h2>
            <p className={styles.hint}>You can turn on downloads separately in each portfolio’s Publish settings.</p>
            <div className={styles.actions}>
              <a className={styles.secondary} href="/api/profile/resume" download="resume.pdf">Download my PDF</a>
              <button type="button" className={styles.danger} disabled={busy} onClick={() => void removeResume()}>Remove résumé</button>
            </div>
          </section>
        )}
        <PortfolioFields content={content} template="editorial" disabled={busy} update={update} />
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={busy || !dirty} onClick={() => void save()}>Save profile</button>
          <Link className={styles.secondary} href="/dashboard">My portfolios</Link>
        </div>
      </div>
    </main>
  );
}
