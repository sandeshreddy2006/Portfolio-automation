"use client";

import { useState } from "react";
import styles from "../templates.module.css";

const devices = [
  { key: "desktop", label: "Desktop", width: "100%" },
  { key: "tablet", label: "Tablet", width: "768px" },
  { key: "mobile", label: "Mobile", width: "390px" },
] as const;

const variants = [
  { key: "full", label: "Full content" },
  { key: "sparse", label: "Name only" },
] as const;

export function PreviewControls({ id, name }: { id: string; name: string }) {
  const [device, setDevice] = useState<(typeof devices)[number]["key"]>("desktop");
  const [variant, setVariant] = useState<(typeof variants)[number]["key"]>("full");
  const width = devices.find((item) => item.key === device)!.width;

  return (
    <div>
      <div className={styles.controls}>
        <div role="group" aria-label="Device size">
          {devices.map((item) => (
            <button key={item.key} type="button" aria-pressed={device === item.key} onClick={() => setDevice(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Sample data">
          {variants.map((item) => (
            <button key={item.key} type="button" aria-pressed={variant === item.key} onClick={() => setVariant(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.stage}>
        <iframe
          title={`${name} template preview`}
          src={`/templates/${id}/frame/${variant}`}
          style={{ width, maxWidth: "100%" }}
        />
      </div>
    </div>
  );
}
