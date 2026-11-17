"use client";

import { useEffect, useRef } from "react";
import { getSample } from "@/lib/sample-data";
import styles from "./dashboard.module.css";

export default function DashboardPreview({ template, name, eager = false }: {
  template: string; name: string; eager?: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      element.style.setProperty("--preview-scale", String(entry.contentRect.width / 960));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function send() {
      frame.current?.contentWindow?.postMessage({
        type: "portfolio-preview",
        content: { ...getSample("sparse", template), name },
      }, window.location.origin);
    }
    function ready(event: MessageEvent) {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow &&
        event.data?.type === "preview-ready") send();
    }
    window.addEventListener("message", ready);
    send();
    return () => window.removeEventListener("message", ready);
  }, [template, name]);

  return (
    <div className={styles.namePreview} ref={viewport} aria-hidden="true">
      <iframe ref={frame} src="/preview-frame" title={`${name} template preview`}
        loading={eager ? "eager" : "lazy"} tabIndex={-1} />
    </div>
  );
}
