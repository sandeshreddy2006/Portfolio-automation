"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { templateInfo } from "@/components/templates/meta";

export default function HomePreview() {
  const [template, setTemplate] = useState(templateInfo[0]);

  useEffect(() => {
    const selected = templateInfo[Math.floor(Math.random() * templateInfo.length)];
    const frame = requestAnimationFrame(() => setTemplate(selected));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <figure className="preview">
      <figcaption className="preview-caption">{template.name} template</figcaption>
      <div className="preview-stage">
        <div className="preview-orbit" aria-hidden="true" />
        <div className="preview-orbit preview-orbit-inner" aria-hidden="true" />
        <div className="preview-window">
          <div className="window-bar" aria-hidden="true">
            <span className="window-dots"><i /><i /><i /></span>
            <span>Portfolio preview</span>
          </div>
          <div className="preview-template">
            <Image
              src={`/designs/${template.id}.webp`}
              alt={`The ${template.name} sample portfolio in Portfolabs lime`}
              width={960}
              height={675}
              sizes="(max-width: 750px) 75vw, 480px"
              fetchPriority="high"
            />
          </div>
        </div>
      </div>
    </figure>
  );
}
