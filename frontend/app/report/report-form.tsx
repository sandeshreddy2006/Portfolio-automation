"use client";

import { useState, type FormEvent } from "react";
import styles from "../legal.module.css";

const reasons = [
  ["spam", "Spam or a scam"],
  ["impersonation", "Pretending to be someone else"],
  ["harassment", "Harassment or hate"],
  ["illegal", "Something illegal"],
  ["other", "Something else"],
] as const;

export default function ReportForm({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reason: data.reason, details: data.details ?? "", contact: data.contact || null }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = result?.detail;
        throw new Error(typeof detail === "string" ? detail : "Check the details you entered and try again.");
      }
      setDone(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className={styles.success} role="status">Thank you. We’ve received your report for /p/{slug}.</p>;

  return (
    <form className={styles.form} onSubmit={submit}>
      <p>You’re reporting <strong>/p/{slug}</strong>.</p>
      <label>What’s the problem?
        <select name="reason" required defaultValue="">
          <option value="" disabled>Choose one</option>
          {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Details (optional)
        <textarea name="details" rows={5} maxLength={1000} />
        <small>Up to 1,000 characters.</small>
      </label>
      <label>Your email (optional)
        <input name="contact" type="email" autoComplete="email" />
        <small>Only if you’d like us to follow up. We won’t share it with the portfolio owner.</small>
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" className={styles.submit} disabled={busy}>{busy ? "Sending…" : "Send report"}</button>
    </form>
  );
}
