"use client";

import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

const sections = [
  { id: "designs", label: "Designs" },
  { id: "features", label: "Features" },
  { id: "workflow", label: "How it works" },
  { id: "about", label: "About" },
  { id: "faq", label: "FAQ" },
];

export function HomeSectionLink({ id, children, className, onNavigate }: {
  id: string;
  children: ReactNode;
  className?: string;
  onNavigate?: () => void;
}) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const section = document.getElementById(id);
    if (!section) return;
    event.preventDefault();
    onNavigate?.();
    section.focus({ preventScroll: true });
    section.scrollIntoView({ block: "start" });
  }

  return <a className={className} href={`#${id}`} onClick={navigate}>{children}</a>;
}

export function HomeNavigation() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type !== "reload" || window.location.hash || navigation.name !== window.location.href) return;

    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    let frame = 0;
    let active = true;

    function resetAfterLoad() {
      // The browser can restore its saved position at the end of the load event.
      frame = requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        history.scrollRestoration = previous;
        active = false;
      });
    }

    window.scrollTo({ top: 0, behavior: "instant" });
    if (document.readyState === "complete") resetAfterLoad();
    else window.addEventListener("load", resetAfterLoad, { once: true });

    return () => {
      window.removeEventListener("load", resetAfterLoad);
      cancelAnimationFrame(frame);
      if (active) history.scrollRestoration = previous;
    };
  }, []);

  return (
    <nav className="home-nav" aria-label="Main navigation" onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    }}>
      <button className="home-nav-toggle" type="button" ref={toggle} aria-expanded={open}
        aria-controls="home-nav-links" onClick={() => setOpen(!open)}>
        Menu
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="home-nav-links" id="home-nav-links" data-open={open}>
        {sections.map(({ id, label }) => (
          <HomeSectionLink key={id} id={id} onNavigate={() => setOpen(false)}>{label}</HomeSectionLink>
        ))}
      </div>
    </nav>
  );
}
