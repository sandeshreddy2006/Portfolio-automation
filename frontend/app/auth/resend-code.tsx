"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const resendCooldown = 30;

export default function ResendCode({ onResent }: { onResent: () => void }) {
  const [remaining, setRemaining] = useState(resendCooldown);
  const [checking, setChecking] = useState(true);
  const [sending, setSending] = useState(false);
  const [expired, setExpired] = useState(false);
  const [message, setMessage] = useState("");
  const deadline = useRef(0);

  const startCountdown = useCallback((seconds: number) => {
    deadline.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    deadline.current = Date.now() + resendCooldown * 1000;
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 250);

    async function loadStatus() {
      try {
        const response = await fetch("/api/auth/verification", {
          cache: "no-store", signal: controller.signal,
        });
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (response.ok) {
          startCountdown(result.retry_after);
        } else if (response.status === 400 || response.status === 401) {
          setExpired(true);
          setMessage(result.detail);
        }
      } catch {
        // The server still checks the cooldown if the initial status request fails.
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }

    void loadStatus();
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [startCountdown]);

  async function resend() {
    setSending(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/verification/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      if (response.ok) {
        startCountdown(result.retry_after);
        setMessage("A fresh code is on its way.");
        onResent();
      } else {
        const retryAfter = Number(response.headers.get("Retry-After"));
        if (retryAfter > 0) startCountdown(retryAfter);
        if (response.status === 400 || response.status === 401) setExpired(true);
        setMessage(result.detail || "We couldn’t resend the code. Try again.");
      }
    } catch {
      setMessage("We couldn’t reach the account service. Try again.");
    } finally {
      setSending(false);
    }
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  const countdown = remaining > 0 && !expired ? ` in ${minutes}:${seconds}` : "";

  return (
    <div className="account-resend">
      <button
        type="button"
        className="account-resend-button"
        disabled={checking || sending || expired || remaining > 0}
        onClick={resend}
      >
        {sending ? "Sending code…" : `Resend code${countdown}`}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
