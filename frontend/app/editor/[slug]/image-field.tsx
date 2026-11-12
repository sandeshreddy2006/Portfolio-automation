"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { uploadImage } from "@/lib/api";
import { defaultFraming, imageFramingStyle, validateImageFile, type ImageKind } from "@/lib/image";
import { safeImage, type ImageFilter, type ImageFraming } from "@/lib/portfolio";
import styles from "../../studio.module.css";

function imageFrame(kind: ImageKind, template: string) {
  if (kind === "avatar") return { ratio: "1", round: template === "editorial" || template === "aurora" };
  if (template === "blocky") return { ratio: "1", round: false };
  return { ratio: template === "bento" || template === "brutalist" ? "16 / 10" : "16 / 9", round: false };
}

const filters: ImageFilter[] = ["original", "monochrome", "warm", "cool", "vivid"];

export default function ImageField({
  label, hint, kind, template, value, framing, disabled, onChange,
}: {
  label: string;
  hint?: string;
  kind: ImageKind;
  template: string;
  value?: string | null;
  framing?: ImageFraming | null;
  disabled?: boolean;
  onChange: (url: string | null, framing: ImageFraming | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const previewImage = useRef<HTMLImageElement>(null);
  const objectUrl = useRef<string | null>(null);
  const drag = useRef<{ x: number; y: number; horizontal: number; vertical: number; overflowX: number; overflowY: number } | null>(null);
  const id = useId();
  const [source, setSource] = useState<string>();
  const [file, setFile] = useState<File>();
  const [draft, setDraft] = useState(defaultFraming);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const frame = imageFrame(kind, template);
  const currentImage = safeImage(value);
  const frameStyle = { aspectRatio: frame.ratio, borderRadius: frame.round ? "50%" : undefined };

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  function clear() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    drag.current = null;
    setSource(undefined);
    setFile(undefined);
    setLoaded(false);
  }

  function open(src: string, next: ImageFraming, pendingFile?: File) {
    setError("");
    setLoaded(false);
    setSource(src);
    setFile(pendingFile);
    setDraft(next);
    dialog.current?.showModal();
  }

  function choose(pendingFile?: File) {
    if (!pendingFile) return;
    if (input.current) input.current.value = "";
    try {
      validateImageFile(pendingFile);
      objectUrl.current = URL.createObjectURL(pendingFile);
      open(objectUrl.current, defaultFraming, pendingFile);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn’t open that image.");
    }
  }

  async function apply() {
    if (!loaded) return;
    setError("");
    setBusy(true);
    try {
      const url = file ? await uploadImage(file, kind) : value;
      if (!url) return;
      onChange(url, draft);
      dialog.current?.close();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function moveImage(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const { x, y, horizontal, vertical, overflowX, overflowY } = drag.current;
    const clamp = (position: number) => Math.round(Math.min(100, Math.max(0, position)));
    setDraft((current) => ({
      ...current,
      x: overflowX > 1 ? clamp(horizontal - 100 * (event.clientX - x) / overflowX) : current.x,
      y: overflowY > 1 ? clamp(vertical - 100 * (event.clientY - y) / overflowY) : current.y,
    }));
  }

  return (
    <div className={styles.imageField}>
      <span className={styles.imageLabel}>{label}</span>
      <div className={styles.imageRow}>
        <div className={styles.imageThumb} style={frameStyle}>
          {currentImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentImage} alt="" style={imageFramingStyle(framing ?? defaultFraming)} />
          ) : <span aria-hidden="true">No image</span>}
        </div>
        <div className={styles.imageActions}>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden
            aria-describedby={hint ? `${id}-hint` : undefined} onChange={(event) => choose(event.target.files?.[0])} />
          <button type="button" className={styles.secondary} disabled={disabled || busy} onClick={() => input.current?.click()}>
            {value ? "Replace image" : "Upload image"}
          </button>
          {currentImage && (
            <>
              <button type="button" className={styles.secondary} disabled={disabled || busy} onClick={() => open(currentImage, framing ?? defaultFraming)}>Edit crop</button>
              <button type="button" className={styles.danger} disabled={disabled || busy} onClick={() => onChange(null, null)}>Remove</button>
            </>
          )}
        </div>
      </div>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && !source && <p className={styles.error} role="alert">{error}</p>}

      <dialog ref={dialog} className={styles.cropDialog} aria-labelledby={`${id}-title`} onClose={clear}
        onCancel={(event) => { if (busy) event.preventDefault(); }}>
        <h3 id={`${id}-title`}>Frame your {kind === "avatar" ? "profile photo" : "project image"}</h3>
        <p className={styles.hint}>Drag the image or use the position sliders. The frame follows your selected template.</p>
        {source && (
          <div className={styles.cropPreview} style={frameStyle}
            onPointerDown={(event) => {
              const image = previewImage.current;
              if (event.button !== 0 || busy || !image?.naturalWidth || !image.naturalHeight) return;
              const { width, height } = event.currentTarget.getBoundingClientRect();
              const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * draft.zoom;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                x: event.clientX, y: event.clientY, horizontal: draft.x, vertical: draft.y,
                overflowX: image.naturalWidth * scale - width, overflowY: image.naturalHeight * scale - height,
              };
            }}
            onPointerMove={moveImage} onLostPointerCapture={() => { drag.current = null; }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={previewImage} src={source} alt="Image crop preview" draggable={false} style={imageFramingStyle(draft)}
              onLoad={() => setLoaded(true)} onError={() => setError("That image couldn’t be read.")} />
          </div>
        )}
        <div className={styles.cropControls}>
          {([["zoom", "Zoom", 1, 3, .05], ["x", "Horizontal position", 0, 100, 1], ["y", "Vertical position", 0, 100, 1]] as const)
            .map(([key, name, min, max, step]) => (
              <label key={key}>{name}<input type="range" disabled={busy} min={min} max={max} step={step} value={draft[key]}
                onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })} /></label>
            ))}
          <label>Filter<select disabled={busy} value={draft.filter} onChange={(event) => setDraft({ ...draft, filter: event.target.value as ImageFilter })}>
            {filters.map((filter) => <option key={filter} value={filter}>{filter[0].toUpperCase() + filter.slice(1)}</option>)}
          </select></label>
        </div>
        {error && source && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={!loaded || busy} onClick={() => void apply()}>{busy ? "Uploading…" : "Apply image"}</button>
          <button type="button" className={styles.secondary} disabled={busy} onClick={() => setDraft(defaultFraming)}>Reset</button>
          <button type="button" className={styles.secondary} disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button>
        </div>
      </dialog>
    </div>
  );
}
