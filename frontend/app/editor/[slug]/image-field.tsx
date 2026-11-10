"use client";

import { useId, useRef, useState } from "react";
import { UserImage } from "@/components/templates/user-image";
import { uploadImage } from "@/lib/api";
import type { ImageKind } from "@/lib/image";
import styles from "../../studio.module.css";

export default function ImageField({
  label,
  hint,
  kind,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  kind: ImageKind;
  value?: string | null;
  onChange: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadImage(file, kind));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={styles.imageField}>
      <span className={styles.imageLabel}>{label}</span>
      <div className={styles.imageRow}>
        <div className={`${styles.imageThumb} ${kind === "avatar" ? styles.imageRound : ""}`}>
          {value ? <UserImage src={value} alt="" /> : <span aria-hidden="true">No image</span>}
        </div>
        <div className={styles.imageActions}>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            aria-describedby={hint ? hintId : undefined}
            onChange={(event) => choose(event.target.files?.[0])}
          />
          <button type="button" className={styles.secondary} disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </button>
          {value && !busy && (
            <button type="button" className={styles.danger} onClick={() => onChange(null)}>Remove</button>
          )}
        </div>
      </div>
      {hint && <small id={hintId}>{hint}</small>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
