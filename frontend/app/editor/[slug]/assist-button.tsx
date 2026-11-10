"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import styles from "../../studio.module.css";

let enabledCheck: Promise<boolean> | null = null;

/** Asked once per page load; the button is hidden entirely when the assistant isn't set up. */
function checkEnabled() {
  enabledCheck ??= fetch("/api/ai/status", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : { enabled: false }))
    .then((data) => data.enabled === true)
    .catch(() => false);
  return enabledCheck;
}

async function requestSuggestion(task: string, text: string, name: string, title: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, text, name, title }),
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    throw new ApiError(typeof detail === "string" ? detail : "The writing assistant couldn’t help just now.", response.status);
  }
  return data.suggestion as string;
}

export default function AssistButton({
  task,
  text,
  name,
  title = "",
  onAccept,
}: {
  task: "headline" | "bio" | "project";
  text: string;
  name: string;
  title?: string;
  onAccept: (suggestion: string) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    checkEnabled().then((value) => { if (!cancelled) setEnabled(value); });
    return () => { cancelled = true; };
  }, []);

  if (!enabled) return null;

  async function improve() {
    setBusy(true);
    setError("");
    setSuggestion("");
    try {
      setSuggestion(await requestSuggestion(task, text, name, title));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The writing assistant couldn’t help just now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.assist}>
      <button type="button" className={styles.assistButton} disabled={busy || !text.trim()} onClick={improve}>
        {busy ? "Thinking…" : "✨ Improve with AI"}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {suggestion && (
        <div className={styles.suggestion} role="status">
          <strong>Suggestion</strong>
          <p>{suggestion}</p>
          <div className={styles.rowActions}>
            <button type="button" className={styles.primary} onClick={() => { onAccept(suggestion); setSuggestion(""); }}>Use this</button>
            <button type="button" className={styles.secondary} onClick={() => setSuggestion("")}>Dismiss</button>
          </div>
          <small>AI can get things wrong, so check it before you use it. Your text is sent to Google’s Gemini to make this.</small>
        </div>
      )}
    </div>
  );
}
