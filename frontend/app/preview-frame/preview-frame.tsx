"use client";

import { useEffect, useState } from "react";
import { getTemplate } from "@/components/templates";
import type { PortfolioContent } from "@/lib/portfolio";

/** Rendered inside the editor's iframe so the preview uses the iframe's real width. */
export default function PreviewFrame() {
  const [content, setContent] = useState<PortfolioContent | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type === "portfolio-preview") setContent(event.data.content);
    }
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const template = content ? getTemplate(content.template_id) : undefined;
  return template && content ? <template.Component content={content} /> : null;
}
